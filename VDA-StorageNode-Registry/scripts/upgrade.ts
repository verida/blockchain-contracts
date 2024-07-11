import { ethers } from "hardhat";
import { FacetCutAction, getSelectors } from "./libraries/diamond";

/**
 * Replace all functions of that contract
 * @param action One of {@link FacetCutAction}
 * @param contractName Contract name to be updated
 * @param contractAddress If not set, deploy contract
 */
async function diamondUpdate(
  diamondAddress: string, 
  action: number, 
  contractName: string, 
  contractAddress?: string) {

    let facet;
  if (!contractAddress) {
    facet = await ethers.deployContract(contractName);
    await facet.waitForDeployment();

    contractAddress = await facet.getAddress();
    console.log(contractName, " : deployed at ", contractAddress);
  } else {
    facet = await ethers.getContractAt(contractName, contractAddress)
  }

  const diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", diamondAddress);

  let selectors = getSelectors(facet);
  // console.log(selectors);

  const tx = await diamondCutFacet.diamondCut(
    [
      {
        facetAddress: contractAddress,
        action: action,
        functionSelectors: selectors
      }
    ],
    ethers.ZeroAddress,
    '0x',
    // {gasLimit: 800000}
  );
  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Diamond update failed: ${tx.hash}`)
  }

  console.log("Update Success");
}

async function main() {
  // Replace `VDAVerificationFacet`
  await diamondUpdate(
    "0xb19197875f4e76db9565c32E98e588F6A215ceb5",
    FacetCutAction.Replace,
    "VDAVerificationFacet",
    "0x0A81B6031fc2985f3969115977c241A660759ce7"
  )
}  
 
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
