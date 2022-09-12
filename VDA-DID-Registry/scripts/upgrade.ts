// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import Axios from 'axios'
import { Initializable } from '../typechain/Initializable';

const getMaticFee = async (isProd : boolean) => {
  let maxFeePerGas = ethers.BigNumber.from(40000000000) // fallback to 40 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(40000000000) // fallback to 40 gwei
  let gasLimit = ethers.BigNumber.from(50000000000) // fallback to 50 gwei

  try {
    const { data } = await Axios({
        method: 'get',
        url: isProd
        ? 'https://gasstation-mainnet.matic.network/v2'
        : 'https://gasstation-mumbai.matic.today/v2',
    })
    console.log('Result : ', data)
    maxFeePerGas = ethers.utils.parseUnits(
        Math.ceil(data.fast.maxFee) + '',
        'gwei'
    )
    maxPriorityFeePerGas = ethers.utils.parseUnits(
        Math.ceil(data.fast.maxPriorityFee) + '',
        'gwei'
    )
  } catch {
      // ignore
      console.log('Error in get gasfee')
  }

  return {maxFeePerGas, maxPriorityFeePerGas, gasLimit}

}

async function upgrade() {

  const [deployer] = await ethers.getSigners()
  console.log("Upgrading contracts with the account: ", deployer.address)
  console.log("Current account balance: ", (await deployer.getBalance()).toString())
  console.log();

  let callOverrides = {}
  // if (hre.network.config.chainId === 0x89 || hre.network.config.chainId === 0x13881) {
    // callOverrides = await getMaticFee(hre.network.config.chainId === 0x89)
  // }

  console.log("Call Overrides: ", callOverrides)



  // CHange these values for the upgrade. 
  const contractProxyDeployed = ""
  const oldContract = "VeridaDIDRegistry"
  const newContract = "VeridaDIDRegistryV1"


  const contractFactoryOLD = await ethers.getContractFactory(oldContract);
  const contractFactoryOLDAttached = contractFactoryOLD.attach(contractProxyDeployed);

  // console.log(contractFactoryOLDAttached)
  console.log("Owner of the old contract: ", await contractFactoryOLDAttached.callStatic.owner())

  

  const contractFactoryNew = await ethers.getContractFactory(newContract);

  const contractUpgradeCall = await upgrades.upgradeProxy(contractProxyDeployed, contractFactoryNew, {
    timeout: 0,
    pollingInterval: 5000,
  })
  console.log("contractUpgradeCall > Deployed transaction: ")
  console.log(contractUpgradeCall.deployTransaction)

  console.log(oldContract + " upgraded to " + newContract + " via transaction hash: " + contractUpgradeCall.deployTransaction.hash)

  // const contractFactoryNewAttached = contractFactoryNew.attach(contractProxyDeployed);
  console.log("Read version of upgraded contract : " + await contractUpgradeCall.getVersion())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
upgrade().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Polygon testnet
// https://mumbai.polygonscan.com/address/0x704895251182592fE8AF39839d3b293d8a184f01#code
// Updated With Bulk
// 0xF1BfbE384517c10f6839606CFAcf6854f0F40876

// BSC testnet
// 0xb525f4bC2b186FA153099D86488e40621592464b
// Updated with Bulk
// 0x258A75E9DF2F3BfB8b0854A7A7003044B3d94e0E

// Final : bulkAdd & bulkRevoke
// 0x5Ed257A2BD6FABDD6CF9EceeCCE6c0Aa97d407a4

// 2022/5/2 Updated for Signature
// BSCTest: 0x2862BC860f55D389bFBd1A37477651bc1642A20B

// 2022/5/10 : Updated Contract name to VeridaDIDRegistry
// BSCTest: 0xC1fE55A1aa03Ca498E335B70972Bf81416671bd7 

// 2022/8/3 : Upgraded to upgradeable contracts.
// BSC
//Proxy : 0xF77dCA117785deB78C906aEc10E2C597cc3F0B2E
//Impl : 0xcA3401026AddC97B7f42f7F2aC1d2275B13849cb

// Polygon
// Proxy : 0x23a985FdB6c36aC6fB15eb23c41d5C6Ec97f5b2F
// Impl : 0x28c0bA86370C1f566f6e1926E2f7f3d4A2426683

// 2022/8/22 : Upgradeable & VeridaSignature
// Proxy : 0xaF27489EA932De4D6705AA154947d8f94C5A7197
// Impl : 0xEc961fDc490a855908f5a1290B74Dcea255C6878

// 2022/8/24 : Minor updates on setAttribute()
// Proxy : 0x854563D0Ab37f3A4546E54CE12908f177A115a53
// Impl : 0x981B383B45Ee339C9Abfa998e62B70195EA24a51

// 2022/8/25 : Update proof & nonce
// Proxy : 0xDd108e3E6fAdb59a9E080b73c5027E98fd44a7f2
// Impl : 0x6BD1b46F87F30808dc4A18718Bb63dcdeC584a6D