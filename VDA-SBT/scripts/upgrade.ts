import hre, { ethers, upgrades } from "hardhat";
import { saveDeployedAddress } from "./utils";

async function main() {
  
  // We get the contract to deploy
  const contractFactory = await ethers.getContractFactory('SoulboundNFT');

  const contract = await upgrades.upgradeProxy(
    '0x7201189556bAF5B58b74FDf99C1957A064B87548',
    contractFactory
  );

  await contract.deployed();

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr);
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(
    proxyAddr
  );

  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);
  console.log("SBT contract upgraded to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
