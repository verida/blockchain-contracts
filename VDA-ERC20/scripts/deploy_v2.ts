import { ethers, upgrades } from "hardhat";

async function main() {
  
  // We get the contract to deploy
  const vda2Factory = await ethers.getContractFactory('VeridaTokenV2');

  const vda2 = await upgrades.upgradeProxy(
    '0x123',
    vda2Factory
  );

  await vda2.deployed();

  console.log("VDA deployed to:", vda2.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
