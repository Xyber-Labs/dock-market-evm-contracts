// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";

import "./libraries/DockMarketUpgradeChecker.sol";

import "./interfaces/IDockMarketWallet.sol";

contract DockMarketWalletBeacon is IBeacon, DockMarketUpgradeChecker, Ownable2Step {
    using LibString for *;

    address public implementation;

    event Upgraded(address indexed newImplementation, address indexed caller);

    constructor(address initialOwner) Ownable(initialOwner) {

    }

    function upgradeTo(address _newImplementation) external onlyOwner() {
        _setImplementation(_newImplementation);
    }

    function dockMarketContractName() public pure override returns(string memory contractName) {
        return "DockMarketWalletBeacon";
    }

    function _setImplementation(address newImplementation) internal {
        _checkContractType(newImplementation);

        implementation = newImplementation;

        emit Upgraded(newImplementation, msg.sender);
    }

    function _checkContractType(address newImplementation) internal view override {
        require(
            IDockMarketUpgradeChecker(newImplementation).dockMarketContractName().eq("DockMarketWallet"), 
            DockMarketUpgradeChecker__E0()
        );

        require(IDockMarketWallet(newImplementation).owner() == address(0), DockMarketUpgradeChecker__E0());
    }
}
