const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { DockMarketFixture } = require("./utils/DockMarketFixture");
const { expect } = require("chai");

describe("DockMarketWalletBeacon", function () {
    describe("_checkContractType()", function () {
        it("DockMarketUpgradeChecker E0", async function () {
            const { dockMarketWalletBeacon, admin, user, mock, userWallet } = await loadFixture(DockMarketFixture);

            expect(await dockMarketWalletBeacon.dockMarketContractName()).to.be.equal("DockMarketWalletBeacon");

            await expect(dockMarketWalletBeacon.connect(user).upgradeTo(
                mock.target
            )).to.be.revertedWithCustomError(dockMarketWalletBeacon, "OwnableUnauthorizedAccount");

            await expect(dockMarketWalletBeacon.connect(admin).upgradeTo(user.address)).to.be.reverted;

            await expect(dockMarketWalletBeacon.connect(admin).upgradeTo(
                mock.target
            )).to.be.revertedWithCustomError(dockMarketWalletBeacon, "DockMarketUpgradeChecker__E0");

            await expect(dockMarketWalletBeacon.connect(admin).upgradeTo(
                userWallet.target
            )).to.be.revertedWithCustomError(dockMarketWalletBeacon, "DockMarketUpgradeChecker__E0");
        });
    });
});