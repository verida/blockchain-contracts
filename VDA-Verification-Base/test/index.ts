import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import EncryptionUtils from '@verida/encryption-utils'

import { ethers , upgrades } from "hardhat"
import { TestContract } from "../typechain-types";

let accountList : SignerWithAddress[];

let contract: TestContract

const veridians = [
    {
        address: "0x8Ec5df9Ebc9554CECaA1067F974bD34735d3e539",
        privateKey: "0x42d4c8a6b73fe84863c6f6b5a55980f9a8949e18ed20da65ca2033477ad563f0",
        publicKey: "0x042b816206dfd7c694d627ff775b9c151319b9a0e54de94d18e61619372fc713664dc677d5247adc2d4f8722b227bd9504b741ea380d5e7887a5698a7a634ec6ae",
    },
    {
        address: "0x1Ac3e26e1B5241B0aA11eB2646405BAc1919c784",
        privateKey: "0xff8ca2b935c1b9029a4f783c307e2ed543c93fa64d2c029e124d09d3409e79ec",
        publicKey: "0x04707d7adcbfc528b5f8cb7efd1dce9f5d9b32ed56a0f663d67c036d394bc8bb27e8b8bf53276e14db6e4a4b69a9f42b9e920198fc281b2668805c6fab8ee02646",
    },
    {
        address: "0xA0Bdf2665026a2C2C750EE18688625d340C0AA0f",
        privateKey: "0x0ce6e5dcecd8359bcf04162f54325681a09fe3d94ce253e97e6874bccec93a86",
        publicKey: "0x048697c917584c849de43490d73a4ca7391db3474bf1a93587eef0ddc4602de3022dfa00e5525ccb4405438de861b52915204e023984419fd87296f40a9543ad84",
    }
]

const createVeridaSign = async (rawMsg : any, privateKey: string, docDID: string) => {
    if (contract === undefined)
      return ''
  
    const nonce = (await contract.nonce(docDID)).toNumber()
    rawMsg = ethers.utils.solidityPack(
      ['bytes','uint256'],
      [rawMsg, nonce]
    )
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

const createProofSign = async (rawMsg : any, privateKey: String ) => {
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("VDA Verification base test", () => {
    const did = veridians[0]
    const paramSigner = veridians[1]
    const badSigner = veridians[2]
    
    const name = "Jack"
    const value = "Tester"

    const getTestDataSignature = async () => {
        const rawMsg = ethers.utils.solidityPack(
            ['string', 'string'],
            [name, value]
        )
        return await createVeridaSign(rawMsg, paramSigner.privateKey, did.address)
    }

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

        await contract.addTrustedSigner(did.address)
    })

    describe("Basic test with input values", () => {
        it("Failed for invalid proof", async () => {
            const signature = await getTestDataSignature()

            const rawProof = `${did.address}${badSigner.address}`.toLowerCase()
            const proof = await createProofSign(rawProof, did.privateKey)
            await expect(
                contract.testSign(did.address, name, value, signature, proof)
            ).to.be.revertedWithCustomError(contract, "InvalidSignature")
        })

        it("Test", async () => {
            const signature = await getTestDataSignature()

            const rawProof = `${did.address}${paramSigner.address}`.toLowerCase()
            const proof = await createProofSign(rawProof, did.privateKey)

            const orgNonce = await contract.nonce(did.address)
            await contract.testSign(did.address, name, value, signature, proof)
            expect (await contract.nonce(did.address)).to.be.equal(orgNonce.add(1))
        })
    })
})