import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const assert = require('assert')

import EncryptionUtils from '@verida/encryption-utils'

import { ethers , upgrades } from "hardhat"
import { TestContract } from "../typechain-types";
import { Keyring } from "@verida/keyring";
import { initVerida } from "@verida/contract-test-utils"
import { Wallet } from "ethers"

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
            //const signWallet = Wallet.createRandom()
            const signWallet = Wallet.fromMnemonic('gym sunny paddle impose aerobic lunar wage leopard cluster cage pass envelope')
            const signVerida = await initVerida(signWallet, 'Verida: Test DID Signing Context')
            const signAccount = signVerida.account
            const signerDid = await signAccount.did()
            const SIGN_CONTEXT_NAME = signVerida.CONTEXT_NAME

            // console.log(signWallet.mnemonic, signWallet.publicKey, signWallet.privateKey, signWallet.address)

            const userVerida = await initVerida(Wallet.createRandom(), 'Verida: Test DID User Context')
            const userWallet = userVerida.didwallet
            const userAccount = userVerida.account
            const userDid = await userAccount.did()
            const USER_CONTEXT_NAME = userVerida.CONTEXT_NAME
            const userKeyring = await userAccount.keyring(USER_CONTEXT_NAME)

            // Add the signing wallet to our list of trusted addresses
            await contract.addTrustedSigner(signWallet.address)


            // Build a keyring of the signing wallet
            const didClient = await signAccount.getDidClient()
            const signKeyring = await signAccount.keyring(SIGN_CONTEXT_NAME)

            const signerDoc = await didClient.get(signerDid)

            // Get the keys of the signing wallet
            const signerKeys = await signKeyring.getKeys()
            
            // Generate a context proof string using the Signer private key
            const proofString = `${signWallet.address}${signerKeys.signPublicAddress}`.toLowerCase()
            const privateKeyBuffer = new Uint8Array(Buffer.from(signWallet.privateKey.slice(2), 'hex'))
            const signerProof = EncryptionUtils.signData(proofString, privateKeyBuffer)

            // Verify the proof stored in the DID document for this context matches the expected
            // proof that we generated above
            const didDocumentContextProof = signerDoc.locateContextProof(SIGN_CONTEXT_NAME)
            assert.equal(signerProof, didDocumentContextProof)

            // Have the signer generate some signed data. Normally this is pre-generated and saved with the user.
            const rawString = "Test data"
            const signedData = await signKeyring.sign(rawString)
            // console.log(signedData)

            // Get the latest nonce for the user
            const userDidNonce = (await contract.nonce(userWallet.address)).toNumber()

            // Generate a request and sign it from the user DID.
            const userDidRequestParams = ethers.utils.AbiCoder.prototype.encode(
                ['string', 'bytes', 'bytes'],
                [rawString, signedData, signerProof]
            )

            const userDidRequestParamsWithNonce = ethers.utils.solidityPack(
                ['bytes', 'uint'],
                [userDidRequestParams, userDidNonce]
            )
            const userDidSignedRequest = await userKeyring.sign(userDidRequestParamsWithNonce)

            // Get the keys of the signing wallet
            const userDoc = await didClient.get(userDid)
            const userContextProof = userDoc.locateContextProof(USER_CONTEXT_NAME)

            // Have the user DID submit to to the test contract which verifies the
            // rawString was signed by the signer DID
            // console.log('Submitting')
            // console.log(userWallet.address, userDidRequestParams, userDidSignedRequest, userContextProof)
            await contract.verifyStringRequest(userWallet.address, userDidRequestParams, userDidSignedRequest, userContextProof)

            // Remove the signing wallet to our list of trusted addresses
            await contract.removeTrustedSigner(signWallet.address)
        })
    })
})