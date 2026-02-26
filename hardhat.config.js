require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require('dotenv').config();

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            allowUnlimitedContractSize: false,
        },
        base: {
            url: process.env.BASE_RPC_URL !== undefined ? process.env.BASE_RPC_URL : "https://base.llamarpc.com",
            chainId: 8453,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL !== undefined ? process.env.BASE_SEPOLIA_RPC_URL : "https://base-sepolia.drpc.org",
            chainId: 84532,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        polygon: {
            url: process.env.POLYGON_RPC_URL !== undefined ? process.env.POLYGON_RPC_URL : "https://poly.api.pocket.network",
            chainId: 137,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        amoy: {
            url: process.env.AMOY_RPC_URL !== undefined ? process.env.AMOY_RPC_URL : "https://polygon-amoy.drpc.org",
            chainId: 80002,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        }
    },

    etherscan: {
        apiKey: {
            base: process.env.BASE_API_KEY,
            baseSepolia: process.env.BASE_API_KEY
        }
    },

    solidity: {
        compilers: [
            {
                version: "0.8.28",
                settings: {
                    viaIR: true,
                    evmVersion: "cancun",
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],
        overrides: {
            "contracts/DockMarketRouter.sol": {
                version: "0.8.28",
                settings: {
                    viaIR: true,
                    evmVersion: "cancun",
                    optimizer: {
                        enabled: true,
                        runs: 400,
                    },
                },
            },
            "contracts/mock/DockMarketRouterV2.sol": {
                version: "0.8.28",
                settings: {
                    viaIR: true,
                    evmVersion: "cancun",
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },
            "contracts/mock/WETH.sol": {
                version: "0.4.18",
                settings: {
                    evmVersion: "spuriousDragon",
                    optimizer: {
                        enabled: false
                    },
                },
            },
            "contracts/test.sol": {
                version: "0.7.6",
                settings: {
                    evmVersion: "spuriousDragon",
                    optimizer: {
                        enabled: false
                    },
                },
            },
            "@uniswap/v3-periphery/contracts/interfaces/external/IWETH9.sol": {
                version: "0.7.6",
                settings: {
                    evmVersion: "spuriousDragon",
                    optimizer: {
                        enabled: false
                    },
                },
            },
            "@uniswap/v3-periphery/contracts/base/PeripheryImmutableState.sol": {
                version: "0.7.6",
                settings: {
                    evmVersion: "spuriousDragon",
                    optimizer: {
                        enabled: false
                    },
                },
            },
            "@uniswap/v3-periphery/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol": {
                version: "0.7.6",
                settings: {
                    evmVersion: "spuriousDragon",
                    optimizer: {
                        enabled: false
                    },
                },
            },
            "@uniswap/v3-periphery/node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol": {
                version: "0.7.6",
                settings: {
                    evmVersion: "spuriousDragon",
                    optimizer: {
                        enabled: false
                    },
                },
            },
        },
    },

    gasReporter: {
        enabled: false,
    },

    contractSizer: {
        alphaSort: false,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
        only: [],
    }
}