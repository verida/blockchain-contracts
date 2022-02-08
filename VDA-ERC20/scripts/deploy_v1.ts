import { ethers, upgrades } from "hardhat";

async function main() {
  
  // We get the contract to deploy
  const vdaFactory = await ethers.getContractFactory('VeridaToken');
  const vda = await upgrades.deployProxy(vdaFactory, {initializer: 'initialize'});
  await vda.deployed();

  console.log("VDA deployed to:", vda.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
