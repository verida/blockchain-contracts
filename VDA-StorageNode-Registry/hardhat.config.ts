import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// For verification after deploy
// import "@nomiclabs/hardhat-ethers"
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env"});
const {PRIVATE_KEY, ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, POLYGON_TESTNET_RPC, POLYGON_MAINNET_RPC} = process.env;


const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
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
  sourcify: {
    enabled: true
  }
};

export default config;
