import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import * as dotenv from "dotenv";

// For Verify 
import "@nomiclabs/hardhat-ethers";
// For upgradeable - deploy
import "@openzeppelin/hardhat-upgrades";

dotenv.config()

const {PRIVATE_KEY, POLYGONSCAN_API_KEY} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    polygonmainnet: {
      url: "https://polygon-rpc.com/",
      chainId: 137,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    polygontestnet: {
      url: "http://44.234.36.28:8545",
      chainId: 80001,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: POLYGONSCAN_API_KEY,
  },
  mocha: {
    timeout: 0,
  }
};

export default config;