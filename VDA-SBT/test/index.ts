import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ContractTransaction } from "ethers";
import { Block, Log } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { Wallet } from 'ethers'
import { SoulboundNFT } from "../typechain-types";

import { generateProof, SignInfo } from "./utils"
import EncryptionUtils from '@verida/encryption-utils'
import { Keyring } from "@verida/keyring";

chai.use(chaiAsPromised);

const companyAccounts = [
    Wallet.createRandom(),
    Wallet.createRandom(),
    Wallet.createRandom(),
]

const sbtTypes = [
    "twitter",
    "facebook",
    "discord"
]

const tokenURIs = [
    "https://Token-URI/test-1",
    "https://Token-URI/test-2",
    "https://Token-URI/test-3"    
]

export const zeroAddress = "0x0000000000000000000000000000000000000000"

let contract: SoulboundNFT
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

// const createProofSign = async (rawMsg : any, privateKey: String ) => {
//     const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
//     return EncryptionUtils.signData(rawMsg, privateKeyArray)
// }

describe("Verida Soulbound", () => {
    let veridians: SignerWithAddress[]
    let owner: SignerWithAddress

    let claimer : SignerWithAddress // Claimer of SBT

    const deployContract = async (isReset = false) : Promise<SoulboundNFT> => {
        if (isReset) {
            // reset chain before every test
            await hre.network.provider.send("hardhat_reset");
        }

        const contractFactory = await ethers.getContractFactory("SoulboundNFT")
        const contract = (await upgrades.deployProxy(
            contractFactory,
            {
                initializer: "initialize"
            }
        )) as SoulboundNFT;
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
        ]
    })

    describe("Manage trusted address", () => {
        before(async () => {
            contract = await deployContract()
        })

        describe("Add trusted address", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(veridians[0])
                    .addTrustedSigner(companyAccounts[0].address))
                .to.be.rejectedWith("Ownable: caller is not the owner");
            })

            it("Success", async () => {
                await expect(contract.addTrustedSigner(companyAccounts[0].address))
            })
        })

        describe("Remove trusted address", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(veridians[0])
                    .removeTrustedSigner(companyAccounts[0].address))
                .to.be.rejectedWith("Ownable: caller is not the owner");
            })

            it("Success", async () => {
                await expect(contract.removeTrustedSigner(companyAccounts[0].address))
            })

            it("Failed : Unregistered address", async () => {
                // Not registered account
                await expect(contract.removeTrustedSigner(companyAccounts[1].address))
                    .to.be.rejectedWith("Unregistered address");

                // Already removed account
                await expect(contract.removeTrustedSigner(companyAccounts[0].address))
                    .to.be.rejectedWith("Unregistered address");
            })
        })

        it("List trusted address", async () => {
            expect((await contract.getTrustedSignerAddresses()).length).to.be.equal(0);

            await contract.addTrustedSigner(companyAccounts[0].address);
            expect((await contract.getTrustedSignerAddresses()).length).to.be.equal(1);

            await contract.removeTrustedSigner(companyAccounts[0].address);
            expect((await contract.getTrustedSignerAddresses()).length).to.be.equal(0);
        })
    })

    describe("Claim SBT", () => {
        const sbtType = sbtTypes[0];
        const uniqueId = "-testId";

        let signInfo : SignInfo
        let signedData : string

        const getClaimSBTSignature = async (
            did: string,
            sbtType: string,
            uniqueId: string,
            sbtURI: string,
            recipient: string,

            userKeyring: Keyring,
            signData = signedData
        ) => {
            if (contract === undefined)
                return ''
            const nonce = (await contract.nonce(did)).toNumber()

            // const rawMsg = ethers.utils.solidityPack(
            //     ['address', 'string', 'address', 'string', 'bytes', 'string', 'bytes', 'string', 'uint'],
            //     [did, `-${sbtType}-${uniqueId}-${sbtURI}-`, recipient, '-', signdData, '-', signInfo.signerProof!, '-', nonce]
            // );

            const rawMsg = ethers.utils.solidityPack(
                ['address', 'string', 'address', 'bytes', 'bytes', 'uint'],
                [did, `${sbtType}${uniqueId}${sbtURI}`, recipient, signData, signInfo.signerProof!, nonce]
            );
            
            return await userKeyring.sign(rawMsg)
        }

        before(async () => {

            claimer = veridians[1];
            
            [contract, signInfo] = await Promise.all([
                deployContract(true),
                generateProof()
            ])

            signedData = await signInfo.signKeyring.sign(uniqueId)
        })

        it("Failed : Invalid SBT Type", async () => {
            const invalidSBTTypes = [
                "Abc",
                "ab_",
                "ab!"
            ]

            for (let i = 0; i < invalidSBTTypes.length; i++) {
                await expect(contract.claimSBT(
                    signInfo.userAddress,
                    {
                        sbtType: invalidSBTTypes[i],
                        uniqueId,
                        sbtURI: "TempURI",
                        recipient: claimer.address,
                        signedData,
                        signedProof: signInfo.signerProof!
                    },
                    "0x12", // signature not checked 
                    "0x12" // proof not checked
                )).to.be.rejectedWith("Invalid SBT type")
            }
            
        })

        it("Failed : VerifyRequest - No signers provided in contract", async () => {
            expect((await contract.getTrustedSignerAddresses()).length).to.be.eq(0);

            const requestSignature = await getClaimSBTSignature(
                signInfo.userAddress, 
                sbtType, 
                uniqueId, 
                tokenURIs[0], 
                claimer.address,
                signInfo.userKeyring)

            await expect(contract.claimSBT(
                signInfo.userAddress,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                requestSignature,
                signInfo.userProof!
            )).to.be.rejectedWith("No signers provided");
        })

        it("Failed : VerifyRequest - Invalid Request Proof", async () => {
            contract.addTrustedSigner(signInfo.signerAddress)

            const invalidUser = Wallet.createRandom()
            const invalidUserKeyring = new Keyring(invalidUser.mnemonic.phrase)
            const keys = await invalidUserKeyring.getKeys()
            
            const proofString = `${signInfo.userAddress}${keys.signPublicAddress}`.toLowerCase()
            const privateKeyBuffer = new Uint8Array(Buffer.from(invalidUser.privateKey.slice(2), 'hex'))
            const userProof = EncryptionUtils.signData(proofString, privateKeyBuffer)

            const requestSignature = await getClaimSBTSignature(
                signInfo.userAddress, 
                sbtType, 
                uniqueId, 
                tokenURIs[0], 
                claimer.address,
                invalidUserKeyring)

                await expect(contract.claimSBT(
                signInfo.userAddress,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                requestSignature,
                userProof
            )).to.be.rejectedWith("Data is not signed by a valid signing DID");

            contract.removeTrustedSigner(signInfo.signerAddress)
        })

        it("Success : Claimed one SBT", async () => {
            contract.addTrustedSigner(signInfo.signerAddress)
            const requestSignature = await getClaimSBTSignature(
                signInfo.userAddress, 
                sbtType, 
                uniqueId, 
                tokenURIs[0], 
                claimer.address,
                signInfo.userKeyring)

            const tx = await contract.connect(claimer).claimSBT(
                signInfo.userAddress,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                requestSignature,
                signInfo.userProof!
            );

            const tokenId = await contract.totalSupply(); //Latest tokenId
            expect(tx).to.emit(contract, "Transfer").withArgs(zeroAddress, claimer.address, tokenId)
            expect(tx).to.emit(contract, "Locked").withArgs(tokenId)
            expect(tx).to.emit(contract, "SBTClaimed").withArgs(claimer.address, tokenId, sbtType)
        })

        it("Failed : Already claimed type - duplication of claimed request ", async () => {
            const requestSignature = await getClaimSBTSignature(
                signInfo.userAddress, 
                sbtType, 
                uniqueId, 
                tokenURIs[0], 
                claimer.address,
                signInfo.userKeyring)

            await expect(contract.claimSBT(
                signInfo.userAddress,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                requestSignature,
                signInfo.userProof!
            )).to.be.rejectedWith("Already claimed type");            
        })

        it("Failed : Already claimed type - same SBT type with different id",async () => {
            const diffId = "-diffId";
            const signedData = await signInfo.signKeyring.sign(diffId)

            const requestSignature = await getClaimSBTSignature(
                signInfo.userAddress, 
                sbtType, 
                diffId, 
                tokenURIs[0], 
                claimer.address,
                signInfo.userKeyring,
                signedData)

            await expect(contract.claimSBT(
                signInfo.userAddress,
                {
                    sbtType,
                    uniqueId: diffId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                requestSignature,
                signInfo.userProof!
            )).to.be.rejectedWith("Already claimed type");    
        })
    })

    describe("Token Transfer Restricted after minted", () => {
        it("Transfer disabled for minted NFT", async () => {
            const recepient = veridians[2];

            expect(await contract.ownerOf(1)).equal(claimer.address)

            await expect(contract
                .connect(claimer)
                .transferFrom(claimer.address, recepient.address, 1)
            ).to.be.rejectedWith("Err: token transfer is BLOCKED")
        })
    })

    describe("IERC5192", () => {
        it("Lock test", async () => {
            expect(await contract.locked(1)).to.equal(true)

            await expect(contract.locked(0)).to.be.rejectedWith("ERC721: invalid token ID")
        })
    })
});