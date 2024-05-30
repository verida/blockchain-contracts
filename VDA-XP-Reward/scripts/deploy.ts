import hre, { ethers, upgrades } from "hardhat";
import { VDAXPReward } from "../typechain-types";

import { saveDeployedAddress } from "./utils";

import { VeridaToken } from "@verida/erc20-contract/typechain-types";
import { abi as TokenABI, bytecode as TokenByteCode } from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json";

async function deployMockToken() : Promise<VeridaToken> {
  const tokenFactory = await ethers.getContractFactory(TokenABI, TokenByteCode)
  const token = await tokenFactory.deploy() as VeridaToken
  await token.deployed()
  await token.initialize();

  await token.enableTransfer();

  return new Promise<VeridaToken>((resolve) => {
    resolve(token);
  });
}

async function main() {
  const rewardTokenAddress = "<Input Verida token address>"
  // Polygon mainnet
  // const rewardTokenAddress = ""
  // Polygon testnet
  // const rewardTokenAddress = ""; //""

  // Deploy Mock Token
  // const rewardTokenAddress = (await deployMockToken()).address;
  // const rewardTokenAddress = "0x61a544D5210FC82679f3322461F38C28D75a20A6"
  console.log("Mock Token Deployed : ", rewardTokenAddress);

  const contractFactory = await ethers.getContractFactory("VDAXPReward")
  const contract = (await upgrades.deployProxy(
      contractFactory,
      [rewardTokenAddress],
      {
          initializer: '__VDAXPReward_init',
          timeout: 0,
          pollingInterval: 5000,
      },
  )) as VDAXPReward
  await contract.deployed()

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr)
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(proxyAddr)
  await saveDeployedAddress(hre.network.name, proxyAddr, adminAddr, implAddr);

  console.log('XPRewardContract deployed at : ', contract.address)

  const [owner] = await ethers.getSigners();
  console.log("Deployer : ", owner.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});