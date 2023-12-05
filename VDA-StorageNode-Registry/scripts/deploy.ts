import hre from "hardhat";
import { deploy } from "./libraries/deployment";
import { saveABI, saveDeployedAddress } from "./libraries/utils";

async function main() {
  const { diamondAddress, tokenAddress, facetsAddress, abi } = await deploy(undefined, ['VDAVerificationFacet', 'VDADataCenterFacet', 'VDAStorageNodeFacet']);

  await saveDeployedAddress(hre.network.name, diamondAddress, tokenAddress, facetsAddress);
  await saveABI(abi);
}  
 
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
