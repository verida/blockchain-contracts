import { deploy } from "./libraries/deployment";

async function main() {
  await deploy();
}  
 
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
