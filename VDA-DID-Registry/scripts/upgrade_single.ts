import { ethers, upgrades } from "hardhat";

async function upgrade() {

  const [deployer] = await ethers.getSigners()
  console.log("Upgrading contracts with the account: ", deployer.address)
  console.log("Current account balance: ", (await deployer.getBalance()).toString())

  let callOverrides = {}
  // if (hre.network.config.chainId === 0x89 || hre.network.config.chainId === 0x13881) {
    // callOverrides = await getMaticFee(hre.network.config.chainId === 0x89)
  // }

  console.log("Call Overrides: ", callOverrides)

  // CHange these values for the upgrade. 
  const contractProxyDeployed = "0x08CB4462958e6462Cc899862393f0b3bB6664efD"
  const oldContract = "VeridaDIDRegistry"
  const newContract = "VeridaDIDRegistryV2"

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
  // console.log("Read version of upgraded contract : " + await contractUpgradeCall.getVersion())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
upgrade().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});