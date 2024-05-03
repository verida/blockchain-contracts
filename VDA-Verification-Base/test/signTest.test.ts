import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
const assert = require('assert')

import EncryptionUtils from '@verida/encryption-utils'
import { TestContract } from "../typechain-types";
import { ethers, upgrades } from "hardhat";
import { Keyring } from "@verida/keyring";

let accountList : SignerWithAddress[];

let contract: TestContract

describe("Recover Test", () => {

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

    it("Get signer from Keyring signed message", async () => {
        const msg = `ABCDEF`
        const params = ethers.utils.solidityPack(
            ['string'],[msg]
        )
        const signature = await keyring.sign(msg)

        const keys = await keyring.getKeys()
        const signer = await contract.recoverTest(params, signature)
        assert.ok(signer.toLowerCase() === keys.signPublicAddress.toLowerCase())
    })

    it("Recover raw string instead of bytes", async() => {
        const msg = `ABCDEF`
        
        const privateKeyArray = new Uint8Array(Buffer.from(paramSigner.privateKey.slice(2), 'hex'))
        const signature = EncryptionUtils.signData(msg.toLowerCase(), privateKeyArray)
        
        const signer = await contract.rawRecover(msg.toLowerCase(), signature)
        assert.ok(signer.toLowerCase() === paramSigner.address.toLowerCase())
    })

    it("Recover raw addresses", async () => {
        const addr1 = '0x642DcdA49b2B10Bcb383C8948017821Eee06bf12'
        const addr2 = '0xb1e6cC4Cd1c654A19491aE8F52fA04672619D8c6'

        const msg = `${addr1}${addr2}`
        
        const privateKeyArray = new Uint8Array(Buffer.from(paramSigner.privateKey.slice(2), 'hex'))
        const signature = EncryptionUtils.signData(msg.toLowerCase(), privateKeyArray)

        const signer = await contract.rawRecoverAddress(addr1, addr2, signature)

        assert.ok(signer.toLowerCase() === paramSigner.address.toLowerCase())
    })
})