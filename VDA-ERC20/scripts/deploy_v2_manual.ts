import { ethers, upgrades } from "hardhat";

async function main() {
  
  // We get the contract to deploy
  const vda2Factory = await ethers.getContractFactory('VeridaTokenV3');

  const vda2 = await vda2Factory.deploy();

  console.log("VDA2 deployed to:", vda2.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
