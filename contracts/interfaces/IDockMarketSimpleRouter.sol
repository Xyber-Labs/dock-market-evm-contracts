// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DockMarketStructs.sol";

import "../libraries/interfaces/ISwapper.sol";

interface IDockMarketSimpleRouter is ISwapper {

    function getAgentInfo(bytes16 agentId) external view returns(AgentInfo memory agentInfo);

    function getAgentInfoByRound(bytes16 agentId, uint256 roundId) external view returns(AgentInfoByRound memory agentInfo);

    function getUserInfo(bytes16 agentId, uint256 roundId, address user) external view returns(UserInfo memory userInfo);

    function getTokenIdUsed(bytes16 agentId, uint256 roundId, uint256 tokenId) external view returns(address tokenIdOwner);

    function getProtocolFeeConfig(bytes16 agentId) external view returns(
        uint16 baseManagementFeeRate,
        uint16 basePerformanceFeeRate,
        uint16 memberManagementFeeRate,
        uint16 memberPerformanceFeeRate,
        address protocolFeeReceiverAddress
    );

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
    ) external;

    function deposit(bytes16 agentId, uint256 shares, address receiver) external returns(uint256 deposited);

    function depositWithPermit( 
        bytes16 agentId,
        uint256 shares,
        address receiver,
        Permit calldata permit
    ) external returns(uint256 deposited);

    function depositMember(
        bytes16 agentId,
        uint256 shares,
        uint256 tokenId,
        bytes memory signature
    ) external returns(uint256 deposited);

    function depositWithSwap(bytes16 agentId, uint256 shares, address receiver) external returns(uint256 deposited);

    function startTrading(bytes16 agentId) external;

    function startWaiting(bytes16 agentId) external;

    function startPrivateDistribution(
        bytes16 agentId,
        uint256 baseAmount,
        uint256 totalShares,
        Distribution[] calldata distributions
    ) external;

    function startDistribution(bytes16 agentId, uint256 baseAmount, uint256 externalFeeAmount) external;

    function startDeposit(bytes16 agentId) external;

    function setProtocolFeeReceiver(address newProtocolFeeReceiver) external;

    function setProtocolFeeConfig(
        bytes16 agentId, 
        uint16 newBaseManagementFee,
        uint16 newBasePerformanceFee,
        uint16 newMemberManagementFee,
        uint16 newMemberPerformanceFee
    ) external;

    function setAgentMetadata(
        bytes16 agentId,
        string calldata newAgentName,
        string calldata newAgentType
    ) external;

    function setDepositConfig(
        bytes16 agentId, 
        uint256 newSharePrice,
        uint256 newBaseMinShares,
        uint256 newBaseMaxShares,
        uint256 newMemberMinShares,
        uint256 newMemberMaxShares,
        uint256 newSharesCap
    ) external;

    function distribute(bytes16 agentId) external;
    
}