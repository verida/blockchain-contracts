// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const contractFactory = await ethers.getContractFactory(
    "VeridaDIDRegistry"
  );

  /*
  const deploymentData = contractFactory.interface.encodeDeploy()
  const estimatedGas = await ethers.provider.estimateGas({data: deploymentData})
  // contractFactory.getDeployTransaction()

  const { gasPrice } = ethers.provider.getFeeData()
  */

  const contract = await upgrades.deployProxy(contractFactory, {
    initializer: "initialize",
    timeout: 0,
    pollingInterval: 5000,
  })

  await contract.deployed();

  console.log("RegistryContract deployed to:", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Polygon testnet
// https://mumbai.polygonscan.com/address/0x704895251182592fE8AF39839d3b293d8a184f01#code
// Updated With Bulk
// 0xF1BfbE384517c10f6839606CFAcf6854f0F40876

// BSC testnet
// 0xb525f4bC2b186FA153099D86488e40621592464b
// Updated with Bulk
// 0x258A75E9DF2F3BfB8b0854A7A7003044B3d94e0E

// Final : bulkAdd & bulkRevoke
// 0x5Ed257A2BD6FABDD6CF9EceeCCE6c0Aa97d407a4

// 2022/5/2 Updated for Signature
// BSCTest: 0x2862BC860f55D389bFBd1A37477651bc1642A20B

// 2022/5/10 : Updated Contract name to VeridaDIDRegistry
// BSCTest: 0xC1fE55A1aa03Ca498E335B70972Bf81416671bd7 

// 2022/8/3 : Upgraded to upgradeable contracts.
// BSC
//Proxy : 0xF77dCA117785deB78C906aEc10E2C597cc3F0B2E
//Impl : 0xcA3401026AddC97B7f42f7F2aC1d2275B13849cb

// Polygon
// Proxy : 0x23a985FdB6c36aC6fB15eb23c41d5C6Ec97f5b2F
// Impl : 0x28c0bA86370C1f566f6e1926E2f7f3d4A2426683
