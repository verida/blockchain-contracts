import hre, { ethers, defender } from "hardhat";
import contractAddresses from "./contract-address.json"

async function main() {
  // Change the address to the proxy address of targeting network
  const proxyAddress = contractAddresses.goerli.Proxy;

  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);
  console.log("Proxy Admin Address : ", adminAddr);

  const contractFactory = await ethers.getContractFactory("VDARewardContract");
  console.log("Preparing proposal...");
  const proposal = await defender.proposeUpgrade(proxyAddress, contractFactory);
  console.log("Upgrade proposal created at:", proposal.url);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
