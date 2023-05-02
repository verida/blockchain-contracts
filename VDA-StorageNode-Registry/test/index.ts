import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { BigNumber, Wallet } from 'ethers'

import { generateProof, SignInfo } from "./utils"
import EncryptionUtils from '@verida/encryption-utils'
import { Keyring } from "@verida/keyring";
import { StorageNodeRegistry } from "../typechain-types";

let contract: StorageNodeRegistry

describe("Verida Soulbound", () => {
    let veridians: SignerWithAddress[]
    let owner: SignerWithAddress

    let claimer : SignerWithAddress // Claimer of SBT
    let claimer_2 : SignerWithAddress

    const deployContract = async (isReset = false) : Promise<StorageNodeRegistry> => {
        if (isReset) {
            // reset chain before every test
            await hre.network.provider.send("hardhat_reset");
        }

        const contractFactory = await ethers.getContractFactory("StorageNodeRegistry")
        const contract = (await upgrades.deployProxy(
            contractFactory,
            {
                initializer: "initialize"
            }
        )) as StorageNodeRegistry;
        await contract.deployed();

        return contract
    }

    before(async () => {
        const accountList = await ethers.getSigners();
        owner = accountList[0];

        veridians = [
            accountList[1],
            accountList[2],
            accountList[3],
            accountList[4]
        ]
    })

   
});