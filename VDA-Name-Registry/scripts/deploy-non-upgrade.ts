import { ethers } from "hardhat";

async function main() {
  const contractFactory = await ethers.getContractFactory("NameRegistryV2");
  const contract = await contractFactory.deploy();

  await contract.deployed();
  
  console.log("NameRegistryV2 deployed at : ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
