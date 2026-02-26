// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DockMarketStructs.sol";
import "../libraries/TeeDataTypes.sol";

interface IDockMarketRouter {
    
    function ETH_ADDRESS() external view returns(address ethAddress);
    
    function UNISWAP_ORACLE() external view returns(address uniswapOracleAddress);

    function WALLET_BEACON() external view returns(address walletBeaconAddress);

    function WETH_ADDRESS() external view returns(address wethAddress);

    function USDC_ADDRESS() external view returns(address usdcAddress);

    function USDC_WETH_UNISWAP_POOL() external view returns(address usdcWethUniswapPoolAddress);

    function getConfig() external view returns(
        address feeCollectorAddress,
        uint256 performanceFeeRateValue,
        uint256 managementFeeRateValue,
        uint256 maxDepositValueUSD
    );

    function getWalletAddress(address user, uint256 agentId) external view returns(address walletAddress, bool isDeployed);

    function getBalances(address user, uint256 agentId, address[] calldata tokens) external view returns(uint256[] memory balances);

    function totalDeposited(address user, uint256 agentId, address token) external view returns(uint256 totalDepositedTokens);

    function getOwnerByWallet(address walletAddress) external view returns(address owner, AgentProfile memory agentProfile);

    function getAgentProfile(uint256 agentId) external view returns(AgentProfile memory agentProfile);

    function usedSignature(bytes32 signatureHash) external view returns(bool isUsed);

    function createWallet(address user, uint256 agentId) external returns(address walletAddress);

    function deposit(
        address receiver,
        uint256 agentId,
        address token, 
        uint256 amount
    ) external payable returns(address walletAddress);

    function depositWithPermit( 
        address receiver,
        uint256 agentId,
        address token,
        Permit calldata permit
    ) external returns(address walletAddress);

    function withdraw(
        address user,
        uint256 agentId,
        address token,
        address receiver,
        uint256 amountToWithdraw
    ) external returns(address walletAddress);

    function execute(
        Transaction[] calldata txs,
        bytes calldata signature,
        uint256 deadline
    ) external payable;

    function initSessionKey(
        ChunkedX509Cert calldata leaf,
        ChunkedX509Cert calldata intermediate,
        ChunkedSGXQuote calldata quote,
        uint256 agentId,
        string calldata agentName,
        string calldata agentType,
        address onchainAddress,
        address creatorAddress
    ) external;

    function reinitSessionKey(
        ChunkedX509Cert calldata leaf,
        ChunkedX509Cert calldata intermediate,
        ChunkedSGXQuote calldata quote,
        uint256 agentId,
        address newOnchainAddress
    ) external;
    
    function setFeeCollector(address newFeeCollector) external;

    function setPerfomanceFeeRate(uint256 newPerfomanceFeeRate) external;

    function setManagementFeeRate(uint256 newManagementFeeRate) external;

    function setMaxDepositValue(uint256 newMaxDepositValue) external;

    function setMrEnclave(bytes32 mrEnclave, bool isAuthorized) external;

    function setPause(uint256 agentId, bool isPaused) external;

    function setCreatorAddress(uint256 agentId, address newCreatorAddress) external;

}