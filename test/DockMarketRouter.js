const {
    nativeAddress, agentId, agentId3, agentName, agentName3, agentTypeC, agentTypeA, defaultPerformanceFeeRate, defaultManagementFeeRate, defaultMaxDepositValue
} = require("./utils/GlobalConstants");
const { createWallet, deposit, zeroAddress, zeroHash, withDecimals } = require("./utils/DockMarketUtils");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { DockMarketFixture } = require("./utils/DockMarketFixture");
const { expect } = require("chai");

describe("DockMarketRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const {
                dockMarketRouter, dockMarketWalletBeacon, admin, wethUsdcPool, usdc, weth, adminRole, uniswapOracle, userWallet, user, agent, collector, agent3
            } = await loadFixture(DockMarketFixture);

            expect(await dockMarketRouter.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await dockMarketRouter.ETH_ADDRESS()).to.equal(nativeAddress);
            expect(await dockMarketRouter.UNISWAP_ORACLE()).to.equal(uniswapOracle.target);
            expect(await dockMarketRouter.WALLET_BEACON()).to.equal(dockMarketWalletBeacon.target);
            expect(await dockMarketRouter.WETH_ADDRESS()).to.equal(weth.target);
            expect(await dockMarketRouter.USDC_ADDRESS()).to.equal(usdc.target);
            expect(await dockMarketRouter.USDC_WETH_UNISWAP_POOL()).to.equal(wethUsdcPool.target);
            expect(await dockMarketRouter.getConfig()).to.eql([collector.address, defaultPerformanceFeeRate, defaultManagementFeeRate, defaultMaxDepositValue]);
            expect(await dockMarketRouter.getWalletAddress(user.address, agentId)).to.eql([userWallet.target, true]);
            const newWalletData = await dockMarketRouter.getWalletAddress(user.address, agentId3);
            expect(newWalletData[0]).to.not.equal(zeroAddress);
            expect(newWalletData[0]).to.not.equal(userWallet.target);
            expect(newWalletData[1]).to.equal(false);
            expect(await dockMarketRouter.getBalances(user.address, agentId, [weth.target, usdc.target])).to.eql([0n, 0n]);
            expect(await dockMarketRouter.getBalances(user.address, 2n, [weth.target, usdc.target])).to.eql([]);
            expect(await dockMarketRouter.totalDeposited(user.address, agentId, weth.target)).to.equal(0n);
            expect(await dockMarketRouter.totalDeposited(user.address, 2n, weth.target)).to.equal(0n);
            expect(await dockMarketRouter.getOwnerByWallet(userWallet.target)).to.eql([user.address, await dockMarketRouter.getAgentProfile(agentId)]);
            expect(await dockMarketRouter.getOwnerByWallet(user.address)).to.eql([zeroAddress, await dockMarketRouter.getAgentProfile(0n)]);
            expect(await dockMarketRouter.getAgentProfile(agentId)).to.eql([false, agentName, agentTypeC, agent.address, zeroAddress]);
            expect(await dockMarketRouter.getAgentProfile(agentId3)).to.eql([false, agentName3, agentTypeA, agent3.address, agent3.address]);
            expect(await dockMarketRouter.getAgentProfile(0n)).to.eql([false, "", "", zeroAddress, zeroAddress]);
            expect(await dockMarketRouter.usedSignature(zeroHash)).to.equal(false);
            expect(await dockMarketRouter.USDC_WETH_UNISWAP_POOL()).to.equal(wethUsdcPool.target);
            expect(await dockMarketRouter.dockMarketContractName()).to.equal("DockMarketRouter");
            expect(await dockMarketRouter.supportsInterface("0xb7a1d4b2")).to.equal(true);
            expect(await dockMarketRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, dockMarketRouter, mainToken, mock } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");

            await expect(dockMarketRouter.connect(user).initialize(
                user.address,
                ["0x", "0x", "0x", "0x"]
            )).to.be.revertedWithCustomError(dockMarketRouter, "InvalidInitialization");

            await expect(dockMarketRouter.connect(admin).upgradeToAndCall(mainToken.target, "0x")).to.be.revertedWithoutReason();

            await expect(dockMarketRouter.connect(admin).upgradeToAndCall(
                mock.target,
                "0x"
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketUpgradeChecker__E0");
        });
    });

    describe("createWallet()", function () {
        it("DockMarketRouter__ZeroAddress:user address", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            const result = await createWallet(dockMarketRouter, admin, zeroAddress, 1n);

            expect(result).to.equal("DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__ZeroAddress:agent address", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            const result = await createWallet(dockMarketRouter, admin, admin.address, 2n);

            expect(result).to.equal("DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__AgentPaused", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setPause(
                agentId,
                true
            )).to.emit(dockMarketRouter, "AgentPaused").withArgs(
                agentId,
                true,
                admin.address
            );

            const result = await createWallet(dockMarketRouter, admin, admin.address, agentId);

            expect(result).to.equal("DockMarketRouter__AgentPaused");
        });

        it("Success", async function () {
            const { dockMarketRouter, admin, user2 } = await loadFixture(DockMarketFixture);

            const result0 = await createWallet(dockMarketRouter, admin, admin.address, 1n);

            expect(result0).to.equal("Success_WithEvent");

            const result1 = await createWallet(dockMarketRouter, admin, admin.address, 1n);

            expect(result1).to.equal("Success_WithoutEvent");

            const result2 = await createWallet(dockMarketRouter, admin, user2.address, 1n);

            expect(result2).to.equal("Success_WithEvent");
        });
    });

    describe("deposit()", function () {
        it("DockMarketWallet__ZeroAmount", async function () {
            const { dockMarketRouter, admin, user } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId, nativeAddress, 0n);

            expect(result).to.equal("DockMarketWallet__ZeroAmount");
        });

        it("DockMarketRouter__UnallowedToken", async function () {
            const { dockMarketRouter, admin, user } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId, user.address, 0n);

            expect(result).to.equal("DockMarketRouter__UnallowedToken");
        });

        it("DockMarketRouter__DepositAmountExceeded", async function () {
            const { dockMarketRouter, admin, user, weth, usdc } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId, nativeAddress, withDecimals("1"));

            expect(result).to.equal("DockMarketRouter__DepositAmountExceeded_ETH");

            const result1 = await deposit(dockMarketRouter, admin, user.address, agentId, weth.target, withDecimals("1"));

            expect(result1).to.equal("DockMarketRouter__DepositAmountExceeded_WETH");

            const result2 = await deposit(dockMarketRouter, admin, user.address, agentId, usdc.target, 2001_000000n);

            expect(result2).to.equal("DockMarketRouter__DepositAmountExceeded_USDC");
        });

        it("Success_Created_ETH", async function () {
            const { dockMarketRouter, admin, user } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId3, nativeAddress, withDecimals("0.25"));

            expect(result).to.equal("Success_Created_ETH");

            const result1 = await deposit(dockMarketRouter, admin, user.address, agentId3, nativeAddress, withDecimals("0.3"));

            expect(result1).to.equal("Success_Existed_ETH");
        });

        it("Success_Existed_ETH", async function () {
            const { dockMarketRouter, admin, user, usdc } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId, nativeAddress, withDecimals("0.5"));

            expect(result).to.equal("Success_Existed_ETH");

            const result1 = await deposit(dockMarketRouter, admin, user.address, agentId, usdc.target, 100_000000n);

            expect(result1).to.equal("Success_Existed_Token");
        });

        it("Success_Created_Token", async function () {
            const { dockMarketRouter, admin, user, usdc } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId3, usdc.target, 100_000000n);

            expect(result).to.equal("Success_Created_Token");

            const result1 = await deposit(dockMarketRouter, admin, user.address, agentId3, nativeAddress, withDecimals("0.3"));

            expect(result1).to.equal("Success_Existed_ETH");
        });

        it("Success_Existed_Token", async function () {
            const { dockMarketRouter, admin, user, usdc } = await loadFixture(DockMarketFixture);

            const result = await deposit(dockMarketRouter, admin, user.address, agentId, usdc.target, 100_000000n);

            expect(result).to.equal("Success_Existed_Token");

            const result1 = await deposit(dockMarketRouter, admin, user.address, agentId, usdc.target, 200_000000n);

            expect(result1).to.equal("Success_Existed_Token");
        });
    });

    describe("depositWithPermit()", function () {
        it("DockMarketRouter__InvalidCaller", async function () {
            const { dockMarketRouter, usdc, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).depositWithPermit(
                admin.address,
                agentId,
                usdc.target,
                [
                    admin.address,
                    1n,
                    1n,
                    0n,
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000000000000000000000000000"
                ]
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidCaller");
        });

        it("Success", async function () {
            const { dockMarketRouter, userWallet, admin, user, usdc, agent } = await loadFixture(DockMarketFixture);

            const amount = 1000_000000n;
            const deadline = (await time.latest()) + 3600;

            await usdc.connect(admin).mint(user.address, amount);

            const nonce = await usdc.nonces(user.address);
            const domain = {
                name: await usdc.name(),
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: usdc.target,
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
                spender: dockMarketRouter.target,
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

            const depositWithPermitCalldata = dockMarketRouter.interface.encodeFunctionData(
                "depositWithPermit",
                [user.address, agentId, usdc.target, permit]
            );

            const txs = [{
                target: dockMarketRouter.target,
                value: 0,
                data: depositWithPermitCalldata
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.emit(dockMarketRouter, "Deposited").withArgs(
                userWallet.target,
                user.address,
                agentId,
                usdc.target,
                amount
            ).to.emit(usdc, "Transfer").withArgs(
                user.address,
                userWallet.target,
                amount
            );
        });
    });

    describe("withdraw()", function () {
        it("DockMarketRouter__InvalidCaller", async function () {
            const { dockMarketRouter, usdc, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).withdraw(
                admin.address,
                agentId,
                usdc.target,
                admin.address,
                1n
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidCaller");
        });

        it("Success", async function () {
            const { dockMarketRouter, user, usdc, admin, userWallet, agent, collector } = await loadFixture(DockMarketFixture);

            const amount = 1500_000000n;

            await usdc.connect(admin).mint(user.address, amount);
            await deposit(dockMarketRouter, user, user.address, agentId, usdc.target, amount);

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
                amount - amount * (await dockMarketRouter.getConfig())[2] / 10000n,
                amount * (await dockMarketRouter.getConfig())[2] / 10000n
            ).to.emit(usdc, "Transfer").withArgs(
                userWallet.target,
                user.address,
                amount - amount * (await dockMarketRouter.getConfig())[2] / 10000n
            ).to.emit(usdc, "Transfer").withArgs(
                userWallet.target,
                collector.address,
                amount * (await dockMarketRouter.getConfig())[2] / 10000n
            );
        });
    });

    describe("execute()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).execute(
                [],
                "0x",
                0n
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketRouter__InvalidCallTarget", async function () {
            const { dockMarketRouter, user, agent, admin } = await loadFixture(DockMarketFixture);

            const txs = [{
                target: user.address,
                value: 0,
                data: "0xff"
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidCallTarget");
        });

        it("DockMarketRouter__UnallowedAgentType", async function () {
            const { dockMarketRouter, user, agent, admin } = await loadFixture(DockMarketFixture);

            await dockMarketRouter.connect(admin).createWallet(user.address, agentId3);

            const txs = [{
                target: (await dockMarketRouter.getWalletAddress(user.address, agentId3))[0],
                value: 0,
                data: "0xff"
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__UnallowedAgentType");
        });

        it("DockMarketRouter__ExecuteCallFailed", async function () {
            const { dockMarketRouter, user, agent, usdc, admin } = await loadFixture(DockMarketFixture);

            const amount = withDecimals("100");
            const deadline = (await time.latest()) + 3600;

            await usdc.connect(admin).mint(user.address, amount);

            const nonce = await usdc.nonces(user.address);
            const domain = {
                name: await usdc.name(),
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: usdc.target,
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
                spender: dockMarketRouter.target,
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

            const depositWithPermitCalldata = dockMarketRouter.interface.encodeFunctionData(
                "depositWithPermit",
                [user.address, agentId, usdc.target, permit]
            );

            const txs = [{
                target: dockMarketRouter.target,
                value: 0,
                data: depositWithPermitCalldata
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ExecuteCallFailed");
        });

        it("Success", async function () {
            const { dockMarketRouter, agent, admin, userWallet } = await loadFixture(DockMarketFixture);

            const txs = [{
                target: userWallet.target,
                value: 0,
                data: "0x"
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.emit(dockMarketRouter, "Executed").withArgs(
                userWallet.target,
                "0x",
                admin.address
            );
        });
    });

    describe("initSessionKey()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                agentName,
                agentTypeC,
                user.address,
                user.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketRouter__ZeroAddress", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                agentName,
                agentTypeC,
                zeroAddress,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__ZeroAgentType: agentId", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                0n,
                agentName,
                agentTypeC,
                admin.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAgentType");
        });

        it("DockMarketRouter__ZeroAgentName", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                "",
                agentTypeC,
                admin.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAgentName");
        });

        it("DockMarketRouter__ZeroAgentType: agentType", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                agentName,
                "",
                admin.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAgentType");
        });

        it("DockMarketRouter__AgentInitialized: onchainAddress", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init, agent } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                agentName,
                agentTypeA,
                agent.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__AgentInitialized");
        });

        it("DockMarketRouter__AgentInitialized: agentId", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init, agent2 } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                agentName,
                agentTypeA,
                agent2.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__AgentInitialized");
        });

        it("DockMarketRouter__UnauthorizedMrEnclave", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init, sessionMrEnclave } = await loadFixture(DockMarketFixture);

            await dockMarketRouter.connect(admin).setMrEnclave(sessionMrEnclave, false);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                2n,
                agentName,
                agentTypeA,
                admin.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__UnauthorizedMrEnclave");
        });

        it("DockMarketRouter__InvalidHashedData", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).initSessionKey(
                leaf,
                intermediate,
                quote1Init,
                2n,
                agentName,
                agentTypeA,
                admin.address,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidHashedData");
        });
    });

    describe("reinitSessionKey()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).reinitSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                user.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketRouter__ZeroAddress", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).reinitSessionKey(
                leaf,
                intermediate,
                quote1Init,
                2n,
                zeroAddress
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__AgentInitialized", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Init, agent } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).reinitSessionKey(
                leaf,
                intermediate,
                quote1Init,
                agentId,
                agent.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__AgentInitialized");
        });

        it("DockMarketRouter__UnauthorizedMrEnclave", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Reinit, sessionMrEnclave, agent2 } = await loadFixture(DockMarketFixture);

            await dockMarketRouter.connect(admin).setMrEnclave(sessionMrEnclave, false);

            await expect(dockMarketRouter.connect(admin).reinitSessionKey(
                leaf,
                intermediate,
                quote1Reinit,
                agentId,
                agent2.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__UnauthorizedMrEnclave");
        });

        it("DockMarketRouter__InvalidHashedData", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Reinit } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).reinitSessionKey(
                leaf,
                intermediate,
                quote1Reinit,
                agentId,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidHashedData");
        });

        it("Success", async function () {
            const { dockMarketRouter, admin, leaf, intermediate, quote1Reinit, agent, agent2, sessionMrEnclave } = await loadFixture(DockMarketFixture);

            expect(await dockMarketRouter.getAgentProfile(agentId)).to.eql([false, agentName, agentTypeC, agent.address, zeroAddress]);

            await expect(dockMarketRouter.connect(admin).reinitSessionKey(
                leaf,
                intermediate,
                quote1Reinit,
                agentId,
                agent2.address
            )).to.emit(dockMarketRouter, "SessionInitialized").withArgs(
                agentId,
                agentName,
                agentTypeC,
                agent2.address,
                sessionMrEnclave,
                admin.address
            );

            expect(await dockMarketRouter.getAgentProfile(agentId)).to.eql([false, agentName, agentTypeC, agent2.address, zeroAddress]);
        });
    });

    describe("_verifySignature()", function () {
        it("DockMarketRouter__DeadlineExpired", async function () {
            const { dockMarketRouter, userWallet, agent, admin } = await loadFixture(DockMarketFixture);

            const txs = [{
                target: userWallet.target,
                value: 0,
                data: "0x"
            }];

            const execDeadline = (await time.latest());

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__DeadlineExpired");
        });

        it("DockMarketRouter__UsedSignature", async function () {
            const { dockMarketRouter, userWallet, agent, admin } = await loadFixture(DockMarketFixture);

            const txs = [{
                target: userWallet.target,
                value: 0,
                data: "0x"
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            );

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__UsedSignature");
        });

        it("DockMarketRouter__InvalidSigner", async function () {
            const { dockMarketRouter, userWallet, admin } = await loadFixture(DockMarketFixture);

            const txs = [{
                target: userWallet.target,
                value: 0,
                data: "0x"
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await admin.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__AgentPaused", async function () {
            const { dockMarketRouter, agent, admin, userWallet } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setPause(
                agentId,
                true
            )).to.emit(dockMarketRouter, "AgentPaused").withArgs(
                agentId,
                true,
                admin.address
            );

            const txs = [{
                target: userWallet.target,
                value: 0,
                data: "0x"
            }];

            const execDeadline = (await time.latest()) + 3600;

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "tuple(address target, uint256 value, bytes data)[]"
                    ],
                    [
                        (await ethers.provider.getNetwork()).chainId,
                        dockMarketRouter.target,
                        execDeadline,
                        txs
                    ]
                )
            );

            const execSignature = await agent.signMessage(ethers.getBytes(messageHash));

            await expect(dockMarketRouter.connect(admin).execute(
                txs,
                execSignature, execDeadline
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__AgentPaused");
        });
    });

    describe("setFeeCollector()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).setFeeCollector(
                user.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });
    });

    describe("setPerfomanceFeeRate()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).setPerfomanceFeeRate(
                0n
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketRouter__FeeRateExceeded", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setPerfomanceFeeRate(
                10001n
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__FeeRateExceeded");
        });
    });

    describe("setManagementFeeRate()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).setManagementFeeRate(
                0n
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketRouter__FeeRateExceeded", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setManagementFeeRate(
                10001n
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__FeeRateExceeded");
        });
    });

    describe("setMaxDepositValue()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).setMaxDepositValue(
                0n
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });
    });

    describe("setMrEnclave()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).setMrEnclave(
                zeroHash,
                true
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });
    });

    describe("setPause()", function () {
        it("AccessControl", async function () {
            const { dockMarketRouter, user } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(user).setPause(
                agentId,
                true
            )).to.be.revertedWithCustomError(dockMarketRouter, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketRouter__ZeroAddress", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setPause(
                2n,
                true
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");
        });

        it("Success", async function () {
            const { dockMarketRouter, admin, agent } = await loadFixture(DockMarketFixture);

            expect(await dockMarketRouter.getAgentProfile(agentId)).to.eql([false, agentName, agentTypeC, agent.address, zeroAddress]);

            await expect(dockMarketRouter.connect(admin).setPause(
                agentId,
                true
            )).to.emit(dockMarketRouter, "AgentPaused").withArgs(
                agentId,
                true,
                admin.address
            );

            expect(await dockMarketRouter.getAgentProfile(agentId)).to.eql([true, agentName, agentTypeC, agent.address, zeroAddress]);

            await expect(dockMarketRouter.connect(admin).setPause(
                agentId,
                false
            )).to.emit(dockMarketRouter, "AgentPaused").withArgs(
                agentId,
                false,
                admin.address
            );

            expect(await dockMarketRouter.getAgentProfile(agentId)).to.eql([false, agentName, agentTypeC, agent.address, zeroAddress]);
        });
    });

    describe("setCreatorAddress()", function () {
        it("DockMarketRouter__ZeroAddress: newCreatorAddress", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setCreatorAddress(
                agentId,
                zeroAddress
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__ZeroAddress: agent onchainAddress", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setCreatorAddress(
                4n,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");
        });

        it("DockMarketRouter__InvalidCaller", async function () {
            const { dockMarketRouter, admin } = await loadFixture(DockMarketFixture);

            await expect(dockMarketRouter.connect(admin).setCreatorAddress(
                agentId,
                admin.address
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidCaller");
        });

        it("Success", async function () {
            const { dockMarketRouter, admin, agent3 } = await loadFixture(DockMarketFixture);

            expect(await dockMarketRouter.getAgentProfile(agentId3)).to.eql([false, agentName3, agentTypeA, agent3.address, agent3.address]);

            await expect(dockMarketRouter.connect(agent3).setCreatorAddress(
                agentId3,
                admin.address
            )).to.emit(dockMarketRouter, "CreatorAddressSet").withArgs(
                agentId3,
                agent3.address,
                admin.address
            );

            expect(await dockMarketRouter.getAgentProfile(agentId3)).to.eql([false, agentName3, agentTypeA, agent3.address, admin.address]);

            await expect(dockMarketRouter.connect(agent3).setCreatorAddress(
                agentId3,
                agent3
            )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidCaller");

            await expect(dockMarketRouter.connect(admin).setCreatorAddress(
                agentId3,
                agent3.address
            )).to.emit(dockMarketRouter, "CreatorAddressSet").withArgs(
                agentId3,
                admin.address,
                agent3.address
            );

            expect(await dockMarketRouter.getAgentProfile(agentId3)).to.eql([false, agentName3, agentTypeA, agent3.address, agent3.address]);
        });
    });
});