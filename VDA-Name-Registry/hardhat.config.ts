import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

// For BSC verification after deploy
import "@nomiclabs/hardhat-ethers";
// For upgradeable - deploy
import "@openzeppelin/hardhat-upgrades";

const { privateKey, polygonscan, bscscan } = require("/mnt/Work/Sec/test.json");

dotenv.config({ path: __dirname + "/.env" });

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
    version: "0.8.7",
  },
  networks: {
    bsctestnet: {
      // url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      url: "https://speedy-nodes-nyc.moralis.io/bd1c39d7c8ee1229b16b4a97/bsc/testnet",
      chainId: 97,
      accounts: [privateKey],
    },
    bscmainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [privateKey],
    },
    polygonmainnet: {
      url: "https://polygon-rpc.com/",
      chainId: 137,
      accounts: [privateKey],
    },
    polygontestnet: {
      url: "https://rpc-mumbai.maticvigil.com/",
      chainId: 80001,
      accounts: [privateKey],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: bscscan,
  },
};

export default config;
