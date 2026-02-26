// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@uniswap/v3-core-0.8/contracts/interfaces/IUniswapV3Pool.sol";

import "./OracleLibrary.sol";

import "./interfaces/IUniswapOracle.sol";

contract UniswapOracle is IUniswapOracle {
    using OracleLibrary for int24;

    function getAmountOut(address pool, address tokenIn, uint256 amountIn) external view override returns(uint256 amountOut) {
        (
            address _token0, 
            address _token1
        ) = (IUniswapV3Pool(pool).token0(), IUniswapV3Pool(pool).token1());

        (
            /* uint160 _sqrtPriceX96 */,
            int24 _tick,
            /* uint16 _observationIndex */,
            /* uint16 _observationCardinality */,
            /* uint16 _observationCardinalityNext */,
            /* uint8 _feeProtocol */,
            /* bool _unlocked */
        ) = IUniswapV3Pool(pool).slot0();

        return _tick.getQuoteAtTick(uint128(amountIn), tokenIn, tokenIn == _token0 ? _token1 : _token0);
    }

}