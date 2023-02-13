import hre, { ethers, upgrades } from "hardhat";
import { saveDeployedAddress } from "./utils";

async function main() {
  
  // We get the contract to deploy
  const vdaFactory = await ethers.getContractFactory('VeridaToken');
  const vda = await upgrades.deployProxy(vdaFactory, {initializer: 'initialize'});
  await vda.deployed();

  const proxyAddr = vda.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr);
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(
    proxyAddr
  );

  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);

  console.log("VDA deployed to:", vda.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
