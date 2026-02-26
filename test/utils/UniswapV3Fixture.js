const uniswapV3PoolAbi = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json').abi;
const uniswapV3PoolBytecode = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json').bytecode;

async function getSqrtPriceX96(
    token0,
    token1,
    token0Amount,
    token1Amount
) {
    return token0.target < token1.target ?
        BigInt(Math.sqrt(Number(token1Amount) / Number(token0Amount)) * 2 ** 96) :
        BigInt(Math.sqrt(Number(token0Amount) / Number(token1Amount)) * 2 ** 96);
};

async function createUniswapPool(
    operator,
    uniswapFactory,
    positionManager,
    tokenOne,
    amountOne,
    tokenTwo,
    amountTwo,
    poolFee
) {

    await uniswapFactory.connect(operator).createPool(
        tokenOne.target,
        tokenTwo.target,
        poolFee
    );

    const deployedPool = await ethers.getContractAt(
        uniswapV3PoolAbi,
        await uniswapFactory.getPool(tokenOne.target, tokenTwo.target, poolFee)
    );

    const sqrtPrice = await getSqrtPriceX96(tokenOne, tokenTwo, amountOne, amountTwo);

    await deployedPool.connect(operator).initialize(sqrtPrice);

    await tokenOne.connect(operator).approve(positionManager.target, amountOne);
    await tokenTwo.connect(operator).approve(positionManager.target, amountTwo);

    let tickLower;
    let tickUpper;

    if (poolFee == 100) {
        tickLower = -887272;
        tickUpper = 887272;
    }

    if (poolFee == 500) {
        tickLower = -887270;
        tickUpper = 887270;
    }

    if (poolFee == 3000) {
        tickLower = -887220;
        tickUpper = 887220;
    }

    if (poolFee == 10000) {
        tickLower = -887200;
        tickUpper = 887200;
    }

    await positionManager.connect(operator).mint([
        tokenOne.target < tokenTwo.target ? tokenOne.target : tokenTwo.target,
        tokenOne.target < tokenTwo.target ? tokenTwo.target : tokenOne.target,
        poolFee,
        tickLower,
        tickUpper,
        tokenOne.target < tokenTwo.target ? amountOne : amountTwo,
        tokenOne.target < tokenTwo.target ? amountTwo : amountOne,
        0,
        0,
        operator.address,
        4102444800n
    ]);

    return deployedPool;
};

async function UniswapV3Fixture() {
    const [admin] = await ethers.getSigners();

    const nativeCurrencyLabel = "0x4554480000000000000000000000000000000000000000000000000000000000";

    const WETH = await ethers.getContractFactory("WETH", admin);
    const weth = await WETH.deploy();
    await weth.waitForDeployment();

    const UniswapV3Factory = new ethers.ContractFactory(
        require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json').abi,
        require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json').bytecode,
        admin
    );
    const uniswapFactory = await UniswapV3Factory.deploy();
    await uniswapFactory.waitForDeployment();

    await uniswapFactory.connect(admin).enableFeeAmount(100, 1);

    const NFTDescriptor = new ethers.ContractFactory(
        require('@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json').abi,
        require('@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json').bytecode,
        admin
    );
    const NFTDescriptorLibrary = await NFTDescriptor.deploy();
    await NFTDescriptorLibrary.waitForDeployment();

    const NonfungibleTokenPositionDescriptor = new ethers.ContractFactory(require(
        '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json').abi,
        require(
            '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'
        ).bytecode.replace("__$cea9be979eee3d87fb124d6cbb244bb0b5$__", NFTDescriptorLibrary.target.slice(2)),
        admin
    );
    const tokenDescriptor = await NonfungibleTokenPositionDescriptor.deploy(weth.target, nativeCurrencyLabel);
    await tokenDescriptor.waitForDeployment();

    const NonfungiblePositionManager = new ethers.ContractFactory(
        require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json').abi,
        require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json').bytecode,
        admin
    );
    const posManager = await NonfungiblePositionManager.deploy(uniswapFactory.target, weth.target, tokenDescriptor.target);
    await posManager.waitForDeployment();

    const SwapRouter = new ethers.ContractFactory(
        require('@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json').abi,
        require('@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json').bytecode,
        admin
    );
    const swapRouter = await SwapRouter.deploy(ethers.ZeroAddress, uniswapFactory.target, posManager.target, weth.target);
    await swapRouter.waitForDeployment();

    const QuoterV2 = new ethers.ContractFactory(
        require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json').abi,
        require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json').bytecode,
        admin
    );
    const quoter = await QuoterV2.deploy(uniswapFactory.target, weth.target);
    await quoter.waitForDeployment();

    const ERC20PermitMock = await ethers.getContractFactory("ERC20PermitMock", admin);
    const usdc = await ERC20PermitMock.deploy("ERC20PermitMock", "E20PM", 6n);
    await usdc.waitForDeployment();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock", admin);
    const usdt = await ERC20Mock.deploy(12);
    await usdt.waitForDeployment();

    const mainToken = await ERC20Mock.deploy(18);
    await mainToken.waitForDeployment();

    const usdp = await ERC20Mock.deploy(6n);
    await usdp.waitForDeployment();

    await weth.connect(admin).deposit({ value: 300000000000000000000n });

    const wethTokenPool = await createUniswapPool(
        admin,
        uniswapFactory,
        posManager,
        weth,
        300000000000000000000n,
        mainToken,
        16666666000000000000000000n,
        10000n
    );

    await weth.connect(admin).deposit({ value: 300000000000000000000n });

    const wethUsdcPool = await createUniswapPool(
        admin,
        uniswapFactory,
        posManager,
        weth,
        300000000000000000000n,
        usdc,
        1000000000000n,
        500n
    );

    const usdtUsdcPool = await createUniswapPool(
        admin,
        uniswapFactory,
        posManager,
        usdt,
        1000000000000000000n,
        usdc,
        1000000000000n,
        100n
    );

    const usdcUsdpPool = await createUniswapPool(
        admin,
        uniswapFactory,
        posManager,
        usdp,
        1000000000000n,
        usdc,
        1000000000000n,
        100n
    );

    return {
        admin, weth, uniswapFactory, tokenDescriptor, posManager, swapRouter, quoter, uniswapV3PoolAbi, uniswapV3PoolBytecode, usdc, usdt, mainToken,
        wethTokenPool, wethUsdcPool, usdtUsdcPool, usdp, usdcUsdpPool
    };
}

module.exports = { UniswapV3Fixture, createUniswapPool, getSqrtPriceX96 };