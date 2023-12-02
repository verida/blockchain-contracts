import { getContractFactory } from "@nomicfoundation/hardhat-ethers/types"
import { ethers } from "hardhat"

import { deploy } from "../scripts/deploy";
import { getSelectors } from "../scripts/libraries/diamond";

describe("StorageNodeRegistry", () => {
    before(async () => {
        // const a = await ethers.getContractAt("DiamondCutFacet", "");
        
    })

    it.only("Test",async () => {
        const addr = await deploy();
        // console.log("&&&&&&&&&&&&&&&77", addr);
        // const contractFactory = await ethers.getContractFactory("VDAStorageNode");
        // const contract = await contractFactory.deploy();

        // // console.log(contract.interface);
        // contract.interface.forEachFunction((fragment) => {
        //     console.log(fragment.selector)
        // })
        console.log("1");
    })

    it("get test",async () => {
        
        // const contract =  await ethers.deployContract("VDAStorageNode");
        // await contract.waitForDeployment();
        const contract = await ethers.getContractFactory("VDAStorageNode");

        // console.log(contract.interface.getFunction('addNode'));
        const selectors = getSelectors(contract).get(['addNode']);
        // console.log("@@@@@@@@@@@@@@@@@@22");
        console.log(selectors);
    })
})