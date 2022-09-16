import { ethers, upgrades } from "hardhat";

async function main() {
  const contractFactory = await ethers.getContractFactory("RewardToken");
  const contract = await upgrades.deployProxy(
    contractFactory,
    [],
    {
      initializer: "",
      timeout: 0,
      pollingInterval: 5000,
    })
  await contract.deployed()
  console.log("RewardToken deployed at : ", contract.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
