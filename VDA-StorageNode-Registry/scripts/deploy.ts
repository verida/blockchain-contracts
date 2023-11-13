import hre, { ethers, upgrades } from "hardhat";
import { saveDeployedAddress } from "./utils";

async function main() {
  const vdaTokenAddress = '0x<Vda token address>';
  // Mainnet token
  // const vdaTokenAddress = '0x64CE49E8249b5a8456CC8759A993f7B24854e199';

  const contractFactory = await ethers.getContractFactory("StorageNodeRegistry");
  const contract = await upgrades.deployProxy(
    contractFactory,
    [vdaTokenAddress],
    {
      initializer: "initialize",
      timeout: 0,
      pollingInterval: 5000,
    }
  );

  

  await contract.deployed();

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr);
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(
    proxyAddr
  );

  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);
  console.log("Contract deployed to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});