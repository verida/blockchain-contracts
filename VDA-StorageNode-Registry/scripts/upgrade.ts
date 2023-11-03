import hre, { ethers, upgrades } from "hardhat";
import { saveDeployedAddress } from "./utils";

async function main() {
  
  // We get the contract to deploy
  const contractFactory = await ethers.getContractFactory('StorageNodeRegistry');

  const contract = await upgrades.upgradeProxy(
    '',
    contractFactory
  );

  await contract.deployed();

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr);
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(
    proxyAddr
  );

  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);
  console.log("Contract upgraded to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
