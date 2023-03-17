import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import * as dotenv from "dotenv";

// For verify
import "@nomiclabs/hardhat-ethers";
// For upgradeable - deploy
import "@openzeppelin/hardhat-upgrades";
// For defender
import "@openzeppelin/hardhat-defender";

dotenv.config({path: __dirname + '/.env'})
const {PRIVATE_KEY, POLYGONSCAN_API_KEY, RPC_URL_POLYGON, RPC_URL_MUMBAI} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          }
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    polygonmainnet: {
      url: RPC_URL_POLYGON !== undefined ? RPC_URL_POLYGON : "https://polygon-rpc.com/",
      chainId: 137,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    polygontestnet: {
      url: RPC_URL_MUMBAI !== undefined ? RPC_URL_MUMBAI : "https://matic-mumbai.chainstacklabs.com",
      chainId: 80001,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [], 
      gas: 2100000,
      gasPrice: 8000000000
    },
    goerli: {
      url: "https://eth-goerli.public.blastapi.io", //https://goerli.infura.io/v3/
      chainId: 5,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
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
