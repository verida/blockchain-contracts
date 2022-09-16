import { ethers, upgrades } from "hardhat";
import { VDARewardContract } from "../typechain-types";

async function main() {
  const rewardTokenAddress = "0x..."

  const contractFactory = await ethers.getContractFactory("VDARewardContract")
  const contract = (await upgrades.deployProxy(
      contractFactory,
      [rewardTokenAddress],
      {
          initializer: '__VDARewardContract_init'
      }
  )) as VDARewardContract
  await contract.deployed()
  console.log('RewardContract deployed at : ', contract.address)

  const tokenContract = await ethers.getContractAt("IERC20", rewardTokenAddress)
  
  const INIT_SUPPLY = ethers.utils.parseUnits(
    "100000",
    await tokenContract.decimals()
  )
  await tokenContract.mint(contract.address, INIT_SUPPLY)

  console.log('Reward token minted to RewardContract:', INIT_SUPPLY.toString())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
