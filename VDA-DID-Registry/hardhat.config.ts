import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

// For BSC verification after deploy
import "@nomiclabs/hardhat-ethers";
// dotenv.config();
dotenv.config({path: __dirname + '/.env'});
const {PRIVATE_KEY, BSCSCAN_API_KEY, POLYGONSCAN_API_KEY} = process.env;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.7",
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
    tests: "./tPRIVATE_KEYest",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    bsctestnet: {
      // url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      url: "https://speedy-nodes-nyc.moralis.io/bd1c39d7c8ee1229b16b4a97/bsc/testnet",
      chainId: 97,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
    },
    bscmainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
    },
    polygonmainnet: {
      url: "https://polygon-rpc.com/",
      chainId: 137,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
    },
    polygontestnet: {
      url: "https://matic-mumbai.chainstacklabs.com",
      chainId: 80001,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: BSCSCAN_API_KEY,
  },
};

export default config;
