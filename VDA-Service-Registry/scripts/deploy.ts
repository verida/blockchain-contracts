// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const tokenAddr = "0x0000000000000000000000000000000000000000"
  // const tokenContract = await ethers.getContractAt("VDAToken", tokenAddr);
  // const tokenFactory = await ethers.getContractFactory("MockVDA");
  // const tokenContract = await tokenFactory.deploy();
  // await tokenContract.deployed();

  // const tokenAddr = tokenContract.address;

  // We get the contract to deploy
  const registryFactory = await ethers.getContractFactory("ServiceRegistry");
  const registryContract = await registryFactory.deploy(tokenAddr);

  await registryContract.deployed();

  console.log("ServiceRegistry contract deployed to:", registryContract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
