import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { Wallet } from 'ethers'

import { generateProof, SignInfo } from "./utils"
import { Keyring } from "@verida/keyring";
import { VeridaDIDLinkage } from "../typechain-types";

import EncryptionUtils from "@verida/encryption-utils";

chai.use(chaiAsPromised);

export const zeroAddress = "0x0000000000000000000000000000000000000000"

let contract: VeridaDIDLinkage

interface IdentifierTypeInfo {
    name: string
    signerType: "Self" | "Trusted"
}
const identifierTypes : IdentifierTypeInfo[] = [
    { name: "facebook", signerType: "Trusted" },
    { name: "twitter", signerType: "Trusted" },
    { name: "blockchain:eip155", signerType: "Self" },
]

describe("Verida DID Linkage", () => {
    let accountList: SignerWithAddress[]
    let owner: SignerWithAddress

    let signInfo : SignInfo

    const eip155Signer = Wallet.createRandom()
    const identifiers = [
        'facebook|872cen0247c09247',
        `blockchain:eip155|${eip155Signer.address.toLowerCase()}`
    ]

    const unlinkedIdentifier = 'facebook|1111'

    const deployContract = async (isReset = false) : Promise<VeridaDIDLinkage> => {
        if (isReset) {
            // reset chain before every test
            await hre.network.provider.send("hardhat_reset");
        }

        const contractFactory = await ethers.getContractFactory("VeridaDIDLinkage")
        const contract = (await upgrades.deployProxy(
            contractFactory,
            {
                initializer: "initialize"
            }
        )) as VeridaDIDLinkage;
        await contract.deployed();

        return contract
    }

    before(async () => {
        accountList = await ethers.getSigners();
        owner = accountList[0];
        
        [contract, signInfo] = await Promise.all(
            [deployContract(), generateProof()]
        )

        // Add trusted signer
        await contract.addTrustedSigner(signInfo.signerAddress)
    })

    describe("Add identifier type", () => {
        it("Failed : non-owner", async () => {
            await expect(contract
                .connect(accountList[1])
                .addIdentifierType(identifierTypes[0].name, identifierTypes[0].signerType)
            ).to.be.rejectedWith("Ownable: caller is not the owner")
        })

        it("Failed : Invalid signer type", async () => {
            await expect(contract
                .addIdentifierType(identifierTypes[0].name, "CustomSignerType")
            ).to.be.rejectedWith("Invalid signer type")
        })

        it("Success : Add identifier types", async () => {
            for (const item of identifierTypes) {
                await contract.addIdentifierType(item.name, item.signerType)
            }
        })

        it("Failed: Registered type", async () => {
            await expect(contract
                .addIdentifierType(identifierTypes[0].name, identifierTypes[0].signerType)
            ).to.be.rejectedWith("Registered type")
        })
    })

    describe("Link", () => {
        
        const getSelfSignedData = (didAddr: string, signWallet : Wallet) => {
            const contextSigner = Wallet.createRandom()
            
            const did = `did:vda:${didAddr}`.toLowerCase()
            const identifier = `blockchain:eip155|${signWallet.address.toLowerCase()}`
            const msg = `${did}|${identifier}`

            let privateKeyArray = new Uint8Array(
                Buffer.from(contextSigner.privateKey.slice(2), "hex")
              );
            const signedData = EncryptionUtils.signData(msg, privateKeyArray)

            const proofMsg = `${signWallet.address}${contextSigner.address}`.toLowerCase()
            privateKeyArray = new Uint8Array(
                Buffer.from(signWallet.privateKey.slice(2), "hex")
            )
            const signedProof = EncryptionUtils.signData(proofMsg, privateKeyArray)

            return {identifier, signedData, signedProof}
        }

        const getTrustedSignedData = async (didAddr : string, identifier: string) => {
            const did = `did:vda:${didAddr}`.toLowerCase()
            const msg = `${did}|${identifier}`

            const signedData = await signInfo.signKeyring.sign(msg)
            return {signedData, signedProof: signInfo.signerProof!}
        }

        const getLinkRequestSignature = async(
            didAddr: string, 
            identifier: string, 
            signedData: string, 
            signedProof: string) => 
        {
            if (contract === undefined)
                throw new Error("Contract not deployed")
    
            const nonce = (await contract.nonce(didAddr)).toNumber()
    
            const rawMsg = ethers.utils.solidityPack(
                ['address', 'string', 'bytes', 'bytes', 'uint'],
                [didAddr, identifier, signedData, signedProof, nonce]
            )
    
            return await signInfo.userKeyring.sign(rawMsg)
        }

        const callLink = async (identifier: string, signedData: string, signedProof: string) => {
            const requestSignature = await getLinkRequestSignature(
                signInfo.userAddress!,
                identifier,
                signedData,
                signedProof
            )

            return contract.link(
                signInfo.userAddress!, 
                {
                    identifier,
                    signedData,
                    signedProof
                },
                requestSignature,
                signInfo.userProof!)
        }

        it("Should reject for invalid identifier type", async () => {
            const invalidIdentifiers = [
                'facebook|ab345|df15',  // Double `|` symbols
                'facebook',             // No `|` symbol
                'facebook|',            // No identifier
                '|facebook',            // No identifier type
                'telegram|25fg57',      // Unregistered identifier type
            ]

            for (const identifier of invalidIdentifiers) {
                await expect(contract.link(
                    signInfo.userAddress,
                    {
                        identifier,
                        signedData: '0x12', // Will not be checked
                        signedProof: '0x12' // Will not be checked
                    },
                    '0x12', // Will not be checkd
                    '0x12' // Will not be checked
                )).to.be.rejectedWith("Invalid identifier")
            }
        })

        it("Success for 'Trusted' signer type", async () => {
            const identifier = identifiers[0]
            const { signedData, signedProof } = await getTrustedSignedData(signInfo.userAddress, identifier)

            const tx = await callLink(identifier, signedData, signedProof)
            
            // await expect(callLink(identifier, signedData, signedProof)).to.be.rejectedWith("No signers provided")
            const did = `did:vda:${signInfo.userAddress.toLowerCase()}`
            expect(tx).to.emit(contract, "Link").withArgs(did, identifier)
        })
        
        it("Success for `Self` signer type", async () => {
            const {identifier, signedData, signedProof} = getSelfSignedData(signInfo.userAddress, eip155Signer)
            const tx = await callLink(identifier, signedData, signedProof)

            const did = `did:vda:${signInfo.userAddress.toLowerCase()}`
            expect(tx).to.emit(contract, "Link").withArgs(did, identifier)
        })

        it("Should reject for already linked identifier", async () => {
            const identifier = identifiers[0]
            const { signedData, signedProof } = await getTrustedSignedData(signInfo.userAddress, identifier)

            await expect(
                callLink(identifier, signedData, signedProof)
            ).to.be.rejectedWith("Identity already exists");
        })
    })

    describe("isLinked", () => {
        it("true for linked identifier & did pairs", async () => {
            const did = `did:vda:${signInfo.userAddress.toLowerCase()}`
            for(const identifier of identifiers) {
                expect(await contract.isLinked(did, identifier)).to.be.eq(true)
            }
        })

        it("false for unlinked identifier & did pairs",async () => {
            let did = `did:vda:${Wallet.createRandom().address.toLowerCase()}`
            expect(await contract.isLinked(did, identifiers[0])).to.be.eq(false)
            
            did = `did:vda:${signInfo.userAddress.toLowerCase()}`
            expect(await contract.isLinked(did, unlinkedIdentifier)).to.be.eq(false)
        })
    })

    describe("getController", () => {
        it("Should return controller for linked identifiers", async () => {
            const did = `did:vda:${signInfo.userAddress}`

            for(const identifier of identifiers) {
                expect(await contract.getController(identifier)).to.equal(did)
            }
        })

        it("No controller for unlinked identifiers", async () => {
            expect(await contract.getController(unlinkedIdentifier)).to.be.eq('')
        })
    })
    
    describe("getIdentifierList", () => {
        it("Should return identifier list of linked did", async () => {
            const did = `did:vda:${signInfo.userAddress.toLowerCase()}`
            expect(await contract.getIdentifierList(did)).to.deep.equal(identifiers)
        })

        it("Should return empty array for unlinked did", async () => {
            const did = `did:vda:${Wallet.createRandom().address.toLowerCase()}`
            expect(await contract.getIdentifierList(did)).to.deep.equal([])
        })
    })

    describe("unlink", () => {
        const getUnlinkRequestSignature = async(
            didAddr: string, 
            identifier: string) => 
        {
            if (contract === undefined)
                throw new Error("Contract not deployed")
    
            const nonce = (await contract.nonce(didAddr)).toNumber()

            const strDID = `did:vda:${didAddr.toLowerCase()}`
            const msg = `${strDID}|${identifier}`
    
            const rawMsg = ethers.utils.solidityPack(
                ['string' ,'uint'],
                [msg, nonce]
            )
    
            return await signInfo.userKeyring.sign(rawMsg)
        }
        it("Should reject for unlinked pairs", async () => {
            await expect(contract.unlink(
                signInfo.userAddress,
                unlinkedIdentifier,
                "0x12",
                "0x12")
            ).to.be.rejectedWith("Identifier not linked")
        })

        it("Successfully unlink", async () => {
            const did = `did:vda:${signInfo.userAddress}`
            for (const identifier of identifiers) {
                const requestSignature = await getUnlinkRequestSignature(signInfo.userAddress,identifier)
                const tx = await contract.unlink(
                    signInfo.userAddress,
                    identifier,
                    requestSignature,
                    signInfo.userProof!
                )

                expect(tx).to.emit(contract, "Unlink").withArgs(did, identifier)
            }
        })
    })

   
});