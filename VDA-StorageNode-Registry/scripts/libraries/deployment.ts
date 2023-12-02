import { ethers } from "hardhat";
import { FacetCutAction, getSelectors } from "./diamond";

export interface IDeploymentAddress {
  diamondAddress: string,
  tokenAddress: string
}

export async function deploy(tokenAddress?: string , additionalFacets?: string[]) : Promise<IDeploymentAddress> {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  // Deploy DaimondInit
  // DiamondInit provides a function that is called when the diamond is upgraded or deployed to initialize state variables
  // Read about how the diamondCut function works in the EIP2535 Diamonds standard
  const diamondInit = await ethers.deployContract("DiamondInit");
  await diamondInit.waitForDeployment()
  console.log("DiamondInit deployed: ", await diamondInit.getAddress());

  // Deploy facets and set the `facetCuts` variable
  let FacetNames = [
    'DiamondCutFacet',
    'DiamondLoupeFacet',
    'OwnershipFacet'
  ];
  if (additionalFacets !== undefined) {
    FacetNames.push(...additionalFacets);
  }

  // The `facetCuts` variable is the FacetCut[] that contains the functions to add during diamond deployment
  const facetCuts = [];
  for (let i = 0; i < FacetNames.length; i++)
  {
    const FacetName = FacetNames[i];
    const facet = await ethers.deployContract(FacetName);
    await facet.waitForDeployment();

    const addr = await facet.getAddress();

    console.log(`${FacetName} deployed: ${addr}`);
    facetCuts.push({
      facetAddress: addr,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  if (tokenAddress === undefined) {
    const token = await ethers.deployContract("MockToken", ["VDAMock", "VMT"]);
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    console.log("Token deployed : ", tokenAddress);
  }

  // Creating a function call
  // This call gets executed during deployment and can also be executed in upgrades
  // It is executed with delegatecall on the DiamondInit address.
  let functionCall = diamondInit.interface.encodeFunctionData("init", [tokenAddress]);

  // Setting arguments that will be used in the diamond constructor
  const diamondArgs = {
    owner: contractOwner.address,
    init: await diamondInit.getAddress(),
    initCalldata: functionCall
  }

  // deploy Diamond
  const diamond = await ethers.deployContract("Diamond", [facetCuts, diamondArgs]);
  await diamond.waitForDeployment();
  
  console.log("Diamond deployed: ", await diamond.getAddress());
  return {
    diamondAddress: await diamond.getAddress(),
    tokenAddress
  };
}