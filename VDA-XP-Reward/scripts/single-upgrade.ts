import hre, { ethers, upgrades } from "hardhat";
import { VDARewardContract } from "../typechain-types";
import * as tokenArtifact from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json"

import { saveDeployedAddress } from "./utils";

async function main() {

  const proxyAddress = "0x5A7c6101b79eFf376dDe1518BC227B1269305657";
  const contractFactory = await ethers.getContractFactory("VDARewardContract");

  const upgradeCall = await upgrades.upgradeProxy(proxyAddress, contractFactory);
  const contract = await upgradeCall.deployed();

  const newImplAddress = hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("New Implementation : ", newImplAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});