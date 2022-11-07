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
import { AddSBTTypeEvent } from "../typechain-types/contracts/ISoulboundNFT";

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

export const zeroAddress = "0x0000000000000000000000000000000000000000"

let contract: SoulboundNFT
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

const createProofSign = async (rawMsg : any, privateKey: String ) => {
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("Verida Soulbound", () => {
    let veridians: SignerWithAddress[]
    let owner: SignerWithAddress

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

    /*
    describe("Manage company accounts", () => {
        describe("Add company accounts", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(veridians[0])
                    .addCompanyAccount(companyAccounts[0].address))
                .to.be.rejectedWith("Ownable: caller is not the owner");
            })

            it("Success", async () => {
                await expect(contract.addCompanyAccount(companyAccounts[0].address))
                    .to.emit(contract, "AddCompanyAccount")
                    .withArgs(companyAccounts[0].address);
            })

            it("Failed : Existing account", async () => {
                await expect(contract.addCompanyAccount(companyAccounts[0].address))
                    .to.be.rejectedWith("Existing account");
            })
        })

        describe("Remove company accounts", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(veridians[0])
                    .removeCompanyAccount(companyAccounts[0].address))
                .to.be.rejectedWith("Ownable: caller is not the owner");
            })

            it("Success", async () => {
                await expect(contract.removeCompanyAccount(companyAccounts[0].address))
                    .to.emit(contract, "RemoveCompanyAccount")
                    .withArgs(companyAccounts[0].address);
            })

            it("Failed : Invalid account", async () => {
                // Not registered account
                await expect(contract.removeCompanyAccount(companyAccounts[1].address))
                    .to.be.rejectedWith("Invalid account");

                // Already removed account
                await expect(contract.removeCompanyAccount(companyAccounts[0].address))
                    .to.be.rejectedWith("Invalid account");
            })
        })

        it("List company accounts", async () => {
            expect((await contract.listCompanyAccounts()).length).to.be.equal(0);

            await contract.addCompanyAccount(companyAccounts[0].address);
            expect((await contract.listCompanyAccounts()).length).to.be.equal(1);

            await contract.removeCompanyAccount(companyAccounts[0].address);
            expect((await contract.listCompanyAccounts()).length).to.be.equal(0);
        })
    })

    describe("SBT Type management", () => {
        it("Allowed SBTTypes", async () => {
            expect((await contract.allowedSBTTypes()).length).to.be.eq(0)
        })

        describe("Add SBTType", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(veridians[0])
                    .addSBTType(sbtTypes[0])
                ).be.rejectedWith("Ownable: caller is not the owner")
            })
    
            it("Success", async () => {
                expect((await contract.allowedSBTTypes()).length).to.be.eq(0)
                
                for (let i = 0 ; i < sbtTypes.length; i++) {
                    await expect(contract.addSBTType(sbtTypes[i]))
                    .to.emit(contract, "AddSBTType")
                    .withArgs(sbtTypes[i])
                }

                expect((await contract.allowedSBTTypes()).length).to.be.eq(sbtTypes.length)
                
            })

            it("Failed : already registered sbttype", async () => {
                await expect(contract.addSBTType(sbtTypes[0])).to.be.rejectedWith("Existing SBT type")
            })
        })
    })
    */

    describe("Claim SBT", () => {
        const companyAccount = companyAccounts[0];
        const badCompanyAccount = companyAccounts[1];

        const did = Wallet.createRandom()

        let claimer : SignerWithAddress
        const sbtType = sbtTypes[0];
        const uniqueId = "-testId";
        let proof : string

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

            const rawProof = ethers.utils.solidityPack(
                ['address','address'],
                [companyAccount.address.toLowerCase(), did.address.toLowerCase()]
            )
            proof = await createProofSign(rawProof, companyAccount.privateKey)

            
        })

        /*
        it("Failed : SBT not registered", async () => {
            expect((await contract.allowedSBTTypes()).length).to.be.eq(0);

            await expect(contract.connect(claimer).claimSBT(
                did.address,
                sbtType,
                uniqueId,
                "0x12", // signature not checked 
                "0x12" // proof not checked
            )).to.be.rejectedWith("Invalid SBT type")
        })
        */

        it("Add SBT Types", async () => {
            for (let i = 0 ; i < sbtTypes.length; i++) {
                await expect(contract.addSBTType(sbtTypes[i]))
                .to.emit(contract, "AddSBTType")
                .withArgs(sbtTypes[i])
            }
        })

        /*
        it("Failed : VerifyRequest - No company accounts in contract", async () => {
            expect((await contract.listCompanyAccounts()).length).to.be.eq(0);
            await expect(contract.connect(claimer).claimSBT(
                did.address,
                sbtType,
                uniqueId,
                "0x12", // signature not checked 
                "0x12" // proof not checked
            )).to.be.rejectedWith("No company accounts");
        })
        */

        it("Add Company accounts to contract", async () => {
            for (let i = 0; i < companyAccounts.length; i++) {
                await contract.addCompanyAccount(companyAccounts[i].address);
            }
            expect((await contract.listCompanyAccounts()).length).to.be.eq(companyAccounts.length);
        })

        /*
        it("Failed : VerifyRequest - Invalid proof", async () => {
            const rawMsg = ethers.utils.solidityPack(
                ['string', 'string'],
                [sbtType, uniqueId]
            );
            const signature = await createVeridaSign(rawMsg, did.privateKey, did.address)

            const rawProof = ethers.utils.solidityPack(
                ['string','string'],
                [companyAccount.address, did.address]
            )
            proof = await createProofSign(rawProof, badCompanyAccount.privateKey)

            await expect(contract.connect(claimer).claimSBT(
                did.address,
                sbtType,
                uniqueId,
                signature,
                proof
            )).to.be.rejectedWith("Invalid proof");
        })
        */

        it("Success : Claimed one SBT", async () => {
            const rawMsg = ethers.utils.solidityPack(
                ['string', 'string'],
                [sbtType, uniqueId]
            );
            const signature = await createVeridaSign(rawMsg, did.privateKey, did.address)

            const tx = await contract.connect(claimer).claimSBT(
                did.address,
                sbtType,
                uniqueId,
                signature,
                proof
            );

            const tokenId = await contract.totalSupply(); //Latest tokenId
            expect(tx).to.emit(contract, "Transfer").withArgs(zeroAddress, claimer.address, tokenId)
            expect(tx).to.emit(contract, "Locked").withArgs(tokenId)
            expect(tx).to.emit(contract, "SBTClaimed").withArgs(claimer.address, tokenId, sbtType)
        })

        /*
        it("Failed : Already claimed SBT type", async () => {
            // Failed for same uniqueID
            let rawMsg = ethers.utils.solidityPack(
                ['string', 'string'],
                [sbtType, uniqueId]
            );
            let signature = await createVeridaSign(rawMsg, did.privateKey, did.address)

            await expect(contract.connect(claimer).claimSBT(
                did.address,
                sbtType,
                uniqueId,
                signature,
                proof
            )).to.be.rejectedWith("Already claimed type");

            // Failed for different uniqueID
            const diffId = "-diffId";
            rawMsg = ethers.utils.solidityPack(
                ['string', 'string'],
                [diffId, uniqueId]
            );
            signature = await createVeridaSign(rawMsg, did.privateKey, did.address)

            await expect(contract.connect(claimer).claimSBT(
                did.address,
                sbtType,
                diffId,
                signature,
                proof
            )).to.be.rejectedWith("Already claimed type");

        })
        */
    })

    /*
    describe("Token Transfer Restricted after minted", () => {
        it("Transfer disabled for minted NFT", async () => {
            expect(await contract.ownerOf(0)).equal(veridians[0].address)
            await expect(contract
                .connect(veridians[0])
                .transferFrom(veridians[0].address, veridians[1].address, 0)
            ).to.be.rejectedWith("Err: token transfer is BLOCKED")
        })
    })

    describe("IERC5192", () => {
        it("Lock test", async () => {
            expect(await contract.locked(0)).to.equal(true)

            await expect(contract.locked(1)).to.be.rejectedWith("ERC721: invalid token ID")
        })
    })
    */
});