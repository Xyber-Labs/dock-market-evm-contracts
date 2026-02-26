const {
    agentId, agentId3, agentName, agentName3, agentTypeC, agentTypeA, staticCallGasLimit, defaultPerformanceFeeRate, defaultManagementFeeRate,
    defaultMaxDepositValue, transferGasLimit
} = require("./GlobalConstants");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { AbiCoder, zeroAddress } = require("./DockMarketUtils");
const { UniswapV3Fixture } = require("./UniswapV3Fixture");
const { ethers } = require("hardhat");
const { expect } = require("chai");

const DockMarketModule = require("../../ignition/modules/DockMarketModule");

async function DockMarketFixture() {
    const [admin, user, collector, user2, agent, agent2, agent3] = await ethers.getSigners();
    const {
        weth, uniswapFactory, tokenDescriptor, posManager, swapRouter, quoter, uniswapV3PoolAbi, uniswapV3PoolBytecode, usdc, usdt, mainToken,
        wethUsdcPool, wethTokenPool, usdp, usdcUsdpPool
    } = await loadFixture(UniswapV3Fixture);

    const Mock = await ethers.getContractFactory("Mock", admin);
    const mock = await Mock.deploy();
    await mock.waitForDeployment();

    const ERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock", admin);
    const permitToken = await ERC20PermitMock.deploy("", "", 18n);
    await permitToken.waitForDeployment();

    const UniswapOracle = await ethers.getContractFactory("UniswapOracle", admin);
    const uniswapOracle = await UniswapOracle.deploy();
    await uniswapOracle.waitForDeployment();

    const bodyPartOne = require('../data/testCert.json').bodyPartOne;
    const publicKey = require('../data/testCert.json').publicKey;
    const bodyPartTwo = require('../data/testCert.json').bodyPartTwo;
    const signature = require('../data/testCert.json').signature;
    const leaf = require('../data/testCert.json').leaf;
    const intermediate = require('../data/testCert.json').intermediate;

    const initCalldataParams = AbiCoder.encode([
        "address",
        "tuple(bytes,bytes,bytes,bytes)"
    ], [
        admin.address,
        [bodyPartOne, publicKey, bodyPartTwo, signature]
    ]);

    const initCalldata = ethers.id('initialize(address,(bytes,bytes,bytes,bytes))').substring(0, 10) + initCalldataParams.slice(2);
    const initCalldataSimple = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

    const {
        dockMarketWalletBeacon,
        dockMarketRouterImplementation,
        dockMarketRouterProxy,
        dockMarketWalletImplementation,
        dockMarketSimpleRouterImplementation,
        dockMarketSimpleRouterProxy
    } = await ignition.deploy(DockMarketModule, {
        parameters: {
            DockMarketModule: {
                initialOwner: admin.address,
                initializeCalldata: initCalldata,
                initializeCalldataSimple: initCalldataSimple,
                uniswapOracleAddress: uniswapOracle.target,
                wethAddress: weth.target,
                usdcAddress: usdc.target,
                usdcWethUniswapPoolAddress: wethUsdcPool.target,
                staticCallGasLimit: staticCallGasLimit,
                transferGasLimit: transferGasLimit,
                usdc: usdc.target,
                usdcE: usdp.target,
                swapRouter: swapRouter.target
            },
        },
    });

    await dockMarketWalletBeacon.connect(admin).upgradeTo(dockMarketWalletImplementation.target);

    expect(await dockMarketWalletBeacon.implementation()).to.equal(dockMarketWalletImplementation.target);

    const dockMarketRouter = await ethers.getContractAt("DockMarketRouter", dockMarketRouterProxy);
    const dockMarketSimpleRouter = await ethers.getContractAt("DockMarketSimpleRouter", dockMarketSimpleRouterProxy);

    expect(await dockMarketRouter.verifyCert([bodyPartOne, publicKey, bodyPartTwo, signature], publicKey)).to.equal(true);

    const adminRole = await dockMarketRouter.DEFAULT_ADMIN_ROLE();
    const sessionAdminRole = await dockMarketRouter.SESSION_ADMIN_ROLE();

    const signerRole = await dockMarketSimpleRouter.SIGNER_ROLE();
    const managerRole = await dockMarketSimpleRouter.MANAGER_ROLE();
    const depositorRole = await dockMarketSimpleRouter.DEPOSITOR_ROLE();
    const schedulerRole = await dockMarketSimpleRouter.SCHEDULER_ROLE();

    await dockMarketRouter.connect(admin).setFeeCollector(collector.address);
    await dockMarketRouter.connect(admin).setPerfomanceFeeRate(defaultPerformanceFeeRate);
    await dockMarketRouter.connect(admin).setManagementFeeRate(defaultManagementFeeRate);
    await dockMarketRouter.connect(admin).setMaxDepositValue(defaultMaxDepositValue);
    await dockMarketRouter.connect(admin).grantRole(sessionAdminRole, admin.address);

    await dockMarketSimpleRouter.connect(admin).initializeV2();
    await dockMarketSimpleRouter.connect(admin).initializeV3();
    await dockMarketSimpleRouter.connect(admin).setProtocolFeeReceiver(collector.address);
    await dockMarketSimpleRouter.connect(admin).grantRole(managerRole, admin.address);
    await dockMarketSimpleRouter.connect(admin).grantRole(depositorRole, admin.address);
    await dockMarketSimpleRouter.connect(admin).grantRole(schedulerRole, admin.address);
    await dockMarketSimpleRouter.connect(admin).grantRole(signerRole, admin.address);

    const sessionMrEnclave = require('../data/testQuote.json')[0].mrEnclave;

    const quote1Init = [
        require('../data/testQuote.json')[0].header,
        require('../data/testQuote.json')[0].isvReport,
        require('../data/testQuote.json')[0].isvReportSignature,
        require('../data/testQuote.json')[0].attestationKey,
        require('../data/testQuote.json')[0].qeReport,
        require('../data/testQuote.json')[0].qeReportSignature,
        require('../data/testQuote.json')[0].qeAuthenticationData
    ];

    await expect(dockMarketRouter.connect(admin).setMrEnclave(
        sessionMrEnclave,
        true
    )).to.emit(dockMarketRouter, "MrEnclaveSet").withArgs(
        sessionMrEnclave,
        true,
        admin.address
    );

    expect(await dockMarketRouter.mrEnclaveAuthorized(sessionMrEnclave)).to.equal(true);

    await expect(dockMarketRouter.connect(admin).initSessionKey(
        leaf,
        intermediate,
        quote1Init,
        agentId,
        agentName,
        agentTypeC,
        agent.address,
        zeroAddress
    )).to.emit(dockMarketRouter, "SessionInitialized").withArgs(
        agentId,
        agentName,
        agentTypeC,
        agent.address,
        sessionMrEnclave,
        admin.address
    ).to.emit(dockMarketRouter, "CreatorAddressSet").withArgs(
        agentId,
        zeroAddress,
        zeroAddress
    );

    await dockMarketRouter.connect(admin).createWallet(user.address, agentId);

    const { walletAddress, _ } = await dockMarketRouter.getWalletAddress(user.address, agentId);

    const userWallet = await ethers.getContractAt("DockMarketWallet", walletAddress);

    const quote1Reinit = [
        require('../data/testQuote.json')[1].header,
        require('../data/testQuote.json')[1].isvReport,
        require('../data/testQuote.json')[1].isvReportSignature,
        require('../data/testQuote.json')[1].attestationKey,
        require('../data/testQuote.json')[1].qeReport,
        require('../data/testQuote.json')[1].qeReportSignature,
        require('../data/testQuote.json')[1].qeAuthenticationData
    ];

    const quote2Init = [
        require('../data/testQuote.json')[2].header,
        require('../data/testQuote.json')[2].isvReport,
        require('../data/testQuote.json')[2].isvReportSignature,
        require('../data/testQuote.json')[2].attestationKey,
        require('../data/testQuote.json')[2].qeReport,
        require('../data/testQuote.json')[2].qeReportSignature,
        require('../data/testQuote.json')[2].qeAuthenticationData
    ];

    await expect(dockMarketRouter.connect(admin).initSessionKey(
        leaf,
        intermediate,
        quote2Init,
        agentId3,
        agentName3,
        agentTypeA,
        agent3.address,
        agent3.address
    )).to.emit(dockMarketRouter, "SessionInitialized").withArgs(
        agentId3,
        agentName3,
        agentTypeA,
        agent3.address,
        sessionMrEnclave,
        admin.address
    ).to.emit(dockMarketRouter, "CreatorAddressSet").withArgs(
        agentId3,
        zeroAddress,
        agent3.address
    );

    return {
        admin, user, collector, user2, weth, uniswapFactory, tokenDescriptor, posManager, swapRouter, quoter, uniswapV3PoolAbi, uniswapV3PoolBytecode,
        usdc, usdt, mainToken, wethUsdcPool, wethTokenPool, uniswapOracle, userWallet, dockMarketRouter, dockMarketWalletBeacon, leaf, quote1Init, mock,
        dockMarketRouterImplementation, dockMarketRouterProxy, dockMarketWalletImplementation, adminRole, sessionAdminRole, agent, agent2, agent3,
        intermediate, sessionMrEnclave, quote1Reinit, dockMarketSimpleRouterImplementation, dockMarketSimpleRouter, managerRole, depositorRole,
        schedulerRole, permitToken, signerRole, usdp, usdcUsdpPool
    };
};

module.exports = { DockMarketFixture };