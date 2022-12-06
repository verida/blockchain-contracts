import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ContractTransaction } from "ethers";
import { Block, Log } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { Wallet } from 'ethers'
import { SoulboundNFT } from "../typechain-types";
import { TransferEvent } from "../typechain-types/@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable";
import { LockedEvent } from "../typechain-types/contracts/IERC5192";

import EncryptionUtils from '@verida/encryption-utils'

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

const createProofSign = async (rawMsg : any, privateKey: String ) => {
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("Verida Soulbound", () => {
    let veridians: SignerWithAddress[]
    let owner: SignerWithAddress

    let claimer : SignerWithAddress // Claimer of SBT

    before(async () => {
        const accountList = await ethers.getSigners();
        const contractFactory = await ethers.getContractFactory("SoulboundNFT")
        contract = (await upgrades.deployProxy(
            contractFactory,
            {
                initializer: "initialize"
            }
        )) as SoulboundNFT;
        await contract.deployed();

        owner = accountList[0];
        veridians = [
            accountList[1],
            accountList[2],
            accountList[3],
        ]
    })

    describe("Manage trusted address", () => {
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
        const companyAccount = companyAccounts[0];
        const badCompanyAccount = companyAccounts[1];

        const did = Wallet.createRandom()

        const sbtType = sbtTypes[0];
        const uniqueId = "-testId";
        let proof : string

        const getClaimSBTSignature = async (
            did: string,
            sbtType: string,
            uniqueId: string,
            sbtURI: string,
            recipient: string,
            signKey: string
        ) => {
            const rawMsg = ethers.utils.solidityPack(
                ['address', 'string', 'address', 'string'],
                [did, `-${sbtType}-${uniqueId}-${sbtURI}-`, recipient, '-']
            );
            return await createVeridaSign(rawMsg, signKey, did)
        }

        before(async () => {

            claimer = veridians[1];
            // reset chain before every test
            await hre.network.provider.send("hardhat_reset");

            // re-deploy contract
            const contractFactory = await ethers.getContractFactory("SoulboundNFT")
            contract = (await upgrades.deployProxy(
                contractFactory,
                {
                    initializer: "initialize"
                }
            )) as SoulboundNFT;
            await contract.deployed();

            const rawProof = `${companyAccount.address}${did.address}`.toLowerCase()
            proof = await createProofSign(rawProof, companyAccount.privateKey)
        })

        it("Failed : Invalid SBT Type", async () => {
            const invalidSBTTypes = [
                "Abc",
                "ab_",
                "ab!"
            ]

            for (let i = 0; i < invalidSBTTypes.length; i++) {
                await expect(contract.claimSBT(
                    did.address,
                    {
                        sbtType: invalidSBTTypes[i],
                        uniqueId,
                        sbtURI: "TempURI",
                        recipient: claimer.address,
                    },
                    "0x12", // signature not checked 
                    "0x12" // proof not checked
                )).to.be.rejectedWith("Invalid SBT type")
            }
            
        })

        it("Failed : VerifyRequest - No signers provided in contract", async () => {
            expect((await contract.getTrustedSignerAddresses()).length).to.be.eq(0);
            await expect(contract.claimSBT(
                did.address,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: "https://TokenURI-Test",
                    recipient: claimer.address,
                },
                "0x12", // signature not checked 
                "0x12" // proof not checked
            )).to.be.rejectedWith("No signers provided");
        })

        it("Add trusted address to contract", async () => {
            for (let i = 0; i < companyAccounts.length; i++) {
                await contract.addTrustedSigner(companyAccounts[i].address);
            }
            expect((await contract.getTrustedSignerAddresses()).length).to.be.eq(companyAccounts.length);
        })

        it("Failed : VerifyRequest - Invalid proof", async () => {
            const signature = await getClaimSBTSignature(did.address, sbtType, uniqueId, tokenURIs[0], claimer.address, did.privateKey);

            const rawProof = `${companyAccount.address}${did.address}`.toLowerCase()
            const badProof = await createProofSign(rawProof, badCompanyAccount.privateKey)

            await expect(contract.claimSBT(
                did.address,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                },
                signature,
                badProof
            )).to.be.rejectedWith("Data is not signed by a valid signing DID");
        })

        it("Success : Claimed one SBT", async () => {
            const signature = await getClaimSBTSignature(did.address, sbtType, uniqueId, tokenURIs[0], claimer.address, did.privateKey)

            const tx = await contract.connect(claimer).claimSBT(
                did.address,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                },
                signature,
                proof
            );

            const tokenId = await contract.totalSupply(); //Latest tokenId
            expect(tx).to.emit(contract, "Transfer").withArgs(zeroAddress, claimer.address, tokenId)
            expect(tx).to.emit(contract, "Locked").withArgs(tokenId)
            expect(tx).to.emit(contract, "SBTClaimed").withArgs(claimer.address, tokenId, sbtType)
        })

        it("Failed : Already claimed type - duplication of claimed request ", async () => {
            const signature = await getClaimSBTSignature(did.address, sbtType, uniqueId, tokenURIs[0], claimer.address, did.privateKey)
            await expect(contract.connect(claimer).claimSBT(
                did.address,
                {
                    sbtType,
                    uniqueId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                },
                signature,
                proof
            )).to.be.rejectedWith("Already claimed type");            
        })

        it("Failed : Already claimed type - same SBT type with different id",async () => {
            const diffId = "-diffId";
            const signature = await getClaimSBTSignature(did.address, sbtType, diffId, tokenURIs[0], claimer.address, did.privateKey)

            await expect(contract.connect(claimer).claimSBT(
                did.address,
                {
                    sbtType,
                    uniqueId : diffId,
                    sbtURI: tokenURIs[0],
                    recipient: claimer.address,
                },
                signature,
                proof
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