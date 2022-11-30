import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Wallet } from "ethers";
const assert = require('assert')

import EncryptionUtils from '@verida/encryption-utils'
import { TestContract, VDAVerificationContract } from "../typechain-types";
import { ethers, upgrades } from "hardhat";
import { Keyring } from "@verida/keyring";

const createRawSignature = async (rawMsg : any, privateKey: String ) => {
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

let accountList : SignerWithAddress[];

let contract: TestContract

describe("Recover Test", () => {

    const didwallet = Wallet.createRandom()
    const didaddress = didwallet.address.toLowerCase()

    const paramSigner = Wallet.createRandom()
    const keyring = new Keyring(paramSigner.mnemonic.phrase)


    before(async () => {
        accountList = await ethers.getSigners()

        const contractFactory = await ethers.getContractFactory("TestContract")
        contract = (await upgrades.deployProxy(
            contractFactory,
            {
                initializer: 'initialize'
            }
        )) as TestContract
        await contract.deployed()
    })

    it("Get signer", async () => {
        console.log('did : ', didwallet);
        console.log('ParamSigner : ', paramSigner)

        const keys = await keyring.getKeys()
        console.log('Keys = ', keys)

        const msg = `ABCDEF`

        const params = ethers.utils.solidityPack(
            ['string'],[msg]
        )
        const signature = await keyring.sign(msg)

        const signer = await contract.recoverTest(params, signature)
        console.log("Signer = ", signer)
    })
})