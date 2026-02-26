// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../libraries/DockMarketUpgradeChecker.sol";

contract Mock is DockMarketUpgradeChecker {
    
    function dockMarketContractName() public pure override returns(string memory contractName) {
        return "Mock";
    }

}