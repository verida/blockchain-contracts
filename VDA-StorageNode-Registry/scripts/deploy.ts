import hre from "hardhat";
import { deploy } from "./libraries/deployment";
import { saveABI, saveDeployArgument, saveDeployedAddress } from "./libraries/utils";

async function main() {
  const { diamondAddress, tokenAddress, facetsAddress, abi, deployArgument } = await deploy(
    undefined, 
    ['VDAVerificationFacet', 'VDADataCenterFacet', 'VDAStorageNodeFacet', 'VDAStorageNodeManagementFacet']);

  await saveDeployedAddress(hre.network.name, diamondAddress, tokenAddress, facetsAddress);
  await saveABI(abi);
  await saveDeployArgument(deployArgument);
}  
 
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
