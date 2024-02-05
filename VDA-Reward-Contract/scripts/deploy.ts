import hre, { ethers, upgrades } from "hardhat";
import { VDARewardContract } from "../typechain-types";
import * as tokenArtifact from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json"

import { saveDeployedAddress } from "./utils";

async function main() {
  // const rewardTokenAddress = "<Input Verida token address>"
  // Polygon mainnet
  // const rewardTokenAddress = "0x64CE49E8249b5a8456CC8759A993f7B24854e199"

  // Polygon testnet
  const rewardTokenAddress = ""; //"0x1CD8557B2cBCfad36a1dAcB702FD7Bc90a4Fcf98"
  const storageNodeRegistryAddress = ""; //"0xDbFa75B77f573677C2b3aA08d016b7E6A2e554C9"

  const contractFactory = await ethers.getContractFactory("VDARewardContract")
  const contract = (await upgrades.deployProxy(
      contractFactory,
      [rewardTokenAddress, storageNodeRegistryAddress],
      {
          initializer: '__VDARewardContract_init',
          timeout: 0,
          pollingInterval: 5000,
      },
  )) as VDARewardContract
  await contract.deployed()

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr)
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(proxyAddr)
  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);

  console.log('RewardContract deployed at : ', contract.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});