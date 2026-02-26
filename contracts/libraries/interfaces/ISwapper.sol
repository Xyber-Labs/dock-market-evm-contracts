// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISwapper {

    function USDC() external view returns(address usdcAddress);

    function USDC_E() external view returns(address usdcEAddress);

    function SWAP_ROUTER() external view returns(address swapRouterAddress);

}