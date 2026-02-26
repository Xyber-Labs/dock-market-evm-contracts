// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../DockMarketRouter.sol";

contract DockMarketRouterV2 is DockMarketRouter {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address uniswapOracle, 
        address walletBeacon, 
        address wethAddress, 
        address usdcAddress,
        address usdcWethUniswapPoolAddress
    ) DockMarketRouter(uniswapOracle, walletBeacon, wethAddress, usdcAddress, usdcWethUniswapPoolAddress, 50000) {

    }

    function initializeV2() public reinitializer(2) {

    }

    function newFunction() external pure returns(string memory) {
        return "New function in V2";
    }
}

contract DockMarketRouterV3 is DockMarketRouter {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address uniswapOracle, 
        address walletBeacon, 
        address wethAddress, 
        address usdcAddress,
        address usdcWethUniswapPoolAddress
    ) DockMarketRouter(uniswapOracle, walletBeacon, wethAddress, usdcAddress, usdcWethUniswapPoolAddress, 50000) {

    }

    function initializeV3() public reinitializer(3) {

    }

    function newFunction() external pure returns(string memory) {
        return "New function in V3";
    }

    function dockMarketContractName() public pure virtual override returns(string memory contractName) {
        return "foobar";
    }
}
