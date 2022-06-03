// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function main() {
  const contractFactory = await ethers.getContractFactory("NameRegistry");
  const contract = await upgrades.deployProxy(contractFactory, {
    initializer: "initialize",
  });

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
// 2022/5/6 12:54
// 0x1e48398CB21E4C228De595859598cdE12D1A0435

// 2022/6/3 16: Upgradeable contract
// 0x5c5CA3376b2C82f0322DB9dEE0504D2565080865
