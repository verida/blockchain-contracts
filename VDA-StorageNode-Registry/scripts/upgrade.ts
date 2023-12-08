import hre, { ethers } from "hardhat";
import { deploy } from "./libraries/deployment";
import { saveABI, saveDeployedAddress } from "./libraries/utils";
import { FacetCutAction, getSelector, getSelectors } from "./libraries/diamond";

async function main() {

  // const storagenodeFacet = await ethers.deployContract("VDAStorageNodeFacet");
  // await storagenodeFacet.waitForDeployment();
  // const address = await storagenodeFacet.getAddress();
  // console.log("StorageNodeFacet deployed : ", address);
  const address = "0x0D174006A05280A7D47e014F4381fD8AB3Fc8309";
  const storagenodeFacet = await ethers.getContractAt("VDAStorageNodeFacet", address);

  const DIAMOND_ADDRESS = "0xe3d4D1A14BD21Dda3c3e192cebdEbA651Bd30968"; //Test net address
  const diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", DIAMOND_ADDRESS);
  
  let selectors = getSelectors(storagenodeFacet).remove(['DECIMAL']);
  let tx;
  let receipt;
  /*
  // Replace function selectors
  
  tx = await diamondCutFacet.diamondCut(
    [{
      facetAddress: address,
      action: FacetCutAction.Replace,
      functionSelectors: selectors
    }],
    ethers.ZeroAddress,
    '0x', 
    {gasLimit: 800000}
  );
  receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`Diamond replace failed: ${tx.hash}`)
  }
  */

  // Add Decimal function
  selectors = getSelectors(storagenodeFacet).get(['DECIMAL']);
  console.log("Selectors : ", selectors)
  tx = await diamondCutFacet.diamondCut(
    [{
      facetAddress: address,
      action: FacetCutAction.Replace,
      functionSelectors: selectors
    }],
    ethers.ZeroAddress,
    '0x', 
    {gasLimit: 800000}
  );
  receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`Diamond add failed: ${tx.hash}`)
  }
  console.log("Add success");

  const abiString = JSON.stringify(selectors.map((j) => JSON.parse(j)));
  console.log("ABI String : ", abiString);
}  
 
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
