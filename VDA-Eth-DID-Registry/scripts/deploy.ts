// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const RegistryContract = await ethers.getContractFactory('EthereumDIDRegistry')
  const contractInstance = await RegistryContract.deploy()

  await contractInstance.deployed()

  console.log('RegistryContract deployed to:', contractInstance.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

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