import { upgrades } from "hardhat";

async function main() {
  const gnosisSafe = process.env.SAFE_ADDRESS;

  if (gnosisSafe === undefined)
    throw new Error("Input safe address in the env file");

  console.log("Transferring ownership of ProxyAdmin...");
  // The owner of the ProxyAdmin can upgrade our contracts
  await upgrades.admin.transferProxyAdminOwnership(gnosisSafe);
  console.log("Transferred ownership of ProxyAdmin to:", gnosisSafe);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
