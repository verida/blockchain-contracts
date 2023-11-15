import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// For upgradeable deploy
import "@openzeppelin/hardhat-upgrades";
// For verification after deploy
import "@nomiclabs/hardhat-ethers"
// For defender
import "@openzeppelin/hardhat-defender"

dotenv.config({ path: __dirname + "/.env"});
const {PRIVATE_KEY, ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, POLYGON_TESTNET_RPC, POLYGON_MAINNET_RPC} = process.env;

const config: HardhatUserConfig = {
  defender: {
    apiKey: process.env.DEFENDER_TEAM_API_KEY!,
    apiSecret: process.env.DEFENDER_TEAM_API_SECRET_KEY!,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      },
    ],
  },
  networks: {
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
};

export default config;
