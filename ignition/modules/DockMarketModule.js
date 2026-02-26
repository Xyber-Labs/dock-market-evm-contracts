const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("DockMarketModule", (m) => {

    const initialOwner = m.getParameter("initialOwner");
    const initializeCalldata = m.getParameter("initializeCalldata");
    const initializeCalldataSimple = m.getParameter("initializeCalldataSimple");
    const uniswapOracleAddress = m.getParameter("uniswapOracleAddress");
    const wethAddress = m.getParameter("wethAddress");
    const usdcAddress = m.getParameter("usdcAddress");
    const usdcWethUniswapPoolAddress = m.getParameter("usdcWethUniswapPoolAddress");
    const staticCallGasLimit = m.getParameter("staticCallGasLimit");
    const transferGasLimit = m.getParameter("transferGasLimit");
    const usdc = m.getParameter("usdc");
    const usdcE = m.getParameter("usdcE");
    const swapRouter = m.getParameter("swapRouter");
    
    const dockMarketWalletBeacon = m.contract("DockMarketWalletBeacon", [initialOwner]);

    const dockMarketRouterImplementation = m.contract("DockMarketRouter", [
        uniswapOracleAddress,
        dockMarketWalletBeacon,
        wethAddress,
        usdcAddress,
        usdcWethUniswapPoolAddress,
        staticCallGasLimit
    ]);

    const dockMarketRouterProxy = m.contract('ERC1967Proxy', [dockMarketRouterImplementation, initializeCalldata]);

    const dockMarketWalletImplementation = m.contract("DockMarketWallet", [
        dockMarketRouterProxy,
        wethAddress
    ]);

    const dockMarketSimpleRouterImplementation = m.contract("DockMarketSimpleRouter", [
        transferGasLimit,
        usdc,
        usdcE,
        swapRouter
    ]);

    const dockMarketSimpleRouterProxy = m.contract('ERC1967Proxy', [dockMarketSimpleRouterImplementation, initializeCalldataSimple], { id: "SimpleRouter" });

    return { 
        dockMarketWalletBeacon, dockMarketRouterImplementation, dockMarketRouterProxy, dockMarketWalletImplementation,
        dockMarketSimpleRouterImplementation, dockMarketSimpleRouterProxy
    };
});