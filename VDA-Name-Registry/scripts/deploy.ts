// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  const contractFactory = await ethers.getContractFactory("NameRegistry");
  const contract = await contractFactory.deploy();

  await contract.deployed();

  console.log("NameRegistry deployed to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Deployed Address
// BSC TestNet
// 0xD13E95913649c78c2d99591533a85a5ecf815e34