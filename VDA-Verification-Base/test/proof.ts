import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect, util } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils, Wallet } from "ethers";
const assert = require('assert')

import EncryptionUtils from '@verida/encryption-utils'

import hre, { ethers , upgrades } from "hardhat"
import { TestContract } from "../typechain-types";

import { Interfaces, DIDDocument } from "@verida/did-document";
import { Keyring } from "@verida/keyring";
import { getDIDClient, initVerida } from "./utils"
import { Console } from "console";

chai.use(chaiAsPromised);

let accountList : SignerWithAddress[];

let contract: TestContract

const veridians = [
    {
        mnemonic: "motion region ranch stumble spot tuna brass interest liar trophy divorce wedding",
        address: "0x642DcdA49b2B10Bcb383C8948017821Eee06bf12",
        privateKey: "0x1dc21d4783c1da97df5421fbe91ddb313227e6d1747442371b1fe3dccd3d0d0a",
        publicKey: "0x04a4934e29065ba20e431d05d3fd1912145c4a852a2a9c8073f5dc1e481a7240e12346a39e8f40efb5bf7e352f318a6371d0df83fc14e5b08bc54e2d1a335cd409"
    },
    {
        mnemonic: "term fee design mountain nose green horse normal wool pear sample toe",
        address: "0xb1e6cC4Cd1c654A19491aE8F52fA04672619D8c6",
        privateKey: "0x92460e921749d0843086059d24088320cba7b4f41dd3931462bbbe56263d2d35",
        publicKey: "0x040dab443d1345bffa6f27db37291bc458f95c68ea3f7aa68041ebb7ac6176fdab5b58ace9d6c7e3d19e7cade64d1d6749b32e84239d4f3b0c548445331c3685fb"
    },
    {
        mnemonic: "swear sponsor antenna size illness ethics sample chief innocent relax law reward",
        address: "0x89192d655e1274c2C225238c0E6FAB5E527e142a",
        privateKey: "0x47874dd29553904a93829c1e2cab953b5c83e6cff3b5b510e37dc45999684fc5",
        publicKey: "0x041bff559247e3be7f459a55c6339327b5920e4d13c00391f700c87c5861d79b637032674461f31d29f602fd196135c427c5fb779ef3667d580d1ba1c00d5d5d40"
    }
]

const createVeridaSign = async (rawMsg : any, privateKey: string | Uint8Array, docDID: string) => {
    if (contract === undefined)
      return ''

    const nonce = (await contract.getNonce(docDID)).toNumber()

    rawMsg = ethers.utils.solidityPack(
      ['bytes','uint256'],
      [rawMsg, nonce]
    )
    const privateKeyArray = typeof privateKey === 'string' ?
        new Uint8Array(Buffer.from(privateKey.slice(2), 'hex')) :
        privateKey
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

const createRawSignature = async (rawMsg : any, privateKey: String ) => {
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("VDA Verification Proof Test", () => {
    const did = veridians[0]
    const paramSigner = veridians[1]
    const badSigner = veridians[2]
    
    const name = "Jack"
    const value = "Tester"
    
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

    describe('Keyring test', () => {
        it("Test for Keyring sign() function", async () => {
            const didWallet = veridians[0];
            const paramSigner = veridians[1];
    
            const keyring = new Keyring(paramSigner.mnemonic)
            const keys = await keyring.getKeys()
    
            const proofRawMsg = `${didWallet.address}${keys.signPublicAddress}`.toLowerCase()
            const privateKeyArray = new Uint8Array(
                Buffer.from(didWallet.privateKey.slice(2), "hex")
            )
            const proof = EncryptionUtils.signData(proofRawMsg, privateKeyArray)


            const rawMsg = ethers.utils.solidityPack(
                ['string',],
                [`
                {
                    type: "kycCredential",
                    uniqueId: "12345678"
                }
                `]
            )

            const nonce = (await contract.getNonce(didWallet.address)).toNumber()
            const msgWithNonce = ethers.utils.solidityPack(
                ['bytes','uint256'],
                [rawMsg, nonce]
              )
            const signature = keyring.sign(msgWithNonce)
    
            await contract.testRawStringData(didWallet.address, rawMsg, signature, proof)
            const updatedNonce = (await contract.getNonce(didWallet.address)).toNumber()

            assert.equal((nonce+1), updatedNonce, 'Nonce updated');
        });
    })
    
    describe("Proof test with DIDDocument & DIDClient", () => {
        it("On-chain verification with DIDDocument", async () => {
            const {
                didwallet,
                account,
                client,
                context,
                CONTEXT_NAME
            } = await initVerida()

            const PRIVATE_KEY = didwallet.privateKey
            const ADDRESS = didwallet.address

            console.log("Getting DID client...")
            const didClient = await account.getDidClient()
            const did = await account.did()
            console.log("Getting keyring....")
            const keyring = await account.keyring(CONTEXT_NAME)

            const doc = await didClient.get(did)
            const data = doc.export()

            // Log the full DID Document
            // console.log(data)

            // Master keys controlled by the DID
            const keys = await keyring.getKeys()
            const publicKeyHex = keys.signPublicKeyHex
            
            // Proof 
            const proofString = `${ADDRESS}${keys.signPublicAddress}`.toLowerCase()
            const privateKeyBuffer = new Uint8Array(Buffer.from(PRIVATE_KEY.slice(2), 'hex'))
            const proof = EncryptionUtils.signData(proofString, privateKeyBuffer)

            const contextHash = DIDDocument.generateContextHash(doc.id, CONTEXT_NAME)
            const didDocumentVerificationMethod = data.verificationMethod?.find(item => {
                return item.id.match(`${doc.id}\\?context=${contextHash}&type=sign`)
            })
            // @ts-ignore
            const didDocumentContextProof = didDocumentVerificationMethod.proof

            // Verify the proof stored in the DID document for this context matches the expected
            // proof that we generated above
            assert.equal(proof, didDocumentContextProof)

            const orgNonce = (await contract.getNonce(ADDRESS)).toNumber()
            const params = ethers.utils.solidityPack(
                ['string', 'uint'],
                ['Test data', orgNonce]
            )
            const signature = await keyring.sign(params)

            await contract.verifyRequestWithArray(ADDRESS, [ADDRESS], params, signature, didDocumentContextProof);

            const updatedNonce = (await contract.getNonce(ADDRESS)).toNumber()
            assert.equal(orgNonce + 1, updatedNonce, 'Nonce updated after verification')
        })

    })
})