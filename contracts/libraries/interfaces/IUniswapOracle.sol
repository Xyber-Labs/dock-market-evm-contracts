// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapOracle {

    function getAmountOut(address pool, address tokenIn, uint256 amountIn) external view returns(uint256 amountOut);

}