// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {UUPSUpgradeChecker} from "upgrade-checker/contracts/uups/UUPSUpgradeChecker.sol";
import {UpgradeCheckerImplementation} from "upgrade-checker/contracts/UpgradeCheckerImplementation.sol";
import {InterfaceIdsRegistry} from "upgrade-checker/contracts/libraries/InterfaceIdsRegistry.sol";


import "./libraries/Swapper.sol";
import "solady/src/utils/LibString.sol";

import "./interfaces/IDockMarketSimpleRouter.sol";

contract DockMarketSimpleRouter is IDockMarketSimpleRouter, Swapper, UUPSUpgradeChecker, UUPSUpgradeable, AccessControlUpgradeable {   
    using EnumerableSet for EnumerableSet.AddressSet;
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;
    using LibString for string;
    using ECDSA for bytes32;
    
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant SCHEDULER_ROLE = keccak256("SCHEDULER_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    uint16 private constant BPS = 10000;

    uint256 private immutable TRANSFER_GAS_LIMIT;

    /// @custom:storage-location erc7201:DockMarket.storage.SimpleRouter
    struct DockMarketSimpleRouterStorage {
        uint16 _protocolFee; /// @dev deprecated
        address _protocolFeeReceiver;
        mapping(bytes16 agentId => Agent) _agents;
    }

    struct Agent {
        AgentState state;
        uint256 roundId;
        string agentName;
        string agentType;
        address depositToken;
        address onchainAddress;
        address creatorAddress;
        uint256 sharePrice;
        uint256 baseMinShares;
        uint256 baseMaxShares;
        uint256 memberMinShares;
        uint256 memberMaxShares;
        uint256 sharesCap;
        mapping(uint256 roundId => Round) rounds;
        uint16 baseManagementFee;
        uint16 basePerformanceFee;
        uint16 memberManagementFee;
        uint16 memberPerformanceFee;
    }

    struct Round {
        uint256 lastIndex;
        uint256 totalShares;
        uint256 distributableAmount;
        EnumerableSet.AddressSet users;
        mapping(address user => uint256) shares;
        mapping(uint256 tokenId => address user) tokenIdUsed;
        mapping(address user => uint256 tokenId) tokenIdUsedByUser;
        uint256 deposited;
    }

    // keccak256(abi.encode(uint256(keccak256("DockMarket.storage.SimpleRouter")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DOCKMARKET_SIMPLE_ROUTER_STORAGE_LOCATION = 0xcc58bac57461890aa656c2a9a91871d877ab50e82ac6adeea9c0e5c73adc9e00;

    error DockMarketSimpleRouter__ZeroData();
    error DockMarketSimpleRouter__TokenIdUsed();
    error DockMarketSimpleRouter__InvalidCaller();
    error DockMarketSimpleRouter__IncorrectShares();
    error DockMarketSimpleRouter__MembershipIssued();
    error DockMarketSimpleRouter__IncorrectAgentType();
    error DockMarketSimpleRouter__InvalidDepositToken();
    error DockMarketSimpleRouter__IncorrectAgentState();
    error DockMarketSimpleRouter__DepositCapacityExceeded();
    error DockMarketSimpleRouter__DepositCapacityUnachieved();

    event AgentRegistered(
        bytes16 indexed agentId,
        string agentName,
        string agentType,
        address indexed depositToken,
        address onchainAddress,
        address creatorAddress,
        uint256 sharePrice,
        uint256 baseMinShares,
        uint256 baseMaxShares,
        uint256 memberMinShares,
        uint256 memberMaxShares,
        uint256 sharesCap,
        address indexed manager
    );

    event Deposited(
        address depositor,
        address indexed receiver,
        bytes16 indexed agentId,
        uint256 indexed roundId,
        address depositToken,
        uint256 amount
    );

    event AgentStateUpdated(
        bytes16 indexed agentId,
        AgentState indexed currentState,
        uint256 indexed currentRound,
        address manager
    );

    event DistributionStarted(
        bytes16 indexed agentId,
        uint256 indexed roundId,
        uint256 feeCollected,
        uint256 amountToDistrubute
    );

    event ProtocolFeeReceiverSet(address newProtocolFeeReceiver, address indexed caller);

    event ProtocolFeeConfigSet(
        bytes16 indexed agentId,
        uint16 newBaseManagementFee,
        uint16 newBasePerformanceFee,
        uint16 newMemberManagementFee,
        uint16 newMemberPerformanceFee,
        address indexed caller
    );

    event DepositConfigSet(
        bytes16 indexed agentId,
        uint256 newSharePrice,
        uint256 newBaseMinShares,
        uint256 newBaseMaxShares,
        uint256 newMemberMinShares,
        uint256 newMemberMaxShares,
        uint256 newSharesCap,
        address indexed caller
    );

    event AgentMetadataSet(bytes16 indexed agentId, string newAgentName, string newAgentType, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        uint256 transferGasLimit, 
        address usdc, 
        address usdcE, 
        address swapRouter
    ) Swapper(usdc, usdcE, swapRouter) {
        _disableInitializers();

        TRANSFER_GAS_LIMIT = transferGasLimit;
    }
    
    function initialize(address defaultAdmin) external initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function initializeV2() external reinitializer(2) {
        IERC20(USDC).forceApprove(SWAP_ROUTER, type(uint256).max);
    }

    function initializeV3() external reinitializer(3) {
        IERC20(USDC_E).forceApprove(SWAP_ROUTER, type(uint256).max);
    }

    function registerAgent(
        bytes16 agentId,
        string calldata agentName,
        string calldata agentType,
        address depositToken,
        address onchainAddress,
        address creatorAddress,
        uint256 sharePrice,
        uint256 baseMinShares,
        uint256 baseMaxShares,
        uint256 memberMinShares,
        uint256 memberMaxShares,
        uint256 sharesCap
    ) external onlyRole(MANAGER_ROLE) {
        _validateAgentState(agentId, AgentState.Nonexistent);
        require(agentId != bytes16(0), DockMarketSimpleRouter__ZeroData());
        require(bytes(agentName).length > 0, DockMarketSimpleRouter__ZeroData());
        require(bytes(agentType).length > 0, DockMarketSimpleRouter__ZeroData());
        require(IERC20(depositToken).totalSupply() > 0, DockMarketSimpleRouter__ZeroData());
        require(onchainAddress != address(0), DockMarketSimpleRouter__ZeroData());
        require(sharePrice > 0, DockMarketSimpleRouter__ZeroData());
        require(baseMaxShares >= baseMinShares, DockMarketSimpleRouter__ZeroData());
        require(memberMaxShares >= memberMinShares, DockMarketSimpleRouter__ZeroData());
        require(sharesCap > 0, DockMarketSimpleRouter__ZeroData());

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        agent.roundId = 1;
        agent.agentName = agentName;
        agent.agentType = agentType;
        agent.depositToken = depositToken;
        agent.onchainAddress = onchainAddress;
        agent.creatorAddress = creatorAddress;
        agent.sharePrice = sharePrice;
        agent.baseMinShares = baseMinShares;
        agent.baseMaxShares = baseMaxShares;
        agent.memberMinShares = memberMinShares;
        agent.memberMaxShares = memberMaxShares;
        agent.sharesCap = sharesCap;

        emit AgentRegistered(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap,
            msg.sender
        );

        _switchAgentState(agentId, AgentState.Deposit);
    }

    function deposit(bytes16 agentId, uint256 shares, address receiver) external returns(uint256 deposited) {
        return _deposit(agentId, shares, msg.sender, receiver, 0);
    }

    function depositWithPermit(
        bytes16 agentId,
        uint256 shares,
        address receiver,
        Permit calldata permit
    ) external onlyRole(DEPOSITOR_ROLE) returns(uint256 deposited) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();

        $._agents[agentId].depositToken.call(abi.encodeCall(
            IERC20Permit.permit, 
            (permit.holder, address(this), permit.amount, permit.deadline, permit.v, permit.r, permit.s)
        ));

        return _deposit(agentId, shares, permit.holder, receiver, 0);
    }

    function depositMember(
        bytes16 agentId,
        uint256 shares,
        uint256 tokenId,
        bytes memory signature
    ) external returns(uint256 deposited) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        uint256 _currentRound = agent.roundId;
        Round storage round = agent.rounds[_currentRound];

        require(
            hasRole(
                SIGNER_ROLE,
                keccak256(abi.encodePacked(
                    block.chainid,
                    address(this),
                    agentId,
                    _currentRound,
                    msg.sender,
                    tokenId
                )).toEthSignedMessageHash().recover(signature)
            ),
            DockMarketSimpleRouter__InvalidCaller()
        );

        require(round.tokenIdUsed[tokenId] == address(0), DockMarketSimpleRouter__TokenIdUsed());
        require(round.tokenIdUsed[round.tokenIdUsedByUser[msg.sender]] == address(0), DockMarketSimpleRouter__MembershipIssued());

        round.tokenIdUsed[tokenId] = msg.sender;
        round.tokenIdUsedByUser[msg.sender] = tokenId;

        return _deposit(agentId, shares, msg.sender, msg.sender, 0);
    }

    function depositWithSwap(bytes16 agentId, uint256 shares, address receiver) external returns(uint256 deposited) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        require(agent.depositToken == USDC_E, DockMarketSimpleRouter__InvalidDepositToken());

        deposited = shares * agent.sharePrice;

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), deposited);

        uint256 _amountIn = _swapIn(deposited, deposited * 9800 / BPS, msg.sender);

        return _deposit(agentId, shares, msg.sender, receiver, _amountIn);
    }

    function _deposit(
        bytes16 agentId,
        uint256 shares,
        address holder,
        address receiver,
        uint256 amountIn
    ) internal returns(uint256 deposited) {
        _validateAgentState(agentId, AgentState.Deposit);
        require(receiver != address(0), DockMarketSimpleRouter__ZeroData());
        require(shares > 0, DockMarketSimpleRouter__ZeroData());

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        uint256 _currentRound = agent.roundId;
        Round storage round = agent.rounds[_currentRound];

        uint256 _newUserShares = round.shares[receiver] + shares;

        if (_getMembership(agentId, _currentRound, receiver)) {
            require(_newUserShares >= agent.memberMinShares, DockMarketSimpleRouter__DepositCapacityUnachieved());
            require(agent.memberMaxShares >= _newUserShares, DockMarketSimpleRouter__DepositCapacityExceeded());
        } else {
            require(_newUserShares >= agent.baseMinShares, DockMarketSimpleRouter__DepositCapacityUnachieved());
            require(agent.baseMaxShares >= _newUserShares, DockMarketSimpleRouter__DepositCapacityExceeded());
        }

        require(agent.sharesCap >= round.totalShares + shares, DockMarketSimpleRouter__DepositCapacityExceeded());

        deposited = shares * agent.sharePrice;

        round.deposited += amountIn == 0 ? deposited : amountIn;
        round.shares[receiver] += shares;
        round.totalShares += shares;
        round.users.add(receiver);

        emit Deposited(holder, receiver, agentId, _currentRound, agent.depositToken, deposited);

        if (amountIn == 0) IERC20(agent.depositToken).safeTransferFrom(holder, address(this), deposited);
    }

    function startTrading(bytes16 agentId) external onlyRole(SCHEDULER_ROLE) {
        _validateAgentState(agentId, AgentState.Deposit);

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        Round storage round = agent.rounds[agent.roundId];

        _switchAgentState(agentId, AgentState.Trading);

        if (round.deposited > 0) IERC20(agent.depositToken).safeTransfer(agent.onchainAddress, round.deposited);
    }

    function startWaiting(bytes16 agentId) external onlyRole(SCHEDULER_ROLE) {
        _validateAgentState(agentId, AgentState.Trading);
        _switchAgentState(agentId, AgentState.Waiting);
    }

    function startPrivateDistribution(
        bytes16 agentId,
        uint256 baseAmount,
        uint256 totalShares,
        Distribution[] calldata distributions
    ) external {
        _validateAgentState(agentId, AgentState.Waiting);

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        uint256 _currentRound = agent.roundId;
        Round storage round = agent.rounds[_currentRound];

        require(msg.sender == agent.onchainAddress, DockMarketSimpleRouter__InvalidCaller());
        require(agent.agentType.eq(_privateAgentType()), DockMarketSimpleRouter__IncorrectAgentType());

        _switchAgentState(agentId, AgentState.Distribution);

        if (baseAmount > 0) {
            IERC20(agent.depositToken).safeTransferFrom(msg.sender, address(this), baseAmount);

            if (agent.depositToken == USDC_E) {
                baseAmount = _swapOut(baseAmount, baseAmount * 9950 / BPS);
            }

            round.distributableAmount = baseAmount;

            (
                uint16 _memberManagementFee,
                uint16 _memberPerformanceFee
            ) = (agent.memberManagementFee, agent.memberPerformanceFee);

            uint256 _totalFeeAmount = _calculateFee(baseAmount, baseAmount, _memberManagementFee, _memberPerformanceFee);

            emit DistributionStarted(agentId, _currentRound, _totalFeeAmount, baseAmount - _totalFeeAmount);

            uint256 _usersAmount = distributions.length;
            address _distributionToken = agent.depositToken == USDC_E ? USDC : agent.depositToken;
            uint256 _protocolFeeTotal = _usersAmount > 0 ? 0 : baseAmount;
            uint256 _totalShares;
            
            if (_usersAmount > 0) {
                uint256 _amountPerShare = baseAmount / totalShares;
                
                for (uint256 i; _usersAmount > i; i++) {
                    require(distributions[i].shares > 0, DockMarketSimpleRouter__IncorrectShares());

                    uint256 _baseAmount = _amountPerShare * distributions[i].shares;
                    uint256 _feeAmount = _calculateFee(_baseAmount, _baseAmount, _memberManagementFee, _memberPerformanceFee);

                    _protocolFeeTotal += _feeAmount;

                    IERC20(_distributionToken).safeTransfer(distributions[i].user, _baseAmount - _feeAmount);

                    _totalShares += distributions[i].shares;
                }

                round.totalShares = totalShares;
            }

            require(_totalShares == totalShares, DockMarketSimpleRouter__IncorrectShares());

            if (_protocolFeeTotal > 0) {
                IERC20(_distributionToken).safeTransfer($._protocolFeeReceiver, _protocolFeeTotal);
            }
        }

        agent.roundId += 1;

        _switchAgentState(agentId, AgentState.Preparation);
    }

    function startDistribution(bytes16 agentId, uint256 baseAmount, uint256 /* externalFeeAmount */) external {
        _validateAgentState(agentId, AgentState.Waiting);

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        uint256 _currentRound = agent.roundId;
        Round storage round = agent.rounds[_currentRound];

        require(msg.sender == agent.onchainAddress, DockMarketSimpleRouter__InvalidCaller());
        require(!agent.agentType.eq(_privateAgentType()), DockMarketSimpleRouter__IncorrectAgentType());

        _switchAgentState(agentId, AgentState.Distribution);

        if (baseAmount > 0) {
            IERC20(agent.depositToken).safeTransferFrom(msg.sender, address(this), baseAmount);

            if (agent.depositToken == USDC_E) {
                baseAmount = _swapOut(baseAmount, baseAmount * 9950 / BPS);
            }

            round.distributableAmount = baseAmount;

            uint256 _feeAmount = _calculateFee(round.deposited, baseAmount, agent.baseManagementFee, agent.basePerformanceFee);

            emit DistributionStarted(agentId, _currentRound, _feeAmount, baseAmount - _feeAmount);
        } else {
            round.lastIndex = round.users.length();
        }

        _distribute(agentId);
    }

    function distribute(bytes16 agentId) external {
        _distribute(agentId);
    }

    function _distribute(bytes16 agentId) internal {
        _validateAgentState(agentId, AgentState.Distribution);

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        Round storage round = agent.rounds[agent.roundId];

        uint256 _usersAmount = round.users.length();
        address _distributionToken = agent.depositToken == USDC_E ? USDC : agent.depositToken;
        uint256 _protocolFeeTotal = _usersAmount > 0 ? 0 : round.distributableAmount;
        
        if (round.lastIndex != _usersAmount) {
            (
                uint16 _baseManagementFee,
                uint16 _basePerformanceFee,
                uint16 _memberManagementFee,
                uint16 _memberPerformanceFee
            ) = ( 
                agent.baseManagementFee,
                agent.basePerformanceFee,
                agent.memberManagementFee,
                agent.memberPerformanceFee
            );

            uint256 _amountPerShare = round.distributableAmount / round.totalShares;
            address[] memory _users = round.users.values();

            for (uint256 i = round.lastIndex; _usersAmount > i; i++) {
                uint256 _baseAmount = round.shares[_users[i]] * _amountPerShare;
                uint256 _deposited = round.shares[_users[i]] * agent.sharePrice;
                uint256 _feeAmount;

                if (_getMembership(agentId, agent.roundId, _users[i])) {
                    _feeAmount = _calculateFee(_deposited, _baseAmount, _memberManagementFee, _memberPerformanceFee);
                } else {
                    _feeAmount = _calculateFee(_deposited, _baseAmount, _baseManagementFee, _basePerformanceFee);
                }

                _baseAmount -= _feeAmount;
                
                if (gasleft() >= TRANSFER_GAS_LIMIT) {
                    _protocolFeeTotal += _feeAmount;

                    IERC20(_distributionToken).safeTransfer(_users[i], _baseAmount);
                } else {
                    round.lastIndex = i;

                    if (_protocolFeeTotal > 0) {
                        IERC20(_distributionToken).safeTransfer($._protocolFeeReceiver, _protocolFeeTotal);
                    }

                    return;
                }
            }

            round.lastIndex = _usersAmount;
        }

        if (_protocolFeeTotal > 0) {
            IERC20(_distributionToken).safeTransfer($._protocolFeeReceiver, _protocolFeeTotal);
        }

        agent.roundId += 1;

        _switchAgentState(agentId, AgentState.Preparation);
    }

    function startDeposit(bytes16 agentId) external onlyRole(SCHEDULER_ROLE) {
        _validateAgentState(agentId, AgentState.Preparation);
        _switchAgentState(agentId, AgentState.Deposit);
    }

    function setProtocolFeeReceiver(address newProtocolFeeReceiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newProtocolFeeReceiver != address(0), DockMarketSimpleRouter__ZeroData());

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        $._protocolFeeReceiver = newProtocolFeeReceiver;

        emit ProtocolFeeReceiverSet(newProtocolFeeReceiver, msg.sender);
    }

    function setProtocolFeeConfig(
        bytes16 agentId, 
        uint16 newBaseManagementFee,
        uint16 newBasePerformanceFee,
        uint16 newMemberManagementFee,
        uint16 newMemberPerformanceFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        require(agent.roundId > 0, DockMarketSimpleRouter__IncorrectAgentState());
        require(BPS > newBaseManagementFee + newBasePerformanceFee, DockMarketSimpleRouter__ZeroData());
        require(BPS > newMemberManagementFee + newMemberPerformanceFee, DockMarketSimpleRouter__ZeroData());

        agent.baseManagementFee = newBaseManagementFee;
        agent.basePerformanceFee = newBasePerformanceFee;
        agent.memberManagementFee = newMemberManagementFee;
        agent.memberPerformanceFee = newMemberPerformanceFee;

        emit ProtocolFeeConfigSet(
            agentId,
            newBaseManagementFee,
            newBasePerformanceFee,
            newMemberManagementFee,
            newMemberPerformanceFee,
            msg.sender
        );
    }

    function setAgentMetadata(
        bytes16 agentId,
        string calldata newAgentName,
        string calldata newAgentType
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _validateAgentState(agentId, AgentState.Preparation);

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        require(bytes(newAgentName).length > 0, DockMarketSimpleRouter__ZeroData());
        require(bytes(newAgentType).length > 0, DockMarketSimpleRouter__ZeroData());

        agent.agentName = newAgentName;
        agent.agentType = newAgentType;

        emit AgentMetadataSet(agentId, newAgentName, newAgentType, msg.sender);
    }

    function setDepositConfig(
        bytes16 agentId, 
        uint256 newSharePrice,
        uint256 newBaseMinShares,
        uint256 newBaseMaxShares,
        uint256 newMemberMinShares,
        uint256 newMemberMaxShares,
        uint256 newSharesCap
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _validateAgentState(agentId, AgentState.Preparation);

        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        require(newSharePrice > 0, DockMarketSimpleRouter__ZeroData());
        require(newBaseMaxShares >= newBaseMinShares, DockMarketSimpleRouter__ZeroData());
        require(newMemberMaxShares >= newMemberMinShares, DockMarketSimpleRouter__ZeroData());
        require(newSharesCap > 0, DockMarketSimpleRouter__ZeroData());

        agent.sharePrice = newSharePrice;
        agent.baseMinShares = newBaseMinShares;
        agent.baseMaxShares = newBaseMaxShares;
        agent.memberMinShares = newMemberMinShares;
        agent.memberMaxShares = newMemberMaxShares;
        agent.sharesCap = newSharesCap;

        emit DepositConfigSet(
            agentId, 
            newSharePrice,
            newBaseMinShares,
            newBaseMaxShares,
            newMemberMinShares,
            newMemberMaxShares,
            newSharesCap,
            msg.sender
        );
    }
    
    function getAgentInfo(bytes16 agentId) external view returns(AgentInfo memory agentInfo) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        uint256 _currentRound = agent.roundId;
        Round storage round = agent.rounds[_currentRound];

        uint256 _usersAmount = round.users.length();

        return AgentInfo({
            currentState: agent.state,
            currentRound: _currentRound,
            agentName: agent.agentName,
            agentType: agent.agentType,
            depositToken: agent.depositToken,
            onchainAddress: agent.onchainAddress,
            creatorAddress: agent.creatorAddress,
            sharePrice: agent.sharePrice,
            baseMinShares: agent.baseMinShares,
            baseMaxShares: agent.baseMaxShares,
            memberMinShares: agent.memberMinShares,
            memberMaxShares: agent.memberMaxShares,
            sharesCap: agent.sharesCap,
            isDistributionEnded: agent.state == AgentState.Distribution ? round.lastIndex == _usersAmount : false,
            usersAmount: _usersAmount,
            totalShares: round.totalShares,
            depositedAmount: round.deposited,
            collectedAmount: round.distributableAmount,
            users: round.users.values()
        });
    }

    function getAgentInfoByRound(bytes16 agentId, uint256 roundId) external view returns(AgentInfoByRound memory agentInfo) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        Round storage round = agent.rounds[roundId];

        uint256 _usersAmount = round.users.length();
        bool _isDistributionEnded;

        if (roundId > 0) {
            if (agent.roundId > roundId) {
                _isDistributionEnded = true;
            } else if (agent.roundId == roundId) {
                _isDistributionEnded = agent.state == AgentState.Distribution ? round.lastIndex == _usersAmount : false;
            }
        }

        return AgentInfoByRound({
            isCurrentRound: agent.roundId == roundId,
            isDistributionEnded: _isDistributionEnded,
            usersAmount: _usersAmount,
            totalShares: round.totalShares,
            depositedAmount: round.deposited,
            collectedAmount: round.distributableAmount,
            users: round.users.values()
        });
    }

    function getUserInfo(bytes16 agentId, uint256 roundId, address user) external view returns(UserInfo memory userInfo) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        Round storage round = agent.rounds[roundId];
        uint256 _sharesPurchased = round.shares[user]; 
        uint256 _sharePrice = round.totalShares == 0 ? 0 : round.deposited / round.totalShares;

        return UserInfo({
            sharesPurchased: _sharesPurchased,
            deposited: _sharesPurchased * _sharePrice,
            collected: round.totalShares == 0 ? 0 : round.distributableAmount * _sharesPurchased / round.totalShares,
            tokenId: round.tokenIdUsedByUser[user],
            isMember: _getMembership(agentId, roundId, user)
        });
    }

    function getTokenIdUsed(bytes16 agentId, uint256 roundId, uint256 tokenId) external view returns(address tokenIdOwner) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        return agent.rounds[roundId].tokenIdUsed[tokenId];
    }

    function getProtocolFeeConfig(bytes16 agentId) external view returns(
        uint16 baseManagementFeeRate,
        uint16 basePerformanceFeeRate,
        uint16 memberManagementFeeRate,
        uint16 memberPerformanceFeeRate,
        address protocolFeeReceiverAddress
    ) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        return (
            agent.baseManagementFee,
            agent.basePerformanceFee,
            agent.memberManagementFee,
            agent.memberPerformanceFee,
            $._protocolFeeReceiver
        );
    }

    function contractName() public pure override returns(string memory thisContractName) {
        return "DockMarketSimpleRouter";
    }
 
    function supportsInterface(bytes4 interfaceId) public view override(AccessControlUpgradeable, UpgradeCheckerImplementation) returns(bool supported) {
        return 
            interfaceId == type(IDockMarketSimpleRouter).interfaceId || 
            AccessControlUpgradeable.supportsInterface(interfaceId) || 
            UpgradeCheckerImplementation.supportsInterface(interfaceId);
    }

    function _validateAgentState(bytes16 agentId, AgentState desiredState) internal view {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        require(agent.state == desiredState, DockMarketSimpleRouter__IncorrectAgentState());
    }

    function _getMembership(bytes16 agentId, uint256 roundId, address user) internal view returns(bool isMember) {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];
        Round storage round = agent.rounds[roundId];

        return user == address(0) ? false : round.tokenIdUsed[round.tokenIdUsedByUser[user]] == user;
    }

    function _calculateFee(
        uint256 deposited,
        uint256 baseAmount,
        uint256 managementFeeRate,
        uint256 performanceFeeRate
    ) internal pure returns(uint256 feeAmount) {
        feeAmount = baseAmount * managementFeeRate / BPS;

        if (baseAmount > deposited + feeAmount) {
            feeAmount += (baseAmount - deposited - feeAmount) * performanceFeeRate / BPS;
        }
    }

    function _privateAgentType() internal pure returns(string memory privateAgentType) {
        return "NFT Index fund";
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkOverall(newImplementation, InterfaceIdsRegistry.getInterfaceIds());
    }

    function _switchAgentState(bytes16 agentId, AgentState newState) internal {
        DockMarketSimpleRouterStorage storage $ = _getDockMarketSimpleRouterStorage();
        Agent storage agent = $._agents[agentId];

        agent.state = newState;
        
        emit AgentStateUpdated(agentId, newState, agent.roundId, msg.sender);
    }

    function _getDockMarketSimpleRouterStorage() private pure returns(DockMarketSimpleRouterStorage storage $) {
        assembly {
            $.slot := DOCKMARKET_SIMPLE_ROUTER_STORAGE_LOCATION
        }
    }
}