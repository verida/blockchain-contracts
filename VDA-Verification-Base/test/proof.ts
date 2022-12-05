import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect, util } from "chai";
import chaiAsPromised from "chai-as-promised";
const assert = require('assert')

import EncryptionUtils from '@verida/encryption-utils'

import hre, { ethers , upgrades } from "hardhat"
import { TestContract } from "../typechain-types";

import { Interfaces, DIDDocument } from "@verida/did-document";
import { Keyring } from "@verida/keyring";
import { getDIDClient, initVerida } from "./utils"
import { Wallet } from "ethers"
import { sign } from "crypto";

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

describe("VDA Verification Proof Test", () => {
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
        const didWallet = veridians[0]
        const paramSigner = veridians[1]

        before(async () => {
            await contract.addTrustedSigner(didWallet.address)
        })
    
        it("Test for Keyring sign() function", async () => {
            
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

            const nonce = (await contract.nonce(didWallet.address)).toNumber()
            const msgWithNonce = ethers.utils.solidityPack(
                ['bytes','uint256'],
                [rawMsg, nonce]
              )
            const signature = keyring.sign(msgWithNonce)
    
            await contract.testRawStringData(didWallet.address, rawMsg, signature, proof)
            const updatedNonce = (await contract.nonce(didWallet.address)).toNumber()

            assert.equal((nonce+1), updatedNonce, 'Nonce updated');
        });
    })
    
    /**
     * This code generates two Verida DID's:
     * 
     * 1. Signer DID
     * 2. User DID
     * 
     * The Signer DID signs a string to prove they trust it.
     * 
     * The User DID submits this signed string proof, along with the signer context signing proof
     * to a smart contract and signs a request with the User DID latest nonce value.
     * 
     * The smart contract verifies the signed string proof is signed by the Signer DID.
     */
    describe("Proof test with DIDDocument & DIDClient", () => {
        it("On-chain verification with DIDDocument", async () => {
            const signVerida = await initVerida(Wallet.createRandom(), 'Verida: Test DID Signing Context')
            const signWallet = signVerida.didwallet
            const signAccount = signVerida.account
            const signClient = signVerida.client
            const signContext = signVerida.context
            const SIGN_CONTEXT_NAME = signVerida.CONTEXT_NAME

            const userVerida = await initVerida(Wallet.createRandom(), 'Verida: Test DID User Context')
            const userWallet = userVerida.didwallet
            const userAccount = userVerida.account
            const userClient = userVerida.client
            const userContext = userVerida.context
            const USER_CONTEXT_NAME = userVerida.CONTEXT_NAME
            const userKeyring = await userAccount.keyring(USER_CONTEXT_NAME)

            // Build a keyring of the signing wallet
            const didClient = await signAccount.getDidClient()
            const did = await signAccount.did()
            const signKeyring = await signAccount.keyring(SIGN_CONTEXT_NAME)

            const doc = await didClient.get(did)
            const data = doc.export()

            // Get the keys of the signing wallet
            const keys = await signKeyring.getKeys()
            
            // Generate a context proof string using the Signer private key
            const proofString = `${signWallet.address}${keys.signPublicAddress}`.toLowerCase()
            const privateKeyBuffer = new Uint8Array(Buffer.from(signWallet.privateKey.slice(2), 'hex'))
            const proof = EncryptionUtils.signData(proofString, privateKeyBuffer)

            // Verify the proof stored in the DID document for this context matches the expected
            // proof that we generated above
            const contextHash = DIDDocument.generateContextHash(doc.id, SIGN_CONTEXT_NAME)
            const didDocumentVerificationMethod = data.verificationMethod?.find((item: any) => {
                return item.id.match(`${doc.id}\\?context=${contextHash}&type=sign`)
            })
            // @ts-ignore
            const didDocumentContextProof = didDocumentVerificationMethod.proof
            assert.equal(proof, didDocumentContextProof)

            // Have the signer generate some signed data
            const rawString = "Test data"
            const signedData = await signKeyring.sign(rawString)
            console.log(signedData)

            // Get the latest nonce for the user
            const userDidNonce = (await contract.nonce(userWallet.address)).toNumber()

            // Generate a request and sign it from the user DID
            const userDidRequestParams = [
                rawString,
                userDidNonce
            ]
            const userDidSignedRequest = await userKeyring.sign(userDidRequestParams)

            // Have the user DID submit to to the test contract which verifies the
            // rawString was signed by the signer DID
            console.log('Submitting')
            console.log(userWallet.address, userDidRequestParams, userDidSignedRequest, didDocumentContextProof)
            await contract.verifyStringRequest(userWallet.address, userDidRequestParams, userDidSignedRequest, didDocumentContextProof)


            // Previous code; commented out by Chris 5 Dec 2022
            /*const orgNonce = (await contract.nonce(ADDRESS)).toNumber()
            const params = ethers.utils.solidityPack(
                ['string', 'uint'],
                ['Test data', orgNonce]
            )
            const signature = await keyring.sign(params)

            /*await contract.verifyRequestWithArray(ADDRESS, [ADDRESS], params, signature, didDocumentContextProof);

            const updatedNonce = (await contract.nonce(ADDRESS)).toNumber()
            assert.equal(orgNonce + 1, updatedNonce, 'Nonce updated after verification')*/
        })

    })
})