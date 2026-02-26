const {
    zeroAgentId, byteAgentId, agentName, agentTypeC, defaultManagementFeeRate, defaultPerformanceFeeRate, byteAgentId2, agentTypeI
} = require("./utils/GlobalConstants");
const { registerAgent, depositSimple, depositMemberSimple, zeroAddress, zeroHash, withDecimals } = require("./utils/DockMarketUtils");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { DockMarketFixture } = require("./utils/DockMarketFixture");
const { expect } = require("chai");

describe("DockMarketSimpleRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const {
                dockMarketSimpleRouter, admin, adminRole, managerRole, collector, depositorRole, schedulerRole, signerRole, usdc,
                usdp, swapRouter
            } = await loadFixture(DockMarketFixture);

            expect(await dockMarketSimpleRouter.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await dockMarketSimpleRouter.hasRole(managerRole, admin.address)).to.equal(true);
            expect(await dockMarketSimpleRouter.hasRole(depositorRole, admin.address)).to.equal(true);
            expect(await dockMarketSimpleRouter.hasRole(schedulerRole, admin.address)).to.equal(true);
            expect(await dockMarketSimpleRouter.hasRole(signerRole, admin.address)).to.equal(true);
            expect(await dockMarketSimpleRouter.USDC()).to.equal(usdc.target);
            expect(await dockMarketSimpleRouter.USDC_E()).to.equal(usdp.target);
            expect(await dockMarketSimpleRouter.SWAP_ROUTER()).to.equal(swapRouter.target);
            expect(await dockMarketSimpleRouter.getTokenIdUsed(zeroAgentId, 0n, 0n)).to.equal(zeroAddress);
            expect(await dockMarketSimpleRouter.getProtocolFeeConfig(zeroAgentId)).to.eql([
                0n,
                0n,
                0n,
                0n,
                collector.address
            ]);
            expect(await dockMarketSimpleRouter.getAgentInfo(zeroAgentId)).to.eql([
                0n,
                0n,
                "",
                "",
                zeroAddress,
                zeroAddress,
                zeroAddress,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);
            expect(await dockMarketSimpleRouter.getAgentInfoByRound(zeroAgentId, 0n)).to.eql([true, false, 0n, 0n, 0n, 0n, []]);
            expect(await dockMarketSimpleRouter.getUserInfo(zeroAgentId, 0n, zeroAddress)).to.eql([0n, 0n, 0n, 0n, false]);
            expect(await dockMarketSimpleRouter.dockMarketContractName()).to.equal("DockMarketSimpleRouter");
            expect(await dockMarketSimpleRouter.supportsInterface("0x993c319f")).to.equal(true);
            expect(await dockMarketSimpleRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await dockMarketSimpleRouter.supportsInterface("0x7965db0b")).to.equal(true);
            expect(await usdc.allowance(dockMarketSimpleRouter.target, swapRouter.target)).to.equal(ethers.MaxUint256);
            expect(await usdp.allowance(dockMarketSimpleRouter.target, swapRouter.target)).to.equal(ethers.MaxUint256);
        });

        it("Proxy", async function () {
            const {
                admin, user, dockMarketRouter, dockMarketSimpleRouter, dockMarketSimpleRouterImplementation, mainToken, mock, usdc
            } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");

            await expect(dockMarketSimpleRouter.connect(user).initialize(
                user.address
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "InvalidInitialization");

            await expect(dockMarketSimpleRouter.connect(user).initializeV2(
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "InvalidInitialization");

            await expect(dockMarketSimpleRouter.connect(user).initializeV3(
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "InvalidInitialization");

            await expect(dockMarketSimpleRouter.connect(admin).upgradeToAndCall(mainToken.target, "0x")).to.be.revertedWithoutReason();

            await expect(dockMarketSimpleRouter.connect(admin).upgradeToAndCall(
                dockMarketRouter.target,
                "0x"
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketUpgradeChecker__E0");

            await expect(dockMarketSimpleRouter.connect(admin).upgradeToAndCall(
                mock.target,
                "0x"
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketUpgradeChecker__E0");

            const dockMarketSimpleRouterV2 = await ethers.getContractFactory("DockMarketSimpleRouter", admin);

            await expect(dockMarketSimpleRouterV2.deploy(0n, mock.target, mock.target, mock.target)
            ).to.be.revertedWithoutReason();

            await expect(dockMarketSimpleRouterV2.deploy(0n, usdc.target, mainToken.target, mock.target)
            ).to.be.revertedWithCustomError(dockMarketSimpleRouter, "Swapper__DifferentDecimals");

            await expect(dockMarketSimpleRouterImplementation.initializeV2()
            ).to.be.revertedWithCustomError(dockMarketSimpleRouter, "InvalidInitialization");

            await expect(dockMarketSimpleRouterImplementation.initializeV3()
            ).to.be.revertedWithCustomError(dockMarketSimpleRouter, "InvalidInitialization");
        });
    });

    describe("registerAgent()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("Success");

            const result1 = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result1).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__ZeroData: agentId", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                zeroAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: agentId");
        });

        it("DockMarketSimpleRouter__ZeroData: agentName", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                "",
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: agentName");
        });

        it("DockMarketSimpleRouter__ZeroData: agentType", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                "",
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: agentType");
        });

        it("DockMarketSimpleRouter__ZeroData: depositToken", async function () {
            const { dockMarketSimpleRouter, admin, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                zeroAddress,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: depositToken");

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock", admin);
            const token = await ERC20Mock.deploy(18);
            await token.waitForDeployment();

            await token.connect(admin).burn(await token.balanceOf(admin.address));

            expect(await token.totalSupply()).to.equal(0n);

            const result2 = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                token.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result2).to.equal("DockMarketSimpleRouter__ZeroData: depositToken 2");
        });

        it("DockMarketSimpleRouter__ZeroData: onchainAddress", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                zeroAddress,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: onchainAddress");
        });

        it("DockMarketSimpleRouter__ZeroData: sharePrice", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                0n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: sharePrice");
        });

        it("DockMarketSimpleRouter__ZeroData: baseShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                2n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: baseShares");
        });

        it("DockMarketSimpleRouter__ZeroData: memberShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                2n,
                1n,
                1n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: memberShares");
        });

        it("DockMarketSimpleRouter__ZeroData: sharesCap", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                0n
            );

            expect(result).to.equal("DockMarketSimpleRouter__ZeroData: sharesCap");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                1n,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("Success");
        });
    });

    describe("deposit()", function () {
        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            const result = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__ZeroData: receiver zero address", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                2n,
                2n,
                2n,
                2n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                zeroAddress
            );

            expect(result1).to.equal("DockMarketSimpleRouter__ZeroData: receiver zero address");
        });

        it("DockMarketSimpleRouter__ZeroData: zero shares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                2n,
                2n,
                2n,
                2n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                0n,
                user.address
            );

            expect(result1).to.equal("DockMarketSimpleRouter__ZeroData: zero shares");
        });

        it("DockMarketSimpleRouter__DepositCapacityUnachieved: baseShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                2n,
                2n,
                2n,
                2n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("DockMarketSimpleRouter__DepositCapacityUnachieved: baseShares");
        });

        it("DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                2n,
                2n,
                2n,
                2n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result1).to.equal("DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares");
        });

        it("DockMarketSimpleRouter__DepositCapacityExceeded: baseShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result2).to.equal("DockMarketSimpleRouter__DepositCapacityExceeded: baseShares");
        });

        it("DockMarketSimpleRouter__DepositCapacityExceeded: totalShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, user2 } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                1n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount * 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            const result3 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user2.address
            );

            expect(result3).to.equal("DockMarketSimpleRouter__DepositCapacityExceeded: totalShares");
        });

        it("DepositToken__ERC20InsufficientAllowance", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                1n,
                1n
            );

            expect(result).to.equal("Success");

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("DepositToken__ERC20InsufficientAllowance");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                1n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");
        });
    });

    describe("depositMember()", function () {
        it("DockMarketSimpleRouter__InvalidCaller", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            const result = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                user
            );

            expect(result).to.equal("DockMarketSimpleRouter__InvalidCaller");
        });

        it("DockMarketSimpleRouter__TokenIdUsed", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, user2 } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;
            const memberDepositAmount = depositAmount * 2n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, memberDepositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, memberDepositAmount);

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result1).to.equal("Success");

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user2,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result2).to.equal("DockMarketSimpleRouter__TokenIdUsed");
        });

        it("DockMarketSimpleRouter__MembershipIssued", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, user2 } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;
            const memberDepositAmount = depositAmount * 2n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, memberDepositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, memberDepositAmount);

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result1).to.equal("Success");

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                2n,
                admin
            );

            expect(result2).to.equal("DockMarketSimpleRouter__MembershipIssued");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, user, admin } = await loadFixture(DockMarketFixture);

            const result = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__ZeroData: zero shares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                2n,
                2n,
                2n,
                2n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount + 1n);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount + 1n);

            const result0 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                0n,
                1n,
                admin
            );

            expect(result0).to.equal("DockMarketSimpleRouter__ZeroData");
        });

        it("DockMarketSimpleRouter__DepositCapacityExceeded: memberShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount + 1n);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount + 1n);

            const result0 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                3n,
                1n,
                admin
            );

            expect(result0).to.equal("DockMarketSimpleRouter__DepositCapacityExceeded: memberShares");

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                2n,
                user.address
            );

            expect(result2).to.equal("DockMarketSimpleRouter__DepositCapacityExceeded: memberShares");
        });

        it("DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                2n,
                2n,
                3n,
                3n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount + 1n);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount + 1n);

            const result0 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result0).to.equal("DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares");

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                2n,
                1n,
                admin
            );

            expect(result1).to.equal("DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares");
        });

        it("DockMarketSimpleRouter__DepositCapacityExceeded: totalShares", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, user2, agent } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;
            const memberDeposit = depositAmount * 2n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                10n,
                1n,
                10n,
                5n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, memberDeposit);
            await usdc.connect(admin).transfer(user2.address, memberDeposit);
            await usdc.connect(admin).transfer(agent.address, memberDeposit);

            await usdc.connect(agent).approve(dockMarketSimpleRouter.target, memberDeposit);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, memberDeposit);
            await usdc.connect(user2).approve(dockMarketSimpleRouter.target, memberDeposit);

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                2n,
                1n,
                admin
            );

            expect(result1).to.equal("Success");

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user2,
                byteAgentId,
                2n,
                2n,
                admin
            );

            expect(result2).to.equal("Success");

            const result3 = await depositMemberSimple(
                dockMarketSimpleRouter,
                agent,
                byteAgentId,
                2n,
                3n,
                admin
            );

            expect(result3).to.equal("DockMarketSimpleRouter__DepositCapacityExceeded: totalShares");

            const result4 = await depositMemberSimple(
                dockMarketSimpleRouter,
                agent,
                byteAgentId,
                3n,
                3n,
                admin
            );

            expect(result4).to.equal("DockMarketSimpleRouter__DepositCapacityExceeded: totalShares");
        });

        it("DepositToken__ERC20InsufficientAllowance", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result1).to.equal("DepositToken__ERC20InsufficientAllowance");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, user2, agent } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;
            const memberDeposit = depositAmount * 10n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                2n,
                1n,
                10n,
                15n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, memberDeposit);
            await usdc.connect(admin).transfer(agent.address, memberDeposit);
            await usdc.connect(admin).transfer(user2.address, memberDeposit);

            await usdc.connect(user).approve(dockMarketSimpleRouter.target, memberDeposit);
            await usdc.connect(user2).approve(dockMarketSimpleRouter.target, memberDeposit);
            await usdc.connect(agent).approve(dockMarketSimpleRouter.target, memberDeposit);

            const result1 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                3n,
                1n,
                admin
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                user2,
                byteAgentId,
                2n,
                user2.address
            );

            expect(result2).to.equal("Success");

            const result3 = await depositMemberSimple(
                dockMarketSimpleRouter,
                agent,
                byteAgentId,
                10n,
                2n,
                admin
            );

            expect(result3).to.equal("Success");
        });
    });

    describe("depositWithPermit()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).depositWithPermit(
                byteAgentId,
                1n,
                user.address,
                [
                    user.address,
                    1_000000n,
                    4102444800n,
                    0n,
                    zeroHash,
                    zeroHash
                ]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, user, permitToken } = await loadFixture(DockMarketFixture);

            const amount = withDecimals("10");

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                permitToken.target,
                admin.address,
                admin.address,
                amount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            const deadline = 4102444800n;

            await permitToken.connect(admin).mint(user.address, amount);

            const nonce = await permitToken.nonces(user.address);
            const domain = {
                name: await permitToken.name(),
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: permitToken.target,
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const values = {
                owner: user.address,
                spender: dockMarketSimpleRouter.target,
                value: amount,
                nonce,
                deadline,
            };

            const signature = await user.signTypedData(domain, types, values);
            const { v, r, s } = ethers.Signature.from(signature);

            const permit = {
                holder: user.address,
                amount,
                deadline,
                v, r, s,
            };

            await expect(dockMarketSimpleRouter.connect(admin).depositWithPermit(
                byteAgentId,
                1n,
                user.address,
                permit
            )).to.emit(permitToken, "Approval").withArgs(
                user.address,
                dockMarketSimpleRouter.target,
                amount
            ).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                user.address,
                user.address,
                byteAgentId,
                1n,
                permitToken.target,
                amount
            ).to.emit(permitToken, "Transfer").withArgs(
                user.address,
                dockMarketSimpleRouter.target,
                amount
            );
        });

        it("Success with failed permit call", async function () {
            const { dockMarketSimpleRouter, admin, user, permitToken } = await loadFixture(DockMarketFixture);

            const amount = withDecimals("10");

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                permitToken.target,
                admin.address,
                admin.address,
                amount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            const deadline = 4102444800n;

            await permitToken.connect(admin).mint(user.address, amount);

            const nonce = await permitToken.nonces(user.address);
            const domain = {
                name: await permitToken.name(),
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: permitToken.target,
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const values = {
                owner: user.address,
                spender: dockMarketSimpleRouter.target,
                value: amount,
                nonce,
                deadline,
            };

            const signature = await user.signTypedData(domain, types, values);
            const { v, r, s } = ethers.Signature.from(signature);

            const permit = {
                holder: user.address,
                amount,
                deadline,
                v, r: zeroHash, s,
            };

            await permitToken.connect(user).approve(dockMarketSimpleRouter.target, amount);

            await expect(dockMarketSimpleRouter.connect(admin).depositWithPermit(
                byteAgentId,
                1n,
                user.address,
                permit
            )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                user.address,
                user.address,
                byteAgentId,
                1n,
                permitToken.target,
                amount
            ).to.emit(permitToken, "Transfer").withArgs(
                user.address,
                dockMarketSimpleRouter.target,
                amount
            ).to.not.emit(permitToken, "Approval");
        });
    });

    describe("depositWithSwap()", function () {
        it("DockMarketSimpleRouter__InvalidDepositToken", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                2n,
                1n,
                1n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            await expect(dockMarketSimpleRouter.connect(user).depositWithSwap(
                byteAgentId,
                1n,
                user.address
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidDepositToken");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, usdp, swapRouter, usdcUsdpPool } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdp.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                2n,
                1n,
                1n,
                2n
            );

            expect(result).to.equal("Success");

            await usdp.connect(admin).transfer(user.address, depositAmount);
            await usdp.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);

            await usdc.connect(admin).approve(swapRouter.target, ethers.MaxUint256);

            await swapRouter.connect(admin).exactInputSingle([
                usdc.target,
                usdp.target,
                100n,
                admin.address,
                2000_000000n,
                0n,
                0n
            ]);

            const usdcUserBalanceBefore = await usdc.balanceOf(user.address);
            const usdpUserBalanceBefore = await usdp.balanceOf(user.address);
            const usdcRouterBalanceBefore = await usdc.balanceOf(dockMarketSimpleRouter.target);
            const usdpRouterBalanceBefore = await usdp.balanceOf(dockMarketSimpleRouter.target);

            await expect(dockMarketSimpleRouter.connect(user).depositWithSwap(
                byteAgentId,
                1n,
                user.address
            )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                user.address,
                user.address,
                byteAgentId,
                1n,
                usdp.target,
                depositAmount
            ).to.emit(usdc, "Transfer").withArgs(
                user.address,
                dockMarketSimpleRouter.target,
                depositAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            );

            expect(usdcUserBalanceBefore - depositAmount).to.equal(await usdc.balanceOf(user.address));
            expect(usdpUserBalanceBefore).to.equal(await usdp.balanceOf(user.address));
            expect(usdcRouterBalanceBefore).to.equal(await usdc.balanceOf(dockMarketSimpleRouter.target));
            expect(usdpRouterBalanceBefore + depositAmount).to.closeTo(await usdp.balanceOf(dockMarketSimpleRouter.target), 5_0000n);
            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId))[16]).to.closeTo(depositAmount * 2n, 5_0000n);
        });
    });

    describe("startTrading()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).startTrading(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount * 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount * 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                2n,
                1n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                2n,
                2n,
                depositAmount * 2n,
                0n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                true,
                false,
                2n,
                2n,
                depositAmount * 2n,
                0n,
                [user.address, admin.address]
            ]);
        });
    });

    describe("startWaiting()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).startWaiting(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount * 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                3n,
                1n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                2n,
                2n,
                depositAmount * 2n,
                0n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                true,
                false,
                2n,
                2n,
                depositAmount * 2n,
                0n,
                [user.address, admin.address]
            ]);
        });
    });

    describe("startDistribution()", function () {
        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 0n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 0n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__InvalidCaller", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount * 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(user).startDistribution(
                byteAgentId, 0n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector, user2, agent } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                3n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                0n,
                0n
            );

            await usdc.connect(admin).mint(user2.address, depositAmount);
            await usdc.connect(admin).mint(agent.address, depositAmount);
            await usdc.connect(admin).mint(user.address, depositAmount * 10n);

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(user2).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(agent).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount * 10n);

            await dockMarketSimpleRouter.connect(user2).deposit(byteAgentId, 1n, user2.address);
            await dockMarketSimpleRouter.connect(agent).deposit(byteAgentId, 1n, agent.address);

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result2).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(user).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await dockMarketSimpleRouter.connect(user).startDistribution(byteAgentId, depositAmount * 5n, 0n);

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(2n);
            expect(await usdc.balanceOf(user.address)).to.equal(86_666666n);
            expect(await usdc.balanceOf(user2.address)).to.equal(16_175000n);
            expect(await usdc.balanceOf(agent.address)).to.equal(16_175000n);
            expect(await usdc.balanceOf(collector.address)).to.equal(983332n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                3n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");

            await dockMarketSimpleRouter.connect(admin).startDeposit(byteAgentId);

            const depositResult2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult2).to.equal("Success");
        });

        it("Success usdp", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, usdp, swapRouter, usdcUsdpPool } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdp.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                5n,
                1n,
                5n,
                10n
            );

            expect(result).to.equal("Success");

            await usdp.connect(admin).transfer(user.address, depositAmount);
            await usdp.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(admin).approve(swapRouter.target, ethers.MaxUint256);

            await swapRouter.connect(admin).exactInputSingle([
                usdc.target,
                usdp.target,
                100n,
                admin.address,
                2000_000000n,
                0n,
                0n
            ]);

            const usdcUserBalanceBefore = await usdc.balanceOf(user.address);
            const usdpUserBalanceBefore = await usdp.balanceOf(user.address);
            const usdcRouterBalanceBefore = await usdc.balanceOf(dockMarketSimpleRouter.target);
            const usdpRouterBalanceBefore = await usdp.balanceOf(dockMarketSimpleRouter.target);

            await expect(dockMarketSimpleRouter.connect(user).depositWithSwap(
                byteAgentId,
                1n,
                user.address
            )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                user.address,
                user.address,
                byteAgentId,
                1n,
                usdp.target,
                depositAmount
            ).to.emit(usdc, "Transfer").withArgs(
                user.address,
                dockMarketSimpleRouter.target,
                depositAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            );

            expect(usdcUserBalanceBefore - depositAmount).to.equal(await usdc.balanceOf(user.address));
            expect(usdpUserBalanceBefore).to.equal(await usdp.balanceOf(user.address));
            expect(usdcRouterBalanceBefore).to.equal(await usdc.balanceOf(dockMarketSimpleRouter.target));
            expect(usdpRouterBalanceBefore + depositAmount).to.closeTo(await usdp.balanceOf(dockMarketSimpleRouter.target), 5_0000n);
            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId))[16]).to.closeTo(depositAmount * 2n, 5_0000n);

            await expect(dockMarketSimpleRouter.connect(admin).depositWithSwap(
                byteAgentId,
                5n,
                admin.address
            )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                admin.address,
                admin.address,
                byteAgentId,
                1n,
                usdp.target,
                depositAmount * 5n
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                depositAmount * 5n
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            );

            const usdpRouterBalance = await usdp.balanceOf(dockMarketSimpleRouter.target);

            expect(usdpRouterBalanceBefore + depositAmount * 6n).to.closeTo(usdpRouterBalance, 3_00000n);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                usdpRouterBalance
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 157_000000n, 100000000000000n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                157_000000n
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                157606883n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                45_030538n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                112_576345n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);
            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);
        });

        it("Success usdp with fee", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, usdp, swapRouter, usdcUsdpPool, collector } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdp.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                5n,
                1n,
                5n,
                10n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                defaultManagementFeeRate / 2n,
                defaultPerformanceFeeRate / 2n
            );

            await usdp.connect(admin).transfer(user.address, depositAmount);
            await usdp.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(admin).approve(swapRouter.target, ethers.MaxUint256);

            await swapRouter.connect(admin).exactInputSingle([
                usdc.target,
                usdp.target,
                100n,
                admin.address,
                2000_000000n,
                0n,
                0n
            ]);

            const usdcUserBalanceBefore = await usdc.balanceOf(user.address);
            const usdpUserBalanceBefore = await usdp.balanceOf(user.address);
            const usdcRouterBalanceBefore = await usdc.balanceOf(dockMarketSimpleRouter.target);
            const usdpRouterBalanceBefore = await usdp.balanceOf(dockMarketSimpleRouter.target);

            await expect(dockMarketSimpleRouter.connect(user).depositWithSwap(
                byteAgentId,
                1n,
                user.address
            )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                user.address,
                user.address,
                byteAgentId,
                1n,
                usdp.target,
                depositAmount
            ).to.emit(usdc, "Transfer").withArgs(
                user.address,
                dockMarketSimpleRouter.target,
                depositAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            );

            expect(usdcUserBalanceBefore - depositAmount).to.equal(await usdc.balanceOf(user.address));
            expect(usdpUserBalanceBefore).to.equal(await usdp.balanceOf(user.address));
            expect(usdcRouterBalanceBefore).to.equal(await usdc.balanceOf(dockMarketSimpleRouter.target));
            expect(usdpRouterBalanceBefore + depositAmount).to.closeTo(await usdp.balanceOf(dockMarketSimpleRouter.target), 5_0000n);
            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId))[16]).to.closeTo(depositAmount * 2n, 5_0000n);

            await expect(dockMarketSimpleRouter.connect(admin).depositWithSwap(
                byteAgentId,
                5n,
                admin.address
            )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
                admin.address,
                admin.address,
                byteAgentId,
                1n,
                usdp.target,
                depositAmount * 5n
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                depositAmount * 5n
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            );

            const usdpRouterBalance = await usdp.balanceOf(dockMarketSimpleRouter.target);

            expect(usdpRouterBalanceBefore + depositAmount * 6n).to.closeTo(usdpRouterBalance, 3_00000n);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                usdpRouterBalance
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 157_000000n, 100000000000000n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                157_000000n
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                5_890049n,
                151_716834n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                43_351222n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                108_378053n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                5_877608n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);
            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);
        });

        it("Success with low gas", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                defaultManagementFeeRate / 2n,
                defaultPerformanceFeeRate / 2n,
            );

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 105_000000n, 100000000000000n, { gasLimit: 200000n }
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                105_000000n
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                5_247500n,
                99_752500n
            );

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                4n,
                1n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                2n,
                2n,
                depositAmount * 2n,
                105_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                true,
                false,
                2n,
                2n,
                depositAmount * 2n,
                105_000000n,
                [user.address, admin.address]
            ]);

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(105_000000n);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                49_876250n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                49_876250n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                5_247500n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                user.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                105_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success with insufficient gas", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                0n,
                0n
            );

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 105_000000n, 100000000000000n, { gasLimit: 290000n }
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                105_000000n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                49_876250n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                2_623750n
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                5_247500n,
                99_752500n
            );

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                4n,
                1n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                2n,
                2n,
                depositAmount * 2n,
                105_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                true,
                false,
                2n,
                2n,
                depositAmount * 2n,
                105_000000n,
                [user.address, admin.address]
            ]);

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(52_500000n);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                49_876250n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                2_623750n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                user.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                105_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success with members", async function () {
            const { dockMarketSimpleRouter, admin, usdc, weth, user, collector, user2, agent, agent2, agent3 } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                15n,
                1n,
                15n,
                100n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                defaultManagementFeeRate / 2n,
                defaultPerformanceFeeRate / 2n
            );

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdc.connect(user2).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdc.connect(agent).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdc.connect(agent2).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await usdc.connect(agent3).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await weth.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);
            await weth.connect(collector).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await weth.connect(admin).deposit({ value: withDecimals("100") });
            await weth.connect(admin).transfer(collector.address, depositAmount * 2n);

            await usdc.connect(admin).transfer(user.address, depositAmount);
            await usdc.connect(admin).transfer(user2.address, depositAmount * 7n);
            await usdc.connect(admin).transfer(agent.address, depositAmount * 3n);
            await usdc.connect(admin).transfer(agent2.address, depositAmount * 3n);
            await usdc.connect(admin).transfer(agent3.address, depositAmount * 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user2,
                byteAgentId,
                7n,
                1n,
                admin
            );

            expect(result2).to.equal("Success");

            const result3 = await depositSimple(
                dockMarketSimpleRouter,
                agent,
                byteAgentId,
                3n,
                agent.address
            );

            expect(result3).to.equal("Success");

            const resultNewAgent = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId2,
                "agentName",
                "agentTypeC",
                weth.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                15n,
                1n,
                15n,
                100n
            );

            expect(resultNewAgent).to.equal("Success");

            const resultNewAgent1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId2,
                4n,
                user.address
            );

            expect(resultNewAgent1).to.equal("Success");

            const resultNewAgent2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                collector,
                byteAgentId2,
                2n,
                2n,
                admin
            );

            expect(resultNewAgent2).to.equal("Success");

            const result4 = await depositMemberSimple(
                dockMarketSimpleRouter,
                agent2,
                byteAgentId,
                3n,
                3n,
                admin
            );

            expect(result4).to.equal("Success");

            const resultNewAgent3 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId2,
                1n,
                agent3.address
            );

            expect(resultNewAgent3).to.equal("Success");

            const result5 = await depositSimple(
                dockMarketSimpleRouter,
                agent3,
                byteAgentId,
                2n,
                agent3.address
            );

            expect(result5).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 16n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 105_000000n, 5_000000n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                105_000000n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                6_496875n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user2.address,
                45_707813n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                agent.address,
                19_490625n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                agent2.address,
                19_589063n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                agent3.address,
                12_993750n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                721874n
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                1_050000n,
                103_950000n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                15n,
                1n,
                15n,
                100n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                5n,
                16n,
                depositAmount * 16n,
                105_000000n,
                [user.address, user2.address, agent.address, agent2.address, agent3.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success without deposits", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, depositAmount, 0n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                depositAmount
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                depositAmount
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                depositAmount
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                0n,
                0n,
                depositAmount,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success 0 & 0", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 0n, 0n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            ).to.not.emit(usdc, "Transfer").to.not.emit(dockMarketSimpleRouter, "DistributionStarted");

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                0n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success >0 & 0", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                defaultManagementFeeRate / 2n,
                defaultPerformanceFeeRate / 2n
            );

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            const agentInfo = await dockMarketSimpleRouter.getAgentInfo(byteAgentId);
            const userInfo = await dockMarketSimpleRouter.getUserInfo(byteAgentId, agentInfo[1], user.address);
            const feeInfo = await dockMarketSimpleRouter.getProtocolFeeConfig(byteAgentId);

            const amountPerShare = 100_000000n / agentInfo.totalShares;
            const deposited = userInfo.sharesPurchased * agentInfo.sharePrice;
            let amount = userInfo.sharesPurchased * amountPerShare;

            let feeAmount = 0n;

            if (!userInfo.isMember) {
                feeAmount = amount * feeInfo.baseManagementFeeRate / 10000n;

                if (amount - feeAmount > deposited) {
                    feeAmount += (amount - feeAmount - deposited) * feeInfo.basePerformanceFeeRate / 10000n;
                }

                amount -= feeAmount;
            }

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 100_000000n, 0n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                100_000000n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                amount,
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                amount
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                feeAmount * 2n
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                4_950000n,
                95_050000n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                100_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success >0 & 0 zero fee", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            const agentInfo = await dockMarketSimpleRouter.getAgentInfo(byteAgentId);
            const userInfo = await dockMarketSimpleRouter.getUserInfo(byteAgentId, agentInfo[1], user.address);
            const feeInfo = await dockMarketSimpleRouter.getProtocolFeeConfig(byteAgentId);

            const amountPerShare = 100_000000n / agentInfo.totalShares;
            const deposited = userInfo.sharesPurchased * agentInfo.sharePrice;
            let amount = userInfo.sharesPurchased * amountPerShare;

            let feeAmount = 0n;

            if (!userInfo.isMember) {
                feeAmount = amount * feeInfo.baseManagementFeeRate / 10000n;

                if (amount - feeAmount > deposited) {
                    feeAmount += (amount - feeAmount - deposited) * feeInfo.basePerformanceFeeRate / 10000n;
                }

                amount -= feeAmount;
            }

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 100_000000n, 0n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                100_000000n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                amount
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                amount
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                100_000000n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                100_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success >0 & >0", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                defaultManagementFeeRate / 2n,
                defaultPerformanceFeeRate / 2n,
            );

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            const agentInfo = await dockMarketSimpleRouter.getAgentInfo(byteAgentId);
            const userInfo = await dockMarketSimpleRouter.getUserInfo(byteAgentId, agentInfo[1], user.address);
            const feeInfo = await dockMarketSimpleRouter.getProtocolFeeConfig(byteAgentId);

            const amountPerShare = 177_000000n / agentInfo.totalShares;
            const deposited = userInfo.sharesPurchased * agentInfo.sharePrice;
            let amount = userInfo.sharesPurchased * amountPerShare;

            let feeAmount = 0n;

            if (!userInfo.isMember) {
                feeAmount = amount * feeInfo.baseManagementFeeRate / 10000n;

                if (amount - feeAmount > deposited) {
                    feeAmount += (amount - feeAmount - deposited) * feeInfo.basePerformanceFeeRate / 10000n;
                }

                amount -= feeAmount;
            }

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 177_000000n, 5_000000n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                177_000000n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                amount
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                amount
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                feeAmount * 2n
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                9_531500n,
                167_468500n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                177_000000n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success 0 & >0", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("Success");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(result2).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                admin.address,
                depositAmount * 2n
            );

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 0n, 5_000000n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            ).to.not.emit(dockMarketSimpleRouter, "DistributionStarted").to.not.emit(usdc, "Transfer");

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                2n,
                2n,
                depositAmount * 2n,
                0n,
                [user.address, admin.address]
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });
    });

    describe("startPrivateDistribution()", function () {
        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, user, user2, usdcUsdpPool, swapRouter } = await loadFixture(DockMarketFixture);

            const baseAmount = 100_000000n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                baseAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                99_980002n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                33_326667n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user2.address,
                66_653334n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.closeTo(0n, 50n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                3n,
                0n,
                99_980002n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__InvalidCaller", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, user, user2 } = await loadFixture(DockMarketFixture);

            const baseAmount = 100_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(user).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");

            await expect(dockMarketSimpleRouter.connect(user2).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");
        });

        it("DockMarketSimpleRouter__IncorrectShares", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, user, user2 } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer").to.not.emit(usdp, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            const baseAmount = 100_000000n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                4n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectShares");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                2n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(usdc, "ERC20InsufficientBalance");

            await usdc.connect(admin).transfer(dockMarketSimpleRouter.target, 1000_000000n);

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                2n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectShares");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                1n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectShares");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                1n,
                []
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectShares");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                0n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.be.revertedWithPanic("0x12");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                0n,
                [[user.address, 0n], [user2.address, 0n]]
            )).to.be.revertedWithPanic("0x12");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                1n,
                [[user.address, 0n], [user2.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectShares");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                1n,
                [[user.address, 1n], [user2.address, 0n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectShares");
        });

        it("Success zero base amount", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, user, user2, usdcUsdpPool } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            const baseAmount = 0n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            ).to.not.emit(usdp, "Transfer").to.not.emit(usdcUsdpPool, "Swap").to.not.emit(dockMarketSimpleRouter, "DistributionStarted").to.not.emit(usdc, "Transfer");

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);
        });

        it("Success same distribution token", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, user2, usdcUsdpPool, usdp } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            const baseAmount = 100_000000n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                baseAmount
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                baseAmount
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                33_333333n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user2.address,
                66_666666n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            ).to.not.emit(usdcUsdpPool, "Swap").to.not.emit(usdp, "Transfer");

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.closeTo(0n, 50n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                3n,
                0n,
                baseAmount,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success with fee", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, user, user2, usdcUsdpPool, swapRouter, collector } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate
            );

            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            const baseAmount = 100_000000n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                baseAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                999800n,
                98_980202n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                32_993401n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user2.address,
                65_986801n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                999799n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.closeTo(0n, 50n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                3n,
                0n,
                99_980002n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("Success without users", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, usdcUsdpPool, swapRouter, collector } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            const baseAmount = 100_000000n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                0n,
                []
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                baseAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                99_980002n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                collector.address,
                99_980002n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.closeTo(0n, 50n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                0n,
                0n,
                99_980002n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);
        });

        it("Success gas test", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, usdcUsdpPool, swapRouter } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            const baseAmount = 1000_000000n;
            const distributions = new Array();
            const receiversLength = 550n;

            for (let i = 0; receiversLength > i; i++) {
                const newWallet = ethers.Wallet.createRandom();
                const sender = new ethers.Wallet(newWallet.privateKey, ethers.provider);

                distributions.push([sender.address, 1n]);
            }

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                receiversLength,
                distributions
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                baseAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                998_901198n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.closeTo(0n, 100000n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                receiversLength,
                0n,
                998_901198n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            for (let i = 0; receiversLength > i; i++) {
                expect(await usdc.balanceOf(distributions[i][0])).to.equal(1_816183n);
            }
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdp, usdc, user, user2, usdcUsdpPool, swapRouter } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n
            );

            expect(result).to.equal("Success");

            await usdp.connect(admin).approve(dockMarketSimpleRouter.target, ethers.MaxUint256);

            await expect(dockMarketSimpleRouter.connect(admin).startTrading(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                2n,
                1n,
                admin.address
            ).to.not.emit(usdc, "Transfer");

            await expect(dockMarketSimpleRouter.connect(admin).startWaiting(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                3n,
                1n,
                admin.address
            );

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 1n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            const baseAmount = 100_000000n;

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                baseAmount,
                3n,
                [[user.address, 1n], [user2.address, 2n]]
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdp, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                baseAmount
            ).to.emit(usdcUsdpPool, "Swap").withArgs(
                swapRouter.target,
                dockMarketSimpleRouter.target,
                anyValue,
                anyValue,
                anyValue,
                anyValue,
                anyValue
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                0n,
                99_980002n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user.address,
                33_326667n
            ).to.emit(usdc, "Transfer").withArgs(
                dockMarketSimpleRouter.target,
                user2.address,
                66_653334n
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                admin.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.closeTo(0n, 50n);
            expect(await usdp.balanceOf(dockMarketSimpleRouter.target)).to.equal(0n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeI,
                usdp.target,
                admin.address,
                admin.address,
                1n,
                0n,
                0n,
                0n,
                0n,
                1n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 1n)).to.eql([
                false,
                true,
                0n,
                3n,
                0n,
                99_980002n,
                []
            ]);

            expect(await dockMarketSimpleRouter.getAgentInfoByRound(byteAgentId, 2n)).to.eql([
                true,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");
        });
    });

    describe("startDeposit()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).startDeposit(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user2, agent, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).startDeposit(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                3n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).startDeposit(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                0n,
                0n
            );

            await usdc.connect(admin).mint(user2.address, depositAmount);
            await usdc.connect(admin).mint(agent.address, depositAmount);
            await usdc.connect(admin).mint(user.address, depositAmount * 10n);

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount * 15n);
            await usdc.connect(user2).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(agent).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount * 10n);

            await dockMarketSimpleRouter.connect(user2).deposit(byteAgentId, 1n, user2.address);
            await dockMarketSimpleRouter.connect(agent).deposit(byteAgentId, 1n, agent.address);

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result2).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startDeposit(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startDeposit(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(admin).startDistribution(
                byteAgentId, 105_000000n, 0n, { gasLimit: 200000n }
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                admin.address
            ).to.emit(usdc, "Transfer").withArgs(
                admin.address,
                dockMarketSimpleRouter.target,
                105_000000n
            ).to.emit(dockMarketSimpleRouter, "DistributionStarted").withArgs(
                byteAgentId,
                1n,
                4_747500n,
                100_252500n
            );

            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).currentState).to.equal(4n);

            await expect(dockMarketSimpleRouter.connect(admin).startDeposit(
                byteAgentId
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            await expect(dockMarketSimpleRouter.connect(user).distribute(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                user.address
            );

            await dockMarketSimpleRouter.connect(admin).startDeposit(byteAgentId);
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user, collector, user2, agent } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                3n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                defaultManagementFeeRate,
                defaultPerformanceFeeRate,
                0n,
                0n
            );

            await usdc.connect(admin).mint(user2.address, depositAmount);
            await usdc.connect(admin).mint(agent.address, depositAmount);
            await usdc.connect(admin).mint(user.address, depositAmount * 10n);

            await usdc.connect(admin).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(user2).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(agent).approve(dockMarketSimpleRouter.target, depositAmount);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, depositAmount * 10n);

            await dockMarketSimpleRouter.connect(user2).deposit(byteAgentId, 1n, user2.address);
            await dockMarketSimpleRouter.connect(agent).deposit(byteAgentId, 1n, agent.address);

            const result2 = await depositMemberSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                1n,
                admin
            );

            expect(result2).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(user).startPrivateDistribution(
                byteAgentId,
                depositAmount * 5n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await expect(dockMarketSimpleRouter.connect(user).startDistribution(
                byteAgentId,
                depositAmount * 5n,
                0n
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                4n,
                1n,
                user.address
            ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                5n,
                2n,
                user.address
            );

            expect(await usdc.balanceOf(dockMarketSimpleRouter.target)).to.equal(2n);
            expect(await usdc.balanceOf(user.address)).to.equal(86_666666n);
            expect(await usdc.balanceOf(user2.address)).to.equal(16_175000n);
            expect(await usdc.balanceOf(agent.address)).to.equal(16_175000n);
            expect(await usdc.balanceOf(collector.address)).to.equal(983332n);

            expect(await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).to.eql([
                5n,
                2n,
                agentName,
                agentTypeC,
                usdc.target,
                user.address,
                zeroAddress,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                3n,
                false,
                0n,
                0n,
                0n,
                0n,
                []
            ]);

            const depositResult = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult).to.equal("DockMarketSimpleRouter__IncorrectAgentState");

            await expect(dockMarketSimpleRouter.connect(admin).startDeposit(
                byteAgentId
            )).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
                byteAgentId,
                1n,
                2n,
                admin.address
            );

            const depositResult2 = await depositSimple(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                1n,
                admin.address
            );

            expect(depositResult2).to.equal("Success");
        });
    });

    describe("setProtocolFeeConfig()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).setProtocolFeeConfig(
                byteAgentId,
                10000n,
                10000n,
                10000n,
                10000n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                10000n,
                10000n,
                10000n,
                10000n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__ZeroData", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                5000n,
                5000n,
                0n,
                0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                0n,
                0n,
                5000n,
                5000n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                0n,
                0n,
                10000n,
                0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                0n,
                10000n,
                0n,
                0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, collector, usdc } = await loadFixture(DockMarketFixture);

            const depositAmount = 10_000000n;

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                depositAmount,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeConfig(
                byteAgentId,
                1n,
                2n,
                3n,
                4n
            )).to.emit(dockMarketSimpleRouter, "ProtocolFeeConfigSet").withArgs(
                byteAgentId,
                1n,
                2n,
                3n,
                4n,
                admin.address
            );

            expect(await dockMarketSimpleRouter.getProtocolFeeConfig(byteAgentId)).to.eql([
                1n,
                2n,
                3n,
                4n,
                collector.address
            ]);
        });
    });

    describe("setProtocolFeeReceiver()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).setProtocolFeeReceiver(
                user.address
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__ZeroData", async function () {
            const { dockMarketSimpleRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeReceiver(
                zeroAddress
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).setProtocolFeeReceiver(
                admin.address
            )).to.emit(dockMarketSimpleRouter, "ProtocolFeeReceiverSet").withArgs(
                admin.address,
                admin.address
            );

            expect(await dockMarketSimpleRouter.getProtocolFeeConfig(byteAgentId)).to.eql([
                0n,
                0n,
                0n,
                0n,
                admin.address
            ]);
        });
    });

    describe("setDepositConfig()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).setDepositConfig(
                byteAgentId, 0n, 0n, 0n, 0n, 0n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 0n, 0n, 0n, 0n, 0n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 0n, 0n, 0n, 0n, 0n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__ZeroData", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                1n,
                1n,
                [[admin.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await dockMarketSimpleRouter.connect(admin).startDistribution(byteAgentId, 0n, 0n);

            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).currentState).to.equal(5n);

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 0n, 1n, 1n, 1n, 1n, 1n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 1n, 0n, 1n, 1n, 1n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 2n, 1n, 1n, 1n, 1n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 2n, 2n, 1n, 0n, 1n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 2n, 2n, 2n, 1n, 1n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 2n, 2n, 2n, 2n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc, user } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                9n,
                99n,
                99n,
                99n,
                99n,
                99n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                1n,
                1n,
                [[user.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await dockMarketSimpleRouter.connect(admin).startDistribution(byteAgentId, 0n, 0n);

            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).currentState).to.equal(5n);

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 2n, 2n, 2n, 2n, 0n
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setDepositConfig(
                byteAgentId, 1n, 2n, 3n, 4n, 5n, 6n
            )).to.emit(dockMarketSimpleRouter, "DepositConfigSet").withArgs(
                byteAgentId,
                1n,
                2n,
                3n,
                4n,
                5n,
                6n,
                admin.address
            );

            let newAgentInfo = await dockMarketSimpleRouter.getAgentInfo(byteAgentId);

            expect(newAgentInfo.sharePrice).to.equal(1n);
            expect(newAgentInfo.baseMinShares).to.equal(2n);
            expect(newAgentInfo.baseMaxShares).to.equal(3n);
            expect(newAgentInfo.memberMinShares).to.equal(4n);
            expect(newAgentInfo.memberMaxShares).to.equal(5n);
            expect(newAgentInfo.sharesCap).to.equal(6n);

            await dockMarketSimpleRouter.connect(admin).startDeposit(byteAgentId);

            newAgentInfo = await dockMarketSimpleRouter.getAgentInfo(byteAgentId);

            expect(newAgentInfo.sharePrice).to.equal(1n);
            expect(newAgentInfo.baseMinShares).to.equal(2n);
            expect(newAgentInfo.baseMaxShares).to.equal(3n);
            expect(newAgentInfo.memberMinShares).to.equal(4n);
            expect(newAgentInfo.memberMaxShares).to.equal(5n);
            expect(newAgentInfo.sharesCap).to.equal(6n);

            await usdc.connect(admin).transfer(user.address, 2n);
            await usdc.connect(user).approve(dockMarketSimpleRouter.target, 2n);

            const result1 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                1n,
                user.address
            );

            expect(result1).to.equal("DockMarketSimpleRouter__DepositCapacityUnachieved: baseShares");

            const result2 = await depositSimple(
                dockMarketSimpleRouter,
                user,
                byteAgentId,
                2n,
                user.address
            );

            expect(result2).to.equal("Success");
        });
    });

    describe("setAgentMetadata()", function () {
        it("AccessControlUnauthorizedAccount", async function () {
            const { dockMarketSimpleRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(user).setAgentMetadata(
                byteAgentId, "", ""
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketSimpleRouter__IncorrectAgentState", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            await expect(dockMarketSimpleRouter.connect(admin).setAgentMetadata(
                byteAgentId, "", ""
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await expect(dockMarketSimpleRouter.connect(admin).setAgentMetadata(
                byteAgentId, "", ""
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");
        });

        it("DockMarketSimpleRouter__ZeroData", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                1n,
                1n,
                [[admin.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await dockMarketSimpleRouter.connect(admin).startDistribution(byteAgentId, 0n, 0n);

            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).currentState).to.equal(5n);

            await expect(dockMarketSimpleRouter.connect(admin).setAgentMetadata(
                byteAgentId, "", ""
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setAgentMetadata(
                byteAgentId, "name", ""
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

            await expect(dockMarketSimpleRouter.connect(admin).setAgentMetadata(
                byteAgentId, "", "type"
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");
        });

        it("Success", async function () {
            const { dockMarketSimpleRouter, admin, usdc } = await loadFixture(DockMarketFixture);

            const result = await registerAgent(
                dockMarketSimpleRouter,
                admin,
                byteAgentId,
                agentName,
                agentTypeC,
                usdc.target,
                admin.address,
                admin.address,
                1n,
                1n,
                1n,
                1n,
                2n,
                2n
            );

            expect(result).to.equal("Success");

            await dockMarketSimpleRouter.connect(admin).startTrading(byteAgentId);

            await dockMarketSimpleRouter.connect(admin).startWaiting(byteAgentId);

            await expect(dockMarketSimpleRouter.connect(admin).startPrivateDistribution(
                byteAgentId,
                1n,
                1n,
                [[admin.address, 1n]]
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentType");

            await dockMarketSimpleRouter.connect(admin).startDistribution(byteAgentId, 0n, 0n);

            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).currentState).to.equal(5n);

            await expect(dockMarketSimpleRouter.connect(admin).setAgentMetadata(
                byteAgentId, "newName", "newType"
            )).to.emit(dockMarketSimpleRouter, "AgentMetadataSet").withArgs(
                byteAgentId,
                "newName",
                "newType",
                admin.address
            );

            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).agentName).to.equal("newName");
            expect((await dockMarketSimpleRouter.getAgentInfo(byteAgentId)).agentType).to.equal("newType");
        });
    });
});