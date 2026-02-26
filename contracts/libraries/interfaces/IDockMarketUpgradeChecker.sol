// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDockMarketUpgradeChecker {

    function dockMarketContractName() external pure returns(string memory contractName);

}