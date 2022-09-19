import { ethers, upgrades } from "hardhat";

async function main() {
  const contractFactory = await ethers.getContractFactory("RewardToken");
  const contract = await upgrades.deployProxy(
    contractFactory,
    [],
    {
      initializer: "__RewardToken_init",
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

// 2022/9/19
// Mumbai : 0xCb9e0Ae6b27AD593f8b17A47366c743649763523