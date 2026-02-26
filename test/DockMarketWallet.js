const { agentId, agentTypeC, nativeAddress, agentName } = require("./utils/GlobalConstants");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deposit, zeroAddress, withDecimals } = require("./utils/DockMarketUtils");
const { DockMarketFixture } = require("./utils/DockMarketFixture");
const { expect } = require("chai");

describe("DockMarketWallet", function () {
    describe("Deploy", function () {
        it("Init implementation", async function () {
            const { admin, dockMarketRouter, dockMarketWalletImplementation, weth } = await loadFixture(DockMarketFixture);

            expect(await dockMarketWalletImplementation.ROUTER()).to.equal(dockMarketRouter.target);
            expect(await dockMarketWalletImplementation.WETH_ADDRESS()).to.equal(weth.target);
            expect(await dockMarketWalletImplementation.owner()).to.equal(zeroAddress);
            expect(await dockMarketWalletImplementation.getAgentId()).to.equal(0n);
            expect(await dockMarketWalletImplementation.getAgentProfile()).to.eql([false, "", "", zeroAddress, zeroAddress]);
            expect(await dockMarketWalletImplementation.getBalances([weth.target, nativeAddress])).to.eql([0n, 0n]);
            expect(await dockMarketWalletImplementation.totalDeposited(weth.target)).to.equal(0n);
            expect(await dockMarketWalletImplementation.dockMarketContractName()).to.equal("DockMarketWallet");
            expect(await dockMarketWalletImplementation.supportsInterface("0x5ef99b85")).to.equal(true);
            expect(await dockMarketWalletImplementation.supportsInterface("0x01ffc9a7")).to.equal(true);

            await expect(dockMarketWalletImplementation.connect(admin).initialize(
                admin.address,
                1n
            )).to.be.revertedWithCustomError(dockMarketWalletImplementation, "InvalidInitialization");

            await expect(admin.sendTransaction({
                to: dockMarketWalletImplementation.target,
                value: 1n
            })).to.be.revertedWithCustomError(dockMarketWalletImplementation, "DockMarketWallet__CallerIsNotRouter");
        });

        it("Init proxy", async function () {
            const { user, dockMarketRouter, userWallet, weth, agent } = await loadFixture(DockMarketFixture);

            expect(await userWallet.ROUTER()).to.equal(dockMarketRouter.target);
            expect(await userWallet.WETH_ADDRESS()).to.equal(weth.target);
            expect(await userWallet.owner()).to.equal(user);
            expect(await userWallet.getAgentId()).to.equal(agentId);
            expect(await userWallet.getAgentProfile()).to.eql([false, agentName, agentTypeC, agent.address, zeroAddress]);
            expect(await userWallet.getBalances([weth.target])).to.eql([0n]);
            expect(await userWallet.totalDeposited(weth.target)).to.equal(0n);
            expect(await userWallet.dockMarketContractName()).to.equal("DockMarketWallet");

            await expect(userWallet.connect(user).initialize(
                user.address,
                1n
            )).to.be.revertedWithCustomError(userWallet, "InvalidInitialization");

            await expect(user.sendTransaction({
                to: userWallet.target,
                value: 1n
            })).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__CallerIsNotRouter");
        });
    });

    describe("onlyRouter()", function () {
        it("deposit()", async function () {
            const { user, userWallet } = await loadFixture(DockMarketFixture);

            await expect(userWallet.connect(user).deposit(
                user.address,
                user.address,
                1n
            )).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__CallerIsNotRouter");
        });

        it("withdraw()", async function () {
            const { user, userWallet } = await loadFixture(DockMarketFixture);

            await expect(userWallet.connect(user).withdraw(
                user.address,
                user.address,
                1n
            )).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__CallerIsNotRouter");
        });

        it("execute()", async function () {
            const { user, userWallet } = await loadFixture(DockMarketFixture);

            await expect(userWallet.connect(user).execute([[
                user.address,
                0n,
                "0x"
            ]])).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__CallerIsNotRouter");
        });
    });

    describe("withdraw()", function () {
        it("DockMarketWallet__ZeroAmount", async function () {
            const { dockMarketRouter, user, usdc, admin, agent } = await loadFixture(DockMarketFixture);

            const amount = 0n;
            const deadline = BigInt((await time.latest()) + 3600);

            const withdrawCalldata = dockMarketRouter.interface.encodeFunctionData("withdraw", [
                user.address,
                agentId,
                usdc.target,
                user.address,
                amount
            ]);

            const txs = [{
                target: dockMarketRouter.target,
                value: 0n,
                data: withdrawCalldata
            }];

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const txsForEncoding = txs.map(tx => [tx.target, tx.value, tx.data]);

            const executeMessageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "address", "uint256", "tuple(address,uint256,bytes)[]"],
                    [
                        chainId,
                        dockMarketRouter.target,
                        deadline,
                        txsForEncoding
                    ]
                )
            );

            const signature = await agent.signMessage(ethers.getBytes(executeMessageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                signature,
                deadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ExecuteCallFailed");
        });

        it("Success", async function () {
            const { dockMarketRouter, user, usdc, admin, userWallet, agent, collector } = await loadFixture(DockMarketFixture);

            const amount = 1500_000000n;

            await usdc.connect(admin).mint(user.address, amount);
            await deposit(dockMarketRouter, user, user.address, agentId, usdc.target, amount);
            await usdc.connect(admin).mint(userWallet.target, amount);

            const amountToWithdraw = amount * 2n;

            const deadline = BigInt((await time.latest()) + 3600);

            const withdrawCalldata = dockMarketRouter.interface.encodeFunctionData("withdraw", [
                user.address,
                agentId,
                usdc.target,
                user.address,
                amountToWithdraw
            ]);

            const txs = [{
                target: dockMarketRouter.target,
                value: 0n,
                data: withdrawCalldata
            }];

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const txsForEncoding = txs.map(tx => [tx.target, tx.value, tx.data]);

            const executeMessageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "address", "uint256", "tuple(address,uint256,bytes)[]"],
                    [
                        chainId,
                        dockMarketRouter.target,
                        deadline,
                        txsForEncoding
                    ]
                )
            );

            const signature = await agent.signMessage(ethers.getBytes(executeMessageHash));
            const config = await dockMarketRouter.getConfig();
            const feeAmount = amountToWithdraw * config[2] / 10000n + amount * config[1] / 10000n;

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                signature,
                deadline
            )).to.emit(dockMarketRouter, "Withdrawn").withArgs(
                userWallet.target,
                user.address,
                usdc.target,
                user.address,
                amountToWithdraw - feeAmount,
                feeAmount
            ).to.emit(usdc, "Transfer").withArgs(
                userWallet.target,
                user.address,
                amountToWithdraw - feeAmount
            ).to.emit(usdc, "Transfer").withArgs(
                userWallet.target,
                collector.address,
                feeAmount
            );
        });

        it("Success ETH", async function () {
            const { dockMarketRouter, user, admin, userWallet, agent } = await loadFixture(DockMarketFixture);

            const amount = withDecimals("0.1");

            await deposit(dockMarketRouter, user, user.address, agentId, nativeAddress, amount);

            const deadline = BigInt((await time.latest()) + 3600);

            const withdrawCalldata = dockMarketRouter.interface.encodeFunctionData("withdraw", [
                user.address,
                agentId,
                nativeAddress,
                user.address,
                amount
            ]);

            const txs = [{
                target: dockMarketRouter.target,
                value: 0n,
                data: withdrawCalldata
            }];

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const txsForEncoding = txs.map(tx => [tx.target, tx.value, tx.data]);

            const executeMessageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "address", "uint256", "tuple(address,uint256,bytes)[]"],
                    [
                        chainId,
                        dockMarketRouter.target,
                        deadline,
                        txsForEncoding
                    ]
                )
            );

            const signature = await agent.signMessage(ethers.getBytes(executeMessageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                signature,
                deadline
            )).to.emit(dockMarketRouter, "Withdrawn").withArgs(
                userWallet.target,
                user.address,
                nativeAddress,
                user.address,
                amount - amount * (await dockMarketRouter.getConfig())[2] / 10000n,
                amount * (await dockMarketRouter.getConfig())[2] / 10000n
            );
        });

        it("Success zero fee", async function () {
            const { dockMarketRouter, user, usdc, admin, userWallet, agent } = await loadFixture(DockMarketFixture);

            const amount = 1500_000000n;

            await usdc.connect(admin).mint(user.address, amount);
            await deposit(dockMarketRouter, user, user.address, agentId, usdc.target, amount);
            await dockMarketRouter.connect(admin).setPerfomanceFeeRate(0n);
            await dockMarketRouter.connect(admin).setManagementFeeRate(0n);

            const deadline = BigInt((await time.latest()) + 3600);

            const withdrawCalldata = dockMarketRouter.interface.encodeFunctionData("withdraw", [
                user.address,
                agentId,
                usdc.target,
                user.address,
                amount
            ]);

            const txs = [{
                target: dockMarketRouter.target,
                value: 0n,
                data: withdrawCalldata
            }];

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const txsForEncoding = txs.map(tx => [tx.target, tx.value, tx.data]);

            const executeMessageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "address", "uint256", "tuple(address,uint256,bytes)[]"],
                    [
                        chainId,
                        dockMarketRouter.target,
                        deadline,
                        txsForEncoding
                    ]
                )
            );

            const signature = await agent.signMessage(ethers.getBytes(executeMessageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                signature,
                deadline
            )).to.emit(dockMarketRouter, "Withdrawn").withArgs(
                userWallet.target,
                user.address,
                usdc.target,
                user.address,
                amount,
                0n
            ).to.emit(usdc, "Transfer").withArgs(
                userWallet.target,
                user.address,
                amount
            );
        });
    });

    describe("execute()", function () {
        it("DockMarketWallet__CallerIsNotRouter", async function () {
            const { userWallet, user } = await loadFixture(DockMarketFixture);

            await expect(userWallet.connect(user).execute(
                []
            )).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__CallerIsNotRouter");
        });

        it("DockMarketWallet__InvalidCallTarget", async function () {
            const { dockMarketWalletBeacon, userWallet, admin, weth } = await loadFixture(DockMarketFixture);

            const DockMarketWallet = await ethers.getContractFactory("DockMarketWallet", admin);
            const dockMarketWalletNewImpl = await DockMarketWallet.deploy(admin.address, weth.target);
            await dockMarketWalletNewImpl.waitForDeployment();

            await dockMarketWalletBeacon.connect(admin).upgradeTo(dockMarketWalletNewImpl.target);

            await expect(userWallet.connect(admin).execute(
                [[admin.address, 0n, "0xff"]]
            )).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__InvalidCallTarget");
        });

        it("DockMarketWallet__ExecuteCallFailed", async function () {
            const { dockMarketWalletBeacon, userWallet, admin, weth } = await loadFixture(DockMarketFixture);

            const DockMarketWallet = await ethers.getContractFactory("DockMarketWallet", admin);
            const dockMarketWalletNewImpl = await DockMarketWallet.deploy(admin.address, weth.target);
            await dockMarketWalletNewImpl.waitForDeployment();

            await dockMarketWalletBeacon.connect(admin).upgradeTo(dockMarketWalletNewImpl.target);

            const transferCalldata = weth.interface.encodeFunctionData("transfer", [
                admin.address,
                1n
            ]);

            await expect(userWallet.connect(admin).execute(
                [[weth.target, 0n, transferCalldata]]
            )).to.be.revertedWithCustomError(userWallet, "DockMarketWallet__ExecuteCallFailed");
        });

        it("Success single", async function () {
            const { dockMarketWalletBeacon, userWallet, admin, weth } = await loadFixture(DockMarketFixture);

            const DockMarketWallet = await ethers.getContractFactory("DockMarketWallet", admin);
            const dockMarketWalletNewImpl = await DockMarketWallet.deploy(admin.address, weth.target);
            await dockMarketWalletNewImpl.waitForDeployment();

            await dockMarketWalletBeacon.connect(admin).upgradeTo(dockMarketWalletNewImpl.target);

            await weth.connect(admin).transfer(userWallet.target, 2n);

            const transferCalldata = weth.interface.encodeFunctionData("transfer", [
                admin.address,
                1n
            ]);

            await expect(userWallet.connect(admin).execute(
                [[weth.target, 0n, transferCalldata]]
            )).to.emit(weth, "Transfer").withArgs(
                userWallet.target,
                admin.address,
                1n
            );

            const withdrawCalldata = weth.interface.encodeFunctionData("withdraw", [
                1n
            ]);

            await expect(userWallet.connect(admin).execute(
                [[weth.target, 0n, withdrawCalldata]]
            )).to.emit(weth, "Withdrawal").withArgs(
                userWallet.target,
                1n
            );

            await userWallet.connect(admin).execute([[admin.address, 1n, "0x"]]);
        });

        it("Success multi", async function () {
            const { dockMarketWalletBeacon, userWallet, admin, weth, user } = await loadFixture(DockMarketFixture);

            const DockMarketWallet = await ethers.getContractFactory("DockMarketWallet", admin);
            const dockMarketWalletNewImpl = await DockMarketWallet.deploy(admin.address, weth.target);
            await dockMarketWalletNewImpl.waitForDeployment();

            await dockMarketWalletBeacon.connect(admin).upgradeTo(dockMarketWalletNewImpl.target);

            await weth.connect(admin).transfer(userWallet.target, 3n);

            const transferCalldata1 = weth.interface.encodeFunctionData("transfer", [
                admin.address,
                1n
            ]);

            const transferCalldata2 = weth.interface.encodeFunctionData("transfer", [
                user.address,
                2n
            ]);

            await expect(userWallet.connect(admin).execute([
                [weth.target, 0n, transferCalldata1],
                [weth.target, 0n, transferCalldata2]
            ])).to.emit(weth, "Transfer").withArgs(
                userWallet.target,
                admin.address,
                1n
            ).to.emit(weth, "Transfer").withArgs(
                userWallet.target,
                user.address,
                2n
            );
        });
    });
});