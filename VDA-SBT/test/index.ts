import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { BigNumber, Wallet } from 'ethers'
import { SoulboundNFT } from "../typechain-types";

import { generateProof, SignInfo } from "./utils"
import EncryptionUtils from '@verida/encryption-utils'
import { Keyring } from "@verida/keyring";

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

describe("Verida Soulbound", () => {
    let veridians: SignerWithAddress[]
    let owner: SignerWithAddress

    let claimer : SignerWithAddress // Claimer of SBT
    let claimer_2 : SignerWithAddress

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
            accountList[4]
        ]
    })

    describe("Manage trusted address", () => {
        const companyAccounts = [
            Wallet.createRandom(),
            Wallet.createRandom(),
            Wallet.createRandom()
        ]
        
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
                    .to.be.revertedWithCustomError(contract, "UnregisteredSigner");

                // Already removed account
                await expect(contract.removeTrustedSigner(companyAccounts[0].address))
                    .to.be.revertedWithCustomError(contract, "UnregisteredSigner");
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

            const rawMsg = ethers.utils.solidityPack(
                ['address', 'string', 'address', 'bytes', 'bytes', 'uint'],
                [did, `${sbtType}${uniqueId}${sbtURI}`, recipient, signData, signInfo.signerProof!, nonce]
            );
            
            return await userKeyring.sign(rawMsg)
        }

        before(async () => {

            claimer = veridians[1];
            claimer_2 = veridians[3];
            
            [contract, signInfo] = await Promise.all([
                deployContract(true),
                generateProof()
            ])

            // const msg = ethers.utils.solidityPack(
            //     ['string','address'],
            //     [`${sbtType}-${uniqueId}-`, signInfo.userAddress]
            // )
            const msg = `${sbtType}-${uniqueId}-${signInfo.userAddress}`
            signedData = await signInfo.signKeyring.sign(msg)
        })

        it("Failed : Invalid SBT Type", async () => {
            const invalidSBTTypes = [
                "Abc",
                "ab_",
                "ab!",
                ""
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
                )).to.be.revertedWithCustomError(contract, "InvalidSBTInfo")
            }
        })

        it("Failed : empty uniqueId", async () => {
            await expect(contract.claimSBT(
                signInfo.userAddress,
                {
                    sbtType: "twitter",
                    uniqueId : "",
                    sbtURI: "",
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                "0x12", // signature not checked 
                "0x12" // proof not checked
            )).to.be.revertedWithCustomError(contract, "InvalidSBTInfo")
        })

        it("Failed : empty URI", async () => {
            await expect(contract.claimSBT(
                signInfo.userAddress,
                {
                    sbtType: "twitter",
                    uniqueId : "1",
                    sbtURI: "",
                    recipient: claimer.address,
                    signedData,
                    signedProof: signInfo.signerProof!
                },
                "0x12", // signature not checked 
                "0x12" // proof not checked
            )).to.be.revertedWithCustomError(contract, "InvalidSBTInfo")
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
            )).to.be.revertedWithCustomError(contract, "NoSigners");
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
            )).to.be.revertedWithCustomError(contract, "InvalidSignature");

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
            await expect(tx).to.emit(contract, "Transfer").withArgs(zeroAddress, claimer.address, tokenId)
            await expect(tx).to.emit(contract, "Locked").withArgs(tokenId)
            await expect(tx).to.emit(contract, "SBTClaimed").withArgs(claimer.address, tokenId, sbtType)
        })

        it("Succes : Claimed same SBT to different claimer",async () => {
            const claimer = claimer_2;
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
            await expect(tx).to.emit(contract, "Transfer").withArgs(zeroAddress, claimer.address, tokenId)
            await expect(tx).to.emit(contract, "Locked").withArgs(tokenId)
            await expect(tx).to.emit(contract, "SBTClaimed").withArgs(claimer.address, tokenId, sbtType)
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
            )).to.be.revertedWithCustomError(contract, "InvalidSBTInfo")
        })

        it("Success : same SBT type with different id",async () => {
            const diffId = "-diffId";
            const msg = ethers.utils.solidityPack(
                ['string','address'],
                [`${sbtType}-${diffId}-`, signInfo.userAddress]
            )
            const signedData = await signInfo.signKeyring.sign(msg)
            const requestSignature = await getClaimSBTSignature(
                signInfo.userAddress, 
                sbtType, 
                diffId, 
                tokenURIs[0], 
                claimer.address,
                signInfo.userKeyring,
                signedData)

            const tx = await contract.claimSBT(
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
            );

            const tokenId = await contract.totalSupply(); //Latest tokenId
            await expect(tx).to.emit(contract, "Transfer").withArgs(zeroAddress, claimer.address, tokenId)
            await expect(tx).to.emit(contract, "Locked").withArgs(tokenId)
            await expect(tx).to.emit(contract, "SBTClaimed").withArgs(claimer.address, tokenId, sbtType)
        })
    })

    describe("Get Claimed SBT list", () => {
        it("Should return tokenId list for the claimer", async () => {
            const idList = await contract.getClaimedSBTList(claimer.address)
            expect(idList.length).to.equal(2)
        })

        it("Should return empty array for users who has no SBT", async () => {
            const idList = await contract.getClaimedSBTList(veridians[2].address)
            expect(idList.length).to.equal(0)
        })
    })

    describe("Get tokenInfo from claimed token Id", async () => {
        it("Should return SBT type & uniqueId for claimed tokenIDs",async () => {
            const requestedTokenInfo = [
                [ 'twitter', '-testId' ],
                [ 'twitter', '-diffId' ]
            ]
            const idList = await contract.getClaimedSBTList(claimer.address)

            for(let i = 0; i < idList.length; i++) {
                const info = await contract.tokenInfo(idList[i].toNumber())
                expect(info).deep.equal(requestedTokenInfo[i])
            }
        })

        it("Should reject for unclaimed token ID", async () => {
            const invalidId = (await contract.totalSupply()).toNumber() + 1

            await expect(contract.tokenInfo(invalidId)).to.be.rejectedWith("ERC721: invalid token ID")
        })
    })

    describe("Token Transfer Restricted after minted", () => {
        it("Transfer disabled for minted NFT", async () => {
            const recepient = veridians[2];

            expect(await contract.ownerOf(1)).equal(claimer.address)

            await expect(contract
                .connect(claimer)
                .transferFrom(claimer.address, recepient.address, 1)
            ).to.be.revertedWithCustomError(contract, "TransferBlocked")
        })
    })

    describe("IERC5192", () => {
        it("Lock test", async () => {
            expect(await contract.locked(1)).to.equal(true)

            await expect(contract.locked(0)).to.be.rejectedWith("ERC721: invalid token ID")
        })
    })

    describe("Burn SBT", () => {
        let bunrtIdList : BigNumber[] = []

        it("Should fail for invalid tokenId", async () => {
            await expect(contract.burnSBT(0)).to.be.rejectedWith("ERC721: invalid token ID");

            const invalidTokenId = (await contract.totalSupply()).toNumber() + 1
            await expect(contract.burnSBT(invalidTokenId)).to.be.rejectedWith("ERC721: invalid token ID");
        })

        it("Should fail for invalid caller",async () => {
            const idList = await contract.getClaimedSBTList(claimer.address)
            expect(idList.length).to.be.greaterThan(0)

            const badCaller = veridians[2]

            expect(badCaller.address).not.equal(claimer.address)
            expect(badCaller.address).not.equal(owner.address)

            await expect(
                contract
                .connect(badCaller)
                .burnSBT(idList[0].toNumber())
            ).to.be.revertedWithCustomError(contract, "NoPermission")
        })

        it("Token owner burn successfully", async () => {
            const idList = await contract.getClaimedSBTList(claimer.address)
            expect(idList.length).to.be.greaterThan(0)

            const tokenId = idList[0].toNumber()
            const tx = await contract.connect(claimer).burnSBT(tokenId)
            await expect(tx).to.emit(contract, "SBTBurnt").withArgs(claimer.address, tokenId)
            await expect(tx).to.emit(contract, "Transfer").withArgs(claimer.address, zeroAddress, tokenId)
            await expect(tx).to.emit(contract, "Unlocked").withArgs(tokenId)

            const updatedIdList = await contract.getClaimedSBTList(claimer.address)
            expect(updatedIdList.length).to.equal(idList.length - 1)

            bunrtIdList.push(idList[0])
        })

        it("Contract owner burn successfully",async () => {
            const idList = await contract.getClaimedSBTList(claimer.address)
            expect(idList.length).to.be.greaterThan(0)

            const tokenId = idList[0].toNumber()
            const tx = await contract.burnSBT(tokenId)
            await expect(tx).emit(contract, "SBTBurnt").withArgs(owner.address, tokenId)
            await expect(tx).emit(contract, "Transfer").withArgs(claimer.address, zeroAddress, tokenId)
            await expect(tx).emit(contract, "Unlocked").withArgs(tokenId)

            const updatedIdList = await contract.getClaimedSBTList(claimer.address)
            expect(updatedIdList.length).to.equal(idList.length - 1)

            bunrtIdList.push(idList[0])
        })

        it("Should fail for already burnt ids",async () => {
            for (let i = 0; i < bunrtIdList.length; i++) {
                // Previous owner failed
                await expect(
                    contract
                    .connect(claimer)
                    .burnSBT(bunrtIdList[i].toNumber())
                ).to.be.rejectedWith("ERC721: invalid token ID")

                // Contract owner failed
                await expect(
                    contract
                    .burnSBT(bunrtIdList[i].toNumber())
                ).to.be.rejectedWith("ERC721: invalid token ID")
            }
        })
    })
});