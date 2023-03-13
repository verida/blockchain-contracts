import hre, { ethers, defender } from "hardhat";

async function main() {
  const proxyAddress = "0xAe6e2c3f2C82f0a5fb9742368ffB062dC6AF5400";

  // const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);
  // console.log("Proxy Admin : ", adminAddr);

  const NameRegistryV2 = await ethers.getContractFactory("NameRegistryV2");
  console.log("Preparing proposal...");
  const proposal = await defender.proposeUpgrade(proxyAddress, NameRegistryV2);
  console.log("Upgrade proposal created at:", proposal.url);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
