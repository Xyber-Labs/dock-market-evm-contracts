// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

import "solady/src/utils/LibString.sol";

import "./interfaces/IDockMarketUpgradeChecker.sol";

abstract contract DockMarketUpgradeChecker is IDockMarketUpgradeChecker {
    using LibString for *;

    error DockMarketUpgradeChecker__E0(); // invalid {newImplementation} contract

    function dockMarketContractName() public pure virtual returns(string memory contractName);

    function _checkContractType(address newImplementation) internal view virtual {
        require(
            IDockMarketUpgradeChecker(newImplementation).dockMarketContractName().eq(dockMarketContractName()), 
            DockMarketUpgradeChecker__E0()
        );

        require(IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId), DockMarketUpgradeChecker__E0());
    }
}