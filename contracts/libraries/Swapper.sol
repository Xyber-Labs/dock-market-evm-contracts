// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol";

import "./interfaces/ISwapper.sol";

contract Swapper is ISwapper {   
    using SafeERC20 for IERC20;

    address public immutable USDC;
    address public immutable USDC_E;
    address public immutable SWAP_ROUTER;

    error Swapper__DifferentDecimals();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address usdc, address usdcE, address swapRouter) {
        USDC = usdc;
        USDC_E = usdcE;
        SWAP_ROUTER = swapRouter;

        require(
            IERC20Metadata(usdc).decimals() == IERC20Metadata(usdcE).decimals(), 
            Swapper__DifferentDecimals()
        );
    }

    function _swapIn(uint256 amountIn, uint256 amountOutMin, address receiver) internal returns(uint256 amountOut) {
        amountOut = IV3SwapRouter(SWAP_ROUTER).exactInput(IV3SwapRouter.ExactInputParams({
            path: abi.encodePacked(USDC, uint24(100), USDC_E),
            recipient: address(this),
            amountIn: amountIn,
            amountOutMinimum: amountOutMin
        }));

        if (amountOut > amountIn) {
            IERC20(USDC_E).safeTransfer(receiver, amountOut - amountIn);
            amountOut = amountIn;
        }
    }

    function _swapOut(uint256 amountIn, uint256 amountOutMin) internal returns(uint256 amountOut) {
        return IV3SwapRouter(SWAP_ROUTER).exactInput(IV3SwapRouter.ExactInputParams({
            path: abi.encodePacked(USDC_E, uint24(100), USDC),
            recipient: address(this),
            amountIn: amountIn,
            amountOutMinimum: amountOutMin
        }));
    }
}