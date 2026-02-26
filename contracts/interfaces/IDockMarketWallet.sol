// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DockMarketStructs.sol";

interface IDockMarketWallet {

    function ROUTER() external view returns(address routerAddress);

    function WETH_ADDRESS() external view returns(address wethAddress);

    function owner() external view returns(address ownerAddress);

    function getAgentId() external view returns(uint256 agentId);

    function getAgentProfile() external view returns(AgentProfile memory agentProfile);

    function getBalances(address[] calldata tokens) external view returns(uint256[] memory balances);

    function totalDeposited(address token) external view returns(uint256 totalDepositedTokens);

    function initialize(address newOwner, uint256 newAgentId) external;

    function deposit(address holder, address token, uint256 amount) external returns(bool success);

    function withdraw(
        address token,
        address receiver,
        uint256 amountToWithdraw
    ) external returns(uint256 amount, uint256 feeAmount);

    function execute(Transaction[] calldata txs) external;

}