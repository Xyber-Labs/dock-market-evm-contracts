// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/DockMarketUpgradeChecker.sol";

import "./interfaces/IDockMarketWallet.sol";
import "./interfaces/IDockMarketRouter.sol";

contract DockMarketWallet is IDockMarketWallet, DockMarketUpgradeChecker, ERC165Upgradeable {
    using SafeERC20 for IERC20;
    using Address for *;

    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint16 private constant BPS = 10000;

    address public immutable ROUTER;
    address public immutable WETH_ADDRESS;

    /// @custom:storage-location erc7201:DockMarket.storage.Wallet
    struct DockMarketWalletStorage {
        address _owner;
        uint256 _agentId;
        mapping(address tokenAddress => uint256 totalDeposited) _totalDeposited;
    }

    // keccak256(abi.encode(uint256(keccak256("DockMarket.storage.Wallet")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DOCKMARKET_WALLET_STORAGE_LOCATION = 0x1f29bbf228ab981ff21f9877ab31379d8fd9dde7961f6b294d9309a4bb6c6c00;
    
    error DockMarketWallet__ZeroAmount();
    error DockMarketWallet__CallerIsNotRouter(address caller);
    error DockMarketWallet__InvalidCallTarget(address target);
    error DockMarketWallet__ExecuteCallFailed(address target);

    event Deposited(address indexed depositor, address indexed token, uint256 amount, uint256 totalDeposited);
    event Withdrawn(address indexed token, address indexed receiver, uint256 amount, uint256 feeAmount);

    modifier onlyRouter() {
        require(msg.sender == ROUTER, DockMarketWallet__CallerIsNotRouter(msg.sender));
        _;
    }

    receive() payable external {
        require(msg.sender == ROUTER || msg.sender == WETH_ADDRESS, DockMarketWallet__CallerIsNotRouter(msg.sender));
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router, address weth) {
        _disableInitializers();

        ROUTER = router;
        WETH_ADDRESS = weth;
    }
    
    function initialize(address newOwner, uint256 newAgentId) external initializer() {
        __ERC165_init();
        __DockMarketWallet_init(newOwner, newAgentId);
    }

    function deposit(address holder, address token, uint256 amount) external onlyRouter() returns(bool success) {
        require(amount > 0, DockMarketWallet__ZeroAmount());
        
        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();
        $._totalDeposited[token] += amount;

        emit Deposited(holder, token, amount, $._totalDeposited[token]);

        return true;
    }

    function withdraw(
        address token,
        address receiver,
        uint256 amountToWithdraw
    ) external onlyRouter() returns(uint256 amount, uint256 feeAmount) {
        require(amountToWithdraw > 0, DockMarketWallet__ZeroAmount());

        (
            address _feeCollector,
            uint256 _performanceFeeRate,
            uint256 _managementFeeRate,
            /* uint256 _maxDepositValueUSD */
        ) = IDockMarketRouter(ROUTER).getConfig();

        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();

        if ($._totalDeposited[token] >= amountToWithdraw) {
            $._totalDeposited[token] -= amountToWithdraw;
        } else {
            feeAmount = (amountToWithdraw - $._totalDeposited[token]) * _performanceFeeRate / BPS;
            $._totalDeposited[token] = 0;
        }

        feeAmount += amountToWithdraw * _managementFeeRate / BPS;
        amount = amountToWithdraw - feeAmount;

        if (token == ETH_ADDRESS) {
            payable(receiver).sendValue(amount);
        } else {
            IERC20(token).safeTransfer(receiver, amount);
        }

        if (feeAmount > 0) {
            if (token == ETH_ADDRESS) {
                payable(_feeCollector).sendValue(feeAmount);
            } else {
                IERC20(token).safeTransfer(_feeCollector, feeAmount);
            }
        }

        emit Withdrawn(token, receiver, amount, feeAmount);
    }

    function execute(Transaction[] calldata txs) external onlyRouter() {
        for (uint256 i; txs.length > i; i++) {
            if (txs[i].data.length > 0) {
                require(txs[i].target.code.length > 0, DockMarketWallet__InvalidCallTarget(txs[i].target));
            }
        
            (bool _callResult, /* bytes memory _callResponse */) = txs[i].target.call{value: txs[i].value}(txs[i].data);
            require(_callResult, DockMarketWallet__ExecuteCallFailed(txs[i].target));
        }
    }

    function owner() external view returns(address ownerAddress) {
        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();
        return $._owner;
    }

    function getAgentId() external view returns(uint256 agentId) {
        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();
        return $._agentId;
    }

    function getAgentProfile() external view returns(AgentProfile memory agentProfile) {
        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();
        return IDockMarketRouter(ROUTER).getAgentProfile($._agentId);
    }

    function getBalances(address[] calldata tokens) external view returns(uint256[] memory balances) {
        balances = new uint256[](tokens.length);

        for (uint256 i; tokens.length > i; ++i) {
            if (tokens[i] == ETH_ADDRESS) {
                balances[i] = address(this).balance;
            } else {
                balances[i] = IERC20(tokens[i]).balanceOf(address(this));
            }
        }
    }

    function totalDeposited(address token) external view returns(uint256 totalDepositedTokens) {
        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();
        return $._totalDeposited[token];
    }

    function dockMarketContractName() public pure override returns(string memory contractName) {
        return "DockMarketWallet";
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IDockMarketWallet).interfaceId || super.supportsInterface(interfaceId);
    }

    function __DockMarketWallet_init(address newOwner, uint256 newAgentId) internal {
        DockMarketWalletStorage storage $ = _getDockMarketWalletStorage();

        $._owner = newOwner;
        $._agentId = newAgentId;
    }

    function _getDockMarketWalletStorage() private pure returns(DockMarketWalletStorage storage $) {
        assembly {
            $.slot := DOCKMARKET_WALLET_STORAGE_LOCATION
        }
    }
}