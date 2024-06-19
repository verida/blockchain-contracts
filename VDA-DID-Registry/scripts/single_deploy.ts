import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

import { saveDeployedAddress, getMaticFee } from "./utils";

async function main() {

  // Deploy Contract
  const contractFactory = await ethers.getContractFactory("VeridaDIDRegistryV2");
  const contract = await contractFactory.deploy();

  await contract.deployed();

  console.log("Contract Deployed : ", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
