import hre, { ethers, upgrades } from "hardhat";
import { saveDeployedAddress } from "./utils";

async function main() {
  const v2Factory = await ethers.getContractFactory("NameRegistryV2");
  const proxyAddress = "<Input the proxy contract address>";
  // const proxyAddress = "0x91381c424485dc12650811601d9a8B0025e51afc"; // Amoy test net
  const contract = await upgrades.upgradeProxy(
    proxyAddress,
    v2Factory
  );

  await contract.deployed();

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr);
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(
    proxyAddr
  );

  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);
  console.log("NameRegistry upgraded to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
