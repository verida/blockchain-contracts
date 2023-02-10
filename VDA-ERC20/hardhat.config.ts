import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

// For upgradeable - deploy
import "@openzeppelin/hardhat-upgrades";
// For verify 
import "@nomiclabs/hardhat-ethers"

dotenv.config({path: __dirname + '/.env'});
const {PRIVATE_KEY, ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, POLYGON_TESTNET_RPC, POLYGON_MAINNET_RPC} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // hardhat: {
    //   forking: {
    //     url: "https://eth-mainnet.alchemyapi.io/v2/8083RqnyKiUZRjMqH28dBbb6BDhEjcm8",
    //     // blockNumber : 100
    //   }
    // },
    goerli: {
      url: "https://eth-goerli.public.blastapi.io", //https://goerli.infura.io/v3/
      chainId: 5,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    polygonmainnet: {
      url: POLYGON_MAINNET_RPC !== undefined ? POLYGON_MAINNET_RPC : "https://polygon-rpc.com/",
      chainId: 137,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    polygontestnet: {
      url: POLYGON_TESTNET_RPC !== undefined ? POLYGON_TESTNET_RPC : "https://matic-mumbai.chainstacklabs.com",
      chainId: 80001,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
