// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

import { saveDeployedAddress, getMaticFee } from "./utils";

async function main() {

  let callOverrides = {}
  // if (hre.network.config.chainId === 0x89 || hre.network.config.chainId === 0x13881) {
  //   callOverrides = await getMaticFee(hre.network.config.chainId === 0x89)
  // }

  console.log("Call Overrides: ", callOverrides)

  /*
  ///// Need to deploy separately if library contains public functions
  // Deploy Library
  const verifyLibFactory = await ethers.getContractFactory("VeridaDataVerificationLib");
  const verifyLib = await verifyLibFactory.deploy(callOverrides);
  console.log('Transaction: ', verifyLib.deployTransaction.hash);
  await verifyLib.deployed();

  console.log("Lib deployed to:", verifyLib.address);

  // Deploy Contract
  const contractFactory = await ethers.getContractFactory("VeridaDIDRegistry", {
    libraries: {
      VeridaDataVerificationLib: verifyLib.address
    }
  });
  */

  // Deploy Contract
  const contractFactory = await ethers.getContractFactory("VeridaDIDRegistry");

  /*
  const deploymentData = contractFactory.interface.encodeDeploy()
  const estimatedGas = await ethers.provider.estimateGas({data: deploymentData})
  // contractFactory.getDeployTransaction()

  const { gasPrice } = ethers.provider.getFeeData()
  */

  const contract = await upgrades.deployProxy(contractFactory, {
    initializer: "initialize",
    timeout: 0,
    pollingInterval: 5000,
    
  })

  await contract.deployed();

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr)
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(proxyAddr)
  await saveDeployedAddress(proxyAddr, adminAddr, implAddr);
  
  console.log("RegistryContract deployed to:", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// 2022/9/4 : Version 0.0.6 - Minor updates
// Mumbai : 0x0D10C68F52326C47Dfc3FDBFDCCb37e3b8C852Cb
// BSC Test : 0x1a0A67467DB853486ae328cFdd2d7D51FaefC5E7
