import { ethers, upgrades } from "hardhat";

async function main() {
  const rewardSmartContractAddress = "0x268c970A5FBFdaFfdf671Fa9d88eA86Ee33e14B1";

  const contractFactory = await ethers.getContractFactory("RewardToken");
  const contract = await upgrades.deployProxy(
    contractFactory,
    [rewardSmartContractAddress],
    {
      initializer: "",
      timeout: 0,
      pollingInterval: 5000,
    })
  await contract.deployed()

  const balance = await contract.balanceOf(rewardSmartContractAddress)
  const decimal = await contract.decimals()
  ethers.utils.parseUnits(balance, decimal)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
