// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import "./libraries/DockMarketUpgradeChecker.sol";
import "./libraries/TeeVerifier.sol";

import "./interfaces/IDockMarketRouter.sol";
import "./interfaces/IDockMarketWallet.sol";

import "./libraries/interfaces/IUniswapOracle.sol";

contract DockMarketRouter is 
    IDockMarketRouter,
    TeeVerifier,
    DockMarketUpgradeChecker,
    UUPSUpgradeable,
    AccessControlUpgradeable
{
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using LibString for *;
    using Create2 for *;
    using Address for *;
    
    bytes32 public constant SESSION_ADMIN_ROLE = keccak256("SESSION_ADMIN_ROLE");

    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint16 private constant BPS = 10000;

    uint16 private immutable STATIC_CALL_GAS_LIMIT;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable UNISWAP_ORACLE;
    address public immutable WALLET_BEACON;
    address public immutable WETH_ADDRESS;
    address public immutable USDC_ADDRESS;
    address public immutable USDC_WETH_UNISWAP_POOL;
    
    /// @custom:storage-location erc7201:DockMarket.storage.Router
    struct DockMarketRouterStorage {
        address _feeCollector;
        uint256 _performanceFeeRate;
        uint256 _managementFeeRate;
        uint256 _maxDepositValue;
        mapping(uint256 agentId => AgentProfile) _agents;
        mapping(address onchainAddress => uint256 agentId) _agentIds;
        mapping(bytes32 signatureHash => bool isUsed) _usedSignature;
        mapping(address user => mapping(uint256 agentId => address wallet)) _wallet;
    }

    // keccak256(abi.encode(uint256(keccak256("DockMarket.storage.Router")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DOCKMARKET_ROUTER_STORAGE_LOCATION = 0xb8c12157085b30df5c63ba33571f79ef6f785d59ca636cffa3c81ce985c53a00;

    error DockMarketRouter__InvalidCaller(address callerAddress);
    error DockMarketRouter__InvalidCallTarget(address target);
    error DockMarketRouter__ExecuteCallFailed(address target);
    error DockMarketRouter__UnauthorizedMrEnclave(bytes32 mrEnclave);
    error DockMarketRouter__InvalidHashedData(bytes32 hashedData);
    error DockMarketRouter__UnallowedToken(address token);
    error DockMarketRouter__ZeroAddress();
    error DockMarketRouter__DeadlineExpired();
    error DockMarketRouter__UsedSignature();
    error DockMarketRouter__FeeRateExceeded(uint256 perfomanceFeeRate);
    error DockMarketRouter__UnallowedAgentType();
    error DockMarketRouter__DepositAmountExceeded();
    error DockMarketRouter__InvalidMsgValue();
    error DockMarketRouter__ZeroAgentName();
    error DockMarketRouter__ZeroAgentType();
    error DockMarketRouter__AgentInitialized(uint256 agentId);
    error DockMarketRouter__AgentPaused(uint256 agentId);

    event Deposited(
        address indexed wallet,
        address user,
        uint256 indexed agentId,
        address indexed token,
        uint256 amount
    );

    event Withdrawn(
        address indexed wallet, 
        address indexed user, 
        address indexed token, 
        address receiver, 
        uint256 amount, 
        uint256 feeAmount
    );

    event WalletCreated(address indexed user, uint256 indexed agentId, string indexed agentType, address wallet);
    event PerformanceFeeRateSet(uint256 newPerfomanceFeeRate, address indexed caller);
    event ManagementFeeRateSet(uint256 newManagementFeeRate, address indexed caller);
    event MaxDepositValueSet(uint256 newMaxDepositValue, address indexed caller);
    event FeeCollectorSet(address newFeeCollector, address indexed caller);
    event Executed(address indexed target, bytes data, address indexed caller);
    event AgentPaused(uint256 indexed agentId, bool indexed isPaused, address indexed caller);
    event CreatorAddressSet(uint256 indexed agentId, address oldCreatorAddress, address newCreatorAddress);

    event SessionInitialized(
        uint256 indexed agentId,
        string agentName,
        string indexed agentType,
        address onchainAddress,
        bytes32 mrEnclave,
        address indexed caller
    );
    
    modifier onlySelfCall() {
        require(msg.sender == address(this), DockMarketRouter__InvalidCaller(msg.sender));
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address uniswapOracle, 
        address walletBeacon, 
        address wethAddress, 
        address usdcAddress, 
        address usdcWethUniswapPoolAddress,
        uint16 staticCallGasLimit
    ) {
        _disableInitializers();

        UNISWAP_ORACLE = uniswapOracle;
        WALLET_BEACON = walletBeacon;
        WETH_ADDRESS = wethAddress;
        USDC_ADDRESS = usdcAddress;
        USDC_WETH_UNISWAP_POOL = usdcWethUniswapPoolAddress;
        STATIC_CALL_GAS_LIMIT = staticCallGasLimit;
    }
    
    function initialize(address defaultAdmin, ChunkedX509Cert calldata rootCert) external initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _setRootCert(rootCert);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function createWallet(address user, uint256 agentId) external returns(address walletAddress) {
        return _createWallet(user, agentId);
    }

    function deposit(
        address receiver,
        uint256 agentId,
        address token, 
        uint256 amount
    ) external payable returns(address walletAddress) {
        _validateAllowedToken(token);
        
        if (token == ETH_ADDRESS) {
            amount = msg.value;
        } else {
            require(msg.value == 0, DockMarketRouter__InvalidMsgValue());
        }

        return _deposit(msg.sender, receiver, agentId, token, amount);
    }

    function depositWithPermit( 
        address receiver,
        uint256 agentId,
        address token,
        Permit calldata permit
    ) external onlySelfCall() returns(address walletAddress) {
        _validateAllowedToken(token);

        token.call(abi.encodeCall(
            IERC20Permit.permit, 
            (permit.holder, address(this), permit.amount, permit.deadline, permit.v, permit.r, permit.s)
        ));

        return _deposit(permit.holder, receiver, agentId, token, permit.amount);
    }

    function _deposit(
        address holder, 
        address receiver,
        uint256 agentId,
        address token, 
        uint256 amount
    ) internal returns(address walletAddress) {
        walletAddress = _createWallet(receiver, agentId);

        _validateDepositAmount(walletAddress, token, amount);

        if (token == ETH_ADDRESS) {
            payable(walletAddress).sendValue(amount);
        } else {
            IERC20(token).safeTransferFrom(holder, walletAddress, amount);
        }

        IDockMarketWallet(walletAddress).deposit(holder, token, amount);

        emit Deposited(walletAddress, receiver, agentId, token, amount);
    }

    function withdraw(
        address user,
        uint256 agentId,
        address token,
        address receiver,
        uint256 amountToWithdraw
    ) external onlySelfCall() returns(address walletAddress) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        walletAddress = $._wallet[user][agentId];
        _validateZeroAddress(walletAddress);

        (uint256 _amount, uint256 _feeAmount) = IDockMarketWallet(walletAddress).withdraw(
            token,
            receiver,
            amountToWithdraw
        );

        emit Withdrawn(walletAddress, user, token, receiver, _amount, _feeAmount);
    }

    function execute(
        Transaction[] calldata txs,
        bytes calldata signature,
        uint256 deadline
    ) external payable onlyRole(SESSION_ADMIN_ROLE) {
        uint256 _agentId = _verifySignature(
            keccak256(abi.encode(block.chainid, address(this), deadline, txs)), 
            deadline, 
            signature
        );

        for (uint256 i; txs.length > i; i++) {
            if (txs[i].data.length > 0) {
                require(txs[i].target.code.length > 0, DockMarketRouter__InvalidCallTarget(txs[i].target));
            }

            (
                bool _result, 
                bytes memory _response
            ) = txs[i].target.staticcall{gas: STATIC_CALL_GAS_LIMIT}(abi.encodeCall(IDockMarketWallet.getAgentId, ()));

            if (_result) {
                require(abi.decode(_response, (uint256)) == _agentId, DockMarketRouter__UnallowedAgentType());
            }

            (bool _callResult, /* bytes memory _callResponse */) = txs[i].target.call{value: txs[i].value}(txs[i].data);
            require(_callResult, DockMarketRouter__ExecuteCallFailed(txs[i].target));

            emit Executed(txs[i].target, txs[i].data, msg.sender);
        }
    }

    function initSessionKey(
        ChunkedX509Cert calldata leaf,
        ChunkedX509Cert calldata intermediate,
        ChunkedSGXQuote calldata quote,
        uint256 agentId,
        string calldata agentName,
        string calldata agentType,
        address onchainAddress,
        address creatorAddress
    ) external onlyRole(SESSION_ADMIN_ROLE) {
        _validateZeroAddress(onchainAddress);

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();

        require(agentId > 0, DockMarketRouter__ZeroAgentType());
        require(bytes(agentName).length > 0, DockMarketRouter__ZeroAgentName());
        require(bytes(agentType).length > 0, DockMarketRouter__ZeroAgentType());
        require($._agentIds[onchainAddress] == 0, DockMarketRouter__AgentInitialized(agentId));
        require($._agents[agentId].onchainAddress == address(0), DockMarketRouter__AgentInitialized(agentId));

        (bytes32 _hashedData, bytes32 _mrEnclave) = _verifySessionKey(leaf, intermediate, quote);

        require(mrEnclaveAuthorized(_mrEnclave), DockMarketRouter__UnauthorizedMrEnclave(_mrEnclave));
        require(
            sha256(abi.encodePacked(
                "AgentId: ", agentId.toString(), ". ",
                "AgentName: ", agentName, ". ",
                "AgentType: ", agentType, ". ",
                "OnchainAddress: ", onchainAddress.toHexStringChecksummed(), ". ",
                "CreatorAddress: ", creatorAddress.toHexStringChecksummed(),
                ".init"
            )) == _hashedData, DockMarketRouter__InvalidHashedData(_hashedData)
        ); 

        $._agentIds[onchainAddress] = agentId;
        $._agents[agentId] = AgentProfile({
            isPaused: false,
            agentName: agentName,
            agentType: agentType,
            onchainAddress: onchainAddress,
            creatorAddress: creatorAddress
        });

        emit SessionInitialized(agentId, agentName, agentType, onchainAddress, _mrEnclave, msg.sender);
        emit CreatorAddressSet(agentId, address(0), creatorAddress);
    }

    function reinitSessionKey(
        ChunkedX509Cert calldata leaf,
        ChunkedX509Cert calldata intermediate,
        ChunkedSGXQuote calldata quote,
        uint256 agentId,
        address newOnchainAddress
    ) external onlyRole(SESSION_ADMIN_ROLE) {
        _validateZeroAddress(newOnchainAddress);

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        AgentProfile storage agentProfile = $._agents[agentId];

        _validateZeroAddress(agentProfile.onchainAddress);
        require($._agentIds[newOnchainAddress] == 0, DockMarketRouter__AgentInitialized(agentId));

        (bytes32 _hashedData, bytes32 _mrEnclave) = _verifySessionKey(leaf, intermediate, quote);

        require(mrEnclaveAuthorized(_mrEnclave), DockMarketRouter__UnauthorizedMrEnclave(_mrEnclave));
        require(
            sha256(abi.encodePacked(
                "AgentId: ", agentId.toString(), ". ",
                "New onchainAddress: ", newOnchainAddress.toHexStringChecksummed(),
                ".reinit"
            )) == _hashedData, DockMarketRouter__InvalidHashedData(_hashedData)
        );

        $._agentIds[newOnchainAddress] = agentId;
        $._agentIds[agentProfile.onchainAddress] = 0;
        agentProfile.onchainAddress = newOnchainAddress;
        
        emit SessionInitialized(
            agentId, 
            agentProfile.agentName, 
            agentProfile.agentType, 
            newOnchainAddress, 
            _mrEnclave, 
            msg.sender
        );
    }
    
    function setFeeCollector(address newFeeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setFeeCollector(newFeeCollector);
    }

    function setPerfomanceFeeRate(uint256 newPerfomanceFeeRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPerfomanceFeeRate(newPerfomanceFeeRate);
    }

    function setManagementFeeRate(uint256 newManagementFeeRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setManagementFeeRate(newManagementFeeRate);
    }

    function setMaxDepositValue(uint256 newMaxDepositValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMaxDepositValue(newMaxDepositValue);
    }

    function setMrEnclave(bytes32 mrEnclave, bool isAuthorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMrEnclave(mrEnclave, isAuthorized);
    }

    function setPause(uint256 agentId, bool isPaused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPause(agentId, isPaused);
    }

    function setCreatorAddress(uint256 agentId, address newCreatorAddress) external {
        _setCreatorAddress(agentId, newCreatorAddress);
    }

    function getConfig() external view returns(
        address feeCollectorAddress,
        uint256 performanceFeeRateValue,
        uint256 managementFeeRateValue,
        uint256 maxDepositValueUSD
    ) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        return ($._feeCollector, $._performanceFeeRate, $._managementFeeRate, $._maxDepositValue);
    }

    function getWalletAddress(address user, uint256 agentId) public view returns(address walletAddress, bool isDeployed) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        walletAddress = $._wallet[user][agentId];

        if (walletAddress == address(0)) {
            walletAddress = keccak256(abi.encodePacked(user, agentId)).computeAddress(
                keccak256(abi.encodePacked(
                    type(BeaconProxy).creationCode,
                    abi.encode(WALLET_BEACON, "")
                ))
            );
        }
        
        if (walletAddress.code.length > 0) isDeployed = true;
    }

    function getBalances(
        address user, 
        uint256 agentId, 
        address[] calldata tokens
    ) external view returns(uint256[] memory balances) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        address _walletAddress = $._wallet[user][agentId];

        return _walletAddress == address(0) ? balances : IDockMarketWallet(_walletAddress).getBalances(tokens);
    }

    function totalDeposited(address user, uint256 agentId, address token) external view returns(uint256 totalDepositedTokens) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        address _walletAddress = $._wallet[user][agentId];

        return _walletAddress == address(0) ? 0 : IDockMarketWallet(_walletAddress).totalDeposited(token);
    }

    function getOwnerByWallet(address walletAddress) external view returns(address owner, AgentProfile memory agentProfile) {
        if (walletAddress.code.length == 0) return (address(0), agentProfile);

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();

        return (IDockMarketWallet(walletAddress).owner(), $._agents[IDockMarketWallet(walletAddress).getAgentId()]);
    }

    function getAgentProfile(uint256 agentId) external view returns(AgentProfile memory agentProfile) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        return $._agents[agentId];
    }

    function usedSignature(bytes32 signatureHash) external view returns(bool isUsed) {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        return $._usedSignature[signatureHash];
    }
    
    function dockMarketContractName() public pure virtual override returns(string memory contractName) {
        return "DockMarketRouter";
    }
 
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IDockMarketRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    function _validateAllowedToken(address token) internal view {
        require(token == ETH_ADDRESS || token == WETH_ADDRESS || token == USDC_ADDRESS, DockMarketRouter__UnallowedToken(token));
    }

    function _validateDepositAmount(address wallet, address tokenIn, uint256 amountIn) internal view {
        uint256 _usdcDeposited = IDockMarketWallet(wallet).totalDeposited(USDC_ADDRESS);
        uint256 _wethDeposited = 
            IDockMarketWallet(wallet).totalDeposited(ETH_ADDRESS) + 
            IDockMarketWallet(wallet).totalDeposited(WETH_ADDRESS);

        if (tokenIn == USDC_ADDRESS) {
            _usdcDeposited += amountIn;
        } else {
            _wethDeposited += amountIn;
        }

        _usdcDeposited += IUniswapOracle(UNISWAP_ORACLE).getAmountOut(
            USDC_WETH_UNISWAP_POOL, 
            WETH_ADDRESS, 
            _wethDeposited
        );

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        require($._maxDepositValue >= _usdcDeposited, DockMarketRouter__DepositAmountExceeded());
    }

    function _validateZeroAddress(address target) internal pure {
        require(target != address(0), DockMarketRouter__ZeroAddress());
    }

    function _createWallet(address user, uint256 agentId) internal returns(address walletAddress) {
        _validateZeroAddress(user);

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();

        _validateZeroAddress($._agents[agentId].onchainAddress);
        require(!$._agents[agentId].isPaused, DockMarketRouter__AgentPaused(agentId));

        bool _isDeployed;
        (walletAddress, _isDeployed) = getWalletAddress(user, agentId);

        if (_isDeployed) return walletAddress;

        walletAddress = Create2.deploy(
            0,
            keccak256(abi.encodePacked(user, agentId)),
            abi.encodePacked(type(BeaconProxy).creationCode, abi.encode(WALLET_BEACON, ""))
        );

        IDockMarketWallet(walletAddress).initialize(user, agentId);

        $._wallet[user][agentId] = walletAddress;

        emit WalletCreated(user, agentId, $._agents[agentId].agentType, walletAddress);
    }

    function _verifySignature(
        bytes32 messageHash, 
        uint256 deadline, 
        bytes calldata signature
    ) internal returns(uint256 agentId) {
        require(deadline >= block.timestamp, DockMarketRouter__DeadlineExpired());

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();

        bytes32 _signatureHash = keccak256(signature);

        require(!$._usedSignature[_signatureHash], DockMarketRouter__UsedSignature());

        address _signer = messageHash.toEthSignedMessageHash().recover(signature);

        agentId = $._agentIds[_signer];

        _validateZeroAddress($._agents[agentId].onchainAddress);
        require(!$._agents[agentId].isPaused, DockMarketRouter__AgentPaused(agentId));

        $._usedSignature[_signatureHash] = true;
    }

    function _setFeeCollector(address newFeeCollector) internal {
        _validateZeroAddress(newFeeCollector);

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        $._feeCollector = newFeeCollector;

        emit FeeCollectorSet(newFeeCollector, msg.sender);
    }

    function _setPerfomanceFeeRate(uint256 newPerfomanceFeeRate) internal {
        require(BPS > newPerfomanceFeeRate, DockMarketRouter__FeeRateExceeded(newPerfomanceFeeRate));

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        $._performanceFeeRate = newPerfomanceFeeRate;

        emit PerformanceFeeRateSet(newPerfomanceFeeRate, msg.sender);
    }

    function _setManagementFeeRate(uint256 newManagementFeeRate) internal {
        require(BPS > newManagementFeeRate, DockMarketRouter__FeeRateExceeded(newManagementFeeRate));

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        $._managementFeeRate = newManagementFeeRate;

        emit ManagementFeeRateSet(newManagementFeeRate, msg.sender);
    }

    function _setMaxDepositValue(uint256 newMaxDepositValue) internal {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        $._maxDepositValue = newMaxDepositValue;

        emit MaxDepositValueSet(newMaxDepositValue, msg.sender);
    }

    function _setPause(uint256 agentId, bool isPaused) internal {
        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        AgentProfile storage agentProfile = $._agents[agentId];

        _validateZeroAddress(agentProfile.onchainAddress);

        agentProfile.isPaused = isPaused;

        emit AgentPaused(agentId, isPaused, msg.sender);
    }

    function _setCreatorAddress(uint256 agentId, address newCreatorAddress) internal {
        _validateZeroAddress(newCreatorAddress);

        DockMarketRouterStorage storage $ = _getDockMarketRouterStorage();
        AgentProfile storage agentProfile = $._agents[agentId];
        address _creatorAddress = agentProfile.creatorAddress;

        _validateZeroAddress(agentProfile.onchainAddress);
        require(msg.sender == _creatorAddress, DockMarketRouter__InvalidCaller(_creatorAddress));

        agentProfile.creatorAddress = newCreatorAddress;

        emit CreatorAddressSet(agentId, _creatorAddress, newCreatorAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _getDockMarketRouterStorage() private pure returns(DockMarketRouterStorage storage $) {
        assembly {
            $.slot := DOCKMARKET_ROUTER_STORAGE_LOCATION
        }
    }
}