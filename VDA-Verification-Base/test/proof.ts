import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Wallet } from "ethers";
const assert = require('assert')

import EncryptionUtils from '@verida/encryption-utils'

import hre, { ethers , upgrades } from "hardhat"
import { TestContract } from "../typechain-types";

import { Interfaces, DIDDocument } from "@verida/did-document";
import { Keyring } from "@verida/keyring";
import { getDIDClient } from "./utils"

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

const createVeridaSign = async (rawMsg : any, privateKey: string, docDID: string) => {
    if (contract === undefined)
      return ''

    const nonce = (await contract.getNonce(docDID)).toNumber()

    rawMsg = ethers.utils.solidityPack(
      ['bytes','uint256'],
      [rawMsg, nonce]
    )
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

const createRawSignature = async (rawMsg : any, privateKey: String ) => {
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("VDA Verification base", () => {
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
    })

    it("Keyring test", async () => {
        const didWallet = veridians[0];
        const paramSigner = veridians[1];

        const keyring = new Keyring(paramSigner.mnemonic)
        const keys = await keyring.getKeys()

        const proofRawMsg = ethers.utils.solidityPack(
            ["address", "address"],
            [didWallet.address, keys.signPublicAddress]
        )
        const privateKeyArray = new Uint8Array(
            Buffer.from(didWallet.privateKey.slice(2), "hex")
        )
        const proof = EncryptionUtils.signData(proofRawMsg, privateKeyArray)


        const rawMsg = ethers.utils.solidityPack(
            ['string'],
            [`
            {
                type: "kycCredential",
                uniqueId: "12345678"
            }
            `]
        )
        const signature = await createVeridaSign(rawMsg, keys.signPrivateKey, didWallet.address)

        console.log("SignPublicAddress : ", keys.signPublicAddress)

        // const orgNonce = await contract.getNonce(didWallet.address)
        await contract.testRawStringData(didWallet.address, rawMsg, signature, proof)
    });

    describe("Proof test with DIDDocument & DIDClient", () => {
        const didwallet = Wallet.createRandom()
        const didaddress = didwallet.address.toLowerCase()
        const did = `did:vda:testnet:${didaddress}`

        const paramSigner = Wallet.createRandom()
        const keyring = new Keyring(paramSigner.mnemonic.phrase)

        const CONTEXT_NAME = 'Verida: Test DID Context'
        const EndpointType = Interfaces.EndpointType
        
        const endpoints = {
            database: {
                type: EndpointType.DATABASE,
                endpointUri: [
                    `https://acacia-dev1.tn.verida.tech/did/did:vda:testnet:${didaddress}`,
                    `https://acacia-dev2.tn.verida.tech/did/did:vda:testnet:${didaddress}`,
                    `https://acacia-dev3.tn.verida.tech/did/did:vda:testnet:${didaddress}`
                ]
            },
            messaging: {
                type: EndpointType.MESSAGING,
                endpointUri: [
                    `https://acacia-dev1.tn.verida.tech/did/did:vda:testnet:${didaddress}`,
                    `https://acacia-dev2.tn.verida.tech/did/did:vda:testnet:${didaddress}`,
                    `https://acacia-dev3.tn.verida.tech/did/did:vda:testnet:${didaddress}`
                ]
            }
        }

        it.only("On-chain verification with DIDDocument", async () => {
            console.log("Accounts: ", accountList.length)

            // const txSigner = Wallet.fromMnemonic("test test test test test test test test test test test junk", `m/44'/60'/0'/0/0`)
                        
            const didClient = await getDIDClient(didwallet);

            const initialDoc = new DIDDocument(did, didwallet.publicKey)
            initialDoc.addContext(CONTEXT_NAME, keyring, didwallet.privateKey, endpoints)

            const saved = await didClient.save(initialDoc)
            console.log("Saved : ", saved)

            const doc = await didClient.get(did)
            const data = doc.export()
            console.log('export')
            console.log(data)

            console.log("doc ID", doc.id)

            // Master keys controlled by the DID
            const keys = await keyring.getKeys()
            const publicKeyHex = keys.signPublicKeyHex
            // const proofString = `${doc.id}-${publicKeyHex}`
            const proofString = `${didaddress}-${keys.signPublicAddress}`
            const proof = await keyring.sign(proofString)

            const contextHash = DIDDocument.generateContextHash(doc.id, CONTEXT_NAME)
            console.log('public keys for the DID', keys)
            console.log('proofString that was signed by the DID controller to prove it owns the context signing key', proofString)
            console.log('proof that was generated by the DID controller', proof)
            console.log('context hash that is linked to the public signing address', contextHash)
            console.log('public signing key for the context', publicKeyHex)
            console.log('public key expected to sign the proof', keys.signPublicAddress)

            const sigValid = await EncryptionUtils.verifySig(proofString, proof, keys.signPublicKeyHex)
            assert.ok(sigValid, 'proofString was signed by the DID controller')

            const orgNonce = (await contract.getNonce(didaddress)).toNumber()
            const params = ethers.utils.solidityPack(
                ['string', 'uint'],
                ['Test data', orgNonce]
            )
            const signature = await keyring.sign(params)

            const result = await contract.verifyRequestWithArray(didaddress, [didaddress], params, signature, proof);
            console.log("Verify Result : ", result);

            return

            /*
            // @todo: Alex use the proof in the smart contract and verify it works
            const rawMsg = ethers.utils.solidityPack(
                ['string'],
                [`
                {
                    type: "kycCredential",
                    uniqueId: "12345678"
                }
                `]
            )
            const signature = await createVeridaSign(rawMsg, signKeys.signPrivateKey, didwallet.address)

            console.log("Signer : ", paramSigner.address)
            console.log("Sign Private Key : ", signKeys.signPublicAddress)
            

            console.log("Address: ", didwallet.address)

            const orgNonce = await contract.getNonce(didwallet.address)
            console.log("OrgNonce : ", orgNonce)
            console.log(didwallet.address, rawMsg, signature, proof)
            await contract.testRawStringData(didwallet.address, rawMsg, signature, proof)
            console.log("Transaction called")
            expect (await contract.getNonce(didwallet.address)).to.be.equal(orgNonce.add(1))
            */

            // const privateKeyArray = new Uint8Array(
            //     Buffer.from(didwallet.privateKey.slice(2), "hex")
            // )
            // const keys = await keyring.getKeys()
            // const didAddress = did.match(/0x[0-9a-z]*/i)![0].toLowerCase()
            // const proofString = ethers.utils.solidityPack(
            //     ["address", "address"],
            //     [didAddress, keys.signPublicAddress]
            // )
            // // const proof = await keyring.sign(proofString)
            // const proof = EncryptionUtils.signData(proofString, privateKeyArray)

            // console.log("Raw : ", proofString)
            // console.log("Proof : ", proof)

            // const rawProof = ethers.utils.solidityPack(
            //     ['address', 'address'],
            //     [didwallet.address, paramSigner.address]
            // )
            // const didKeyring = new Keyring(didwallet.mnemonic.phrase)
            // const didKeys = await didKeyring.getKeys()
            // const _proof = await createProofSign(rawProof, didKeys.signPrivateKey)

            // console.log("Raw : ", rawProof)
            // console.log("Proof : ", _proof)


            // console.log("SignPublicAddress: ", keys.signPublicAddress)
            // console.log("Original address: ", paramSigner.address)
            // console.log("Keys: ", keys)
        })

    })
})