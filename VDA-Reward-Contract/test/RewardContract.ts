import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Wallet } from "ethers";

import hre, { ethers , upgrades } from "hardhat"
import { RewardToken, VDARewardContract } from "../typechain-types";
import EncryptionUtils from '@verida/encryption-utils'

chai.use(chaiAsPromised);

let accountList: SignerWithAddress[];
let owner: SignerWithAddress;
let user: SignerWithAddress

const veridaAccounts = [
    Wallet.createRandom(),
    Wallet.createRandom(),
    Wallet.createRandom(),
    Wallet.createRandom(),
    Wallet.createRandom(),
]

// This should be matched to above veridaAccounts
// Contains hashes of each account
const credentials = [
    '09c247n5t089247n90812798c14',
    '09c247n5t089247n90812798c15',
    '09c247n5t089247n90812798c16',
    '09c247n5t089247n90812798c17',
    '09c247n5t089247n90812798c18',
]

// Reward receives address
const receiverAddress = [
    Wallet.createRandom().address,
    Wallet.createRandom().address,
    Wallet.createRandom().address,
    Wallet.createRandom().address,
    Wallet.createRandom().address,
]

interface ClaimType {
    id: string
    reward: number
    schema: string
}

const claimTypes : ClaimType[] = [
    {
        id: "facebook",
        reward: 100,
        schema: "https://common.schemas.verida.io/social/creds/facebook"
    },
    {
        id: "twitter",
        reward: 150,
        schema: "https://common.schemas.verida.io/social/creds/twitter"
    },
]

describe("VeridaRewardContract", () => {
    let contract: VDARewardContract
    let token: RewardToken

    const deployContracts = async() => {
        const tokenFactory = await ethers.getContractFactory("RewardToken")
        token = (await upgrades.deployProxy(
            tokenFactory,
            [],
            {
                initializer: '__RewardToken_init'
            }
        )) as RewardToken
        await token.deployed()

        const contractFactory = await ethers.getContractFactory("VDARewardContract")
        contract = (await upgrades.deployProxy(
            contractFactory,
            [token.address],
            {
                initializer: '__VDARewardContract_init'
            }
        )) as VDARewardContract
        await contract.deployed()
    }

    before(async() => {
        accountList = await ethers.getSigners();
        owner = accountList[0]
        user = accountList[1]
        
        await deployContracts()
    })

    it ("Mint reward token to RewardContract", async () => {
        const mintAmount = ethers.utils.parseEther('100000')
        expect(await token.balanceOf(contract.address)).to.equal(0);
        await token.mint(contract.address, mintAmount)
        expect(await token.balanceOf(contract.address)).to.equal(mintAmount)
    })

    describe("ClaimTypes", () => {
        describe("Add ClaimTypes", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).addClaimType(
                    claimTypes[0].id,
                    claimTypes[0].reward,
                    claimTypes[0].schema
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Failed for invalid id", async () => {
                await expect(contract.addClaimType(
                    "",
                    claimTypes[0].reward,
                    claimTypes[0].schema
                )).to.be.rejectedWith('Invalid id')
            })

            it("Failed for invalid reward amount", async () => {
                await expect(contract.addClaimType(
                    claimTypes[0].id,
                    0,
                    claimTypes[0].schema
                )).to.be.rejectedWith('Invalid reward amount')
            })

            it("Failed for invalid schema", async () => {
                await expect(contract.addClaimType(
                    claimTypes[0].id,
                    claimTypes[0].reward,
                    ""
                )).to.be.rejectedWith('Invalid schema')
            })

            it("Add a ClaimType successfully", async () => {
                await expect(contract.getClaimType(claimTypes[0].id)).to.be.rejectedWith("Non existing CalimType")

                await contract.addClaimType(
                    claimTypes[0].id,
                    claimTypes[0].reward,
                    claimTypes[0].schema
                )
                
                const res = await contract.getClaimType(claimTypes[0].id)
                expect(res.reward).equal(BigNumber.from(claimTypes[0].reward))
                expect(res.schema).equal(claimTypes[0].schema)
            })

            it("Failed for existing id", async () => {
                await expect(contract.addClaimType(
                    claimTypes[0].id,
                    claimTypes[1].reward,
                    claimTypes[1].schema
                )).to.be.rejectedWith('Already existing ClaimType')
            })            
        })

        describe("Remove ClaimTypes", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).removeClaimType(
                    claimTypes[0].id
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Faild for non-existing claim id", async () => {
                await expect(contract.removeClaimType(
                    "Invalid Claim ID"
                )).to.be.rejectedWith('Non existing CalimType')
            })

            it("Remove a ClaimType successfully", async () => {
                expect(await contract.getClaimType(claimTypes[0].id)).to.have.any.keys('reward', 'schema')
                await contract.removeClaimType(claimTypes[0].id)
                await expect(contract.getClaimType(
                    claimTypes[0].id
                )).to.be.rejectedWith('Non existing CalimType')
            })

            it("Failed for removed claim type", async () => {
                await expect(contract.removeClaimType(
                    claimTypes[0].id
                )).to.be.rejectedWith('Non existing CalimType')
            })
        })

        describe("Update ClaimType reward", () => {
            before(async () => {
                await contract.addClaimType(
                    claimTypes[0].id,
                    claimTypes[0].reward,
                    claimTypes[0].schema
                )
            })

            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).updateClaimTypeReward(
                    claimTypes[0].id,
                    BigNumber.from(10)
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Failed for non existing ClaimType", async () => {
                await expect(contract.updateClaimTypeReward(
                    "Invalid Claim ID",
                    BigNumber.from(10)
                )).to.be.rejectedWith('Non existing CalimType')
            })

            it("Failed for invalid reward amount", async () => {
                await expect(contract.updateClaimTypeReward(
                    claimTypes[0].id,
                    BigNumber.from(0)
                )).to.be.rejectedWith('Invalid reward amount')
            })

            it("Update reward amount successfully", async () => {
                const updatedRewardAmount = BigNumber.from(25)
                expect((await contract.getClaimType(claimTypes[0].id)).reward).to.equal(
                    BigNumber.from(claimTypes[0].reward)
                )

                await contract.updateClaimTypeReward(
                    claimTypes[0].id,
                    updatedRewardAmount
                )
                expect((await contract.getClaimType(claimTypes[0].id)).reward).to.equal(
                    updatedRewardAmount
                )

                // Restore reward amount for further test
                await contract.updateClaimTypeReward(
                    claimTypes[0].id,
                    claimTypes[0].reward
                )
            })
        })
    })

    describe("TrustedAddress", () => {
        describe("Add an address", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).addTrustedAddress(
                    veridaAccounts[0].address
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Add an address successfully", async () => {
                expect(await contract.isTrustedAddress(veridaAccounts[0].address)).to.be.eq(false)

                await contract.addTrustedAddress(veridaAccounts[0].address)

                expect(await contract.isTrustedAddress(veridaAccounts[0].address)).to.be.eq(true)
            })

            it("Failed for already added address", async () => {
                await expect(contract.addTrustedAddress(
                    veridaAccounts[0].address)
                ).to.be.rejectedWith('Already existing')
            })
        })

        describe("Remove an address", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).removeTrustedAddress(
                    veridaAccounts[0].address
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Failed for non-existing address", async () => {
                await expect(contract.removeTrustedAddress(
                    veridaAccounts[1].address
                )).to.be.rejectedWith('Not existing')
            })

            it("Remove an address successfully", async () => {
                expect (await contract.isTrustedAddress(veridaAccounts[0].address)).to.equal(true)
                await contract.removeTrustedAddress(veridaAccounts[0].address)
                expect (await contract.isTrustedAddress(veridaAccounts[0].address)).to.equal(false)
            })

            it("Failed for removed address", async () => {
                await expect(contract.removeTrustedAddress(
                    veridaAccounts[0].address)
                ).to.be.rejectedWith('Not existing')
            })
        })
    })

    describe("Claim", () => {
        const mintAmount = ethers.utils.parseEther('100000')

        const getProof = (hash: string, schema: string, privateKey: string) => {
            const rawMsg = ethers.utils.solidityPack(
                ['string', 'string', 'string'],
                [hash, "|", schema]
            )
            const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
            return EncryptionUtils.signData(rawMsg, privateKeyArray)
        }

        before(async () => {
            // Reset chain before claim test
            await hre.network.provider.send("hardhat_reset")

            await deployContracts()
            // // Mint reward token
            // await token.mint(contract.address, mintAmount)

            // Add trusted address
            veridaAccounts.forEach(async account => {
                await contract.addTrustedAddress(account.address)
            })

            // Add Claim Types
            claimTypes.forEach(async claimType => {
                await contract.addClaimType(
                    claimType.id,
                    claimType.reward,
                    claimType.schema
                )
            })
        })

        it("Failed for non-existing claim types", async () => {
            const proof = getProof(
                credentials[0], 
                claimTypes[0].schema, 
                veridaAccounts[0].privateKey)
            await expect(contract.claim(
                "Invalid ClaimID",
                credentials[0],
                proof,
                receiverAddress[0]
            )).to.be.rejectedWith('Non existing CalimType')
        })

        it("Failed for Invalid signer", async () => {
            const badSigner = Wallet.createRandom()
            const proof = getProof(
                credentials[0],
                claimTypes[0].schema,
                badSigner.privateKey
            )
            await expect(contract.claim(
                claimTypes[0].id,
                credentials[0],
                proof,
                receiverAddress[0]
            )).to.be.rejectedWith('Invalid signer')
        })

        it("Failed for Insufficient reward token in contract", async () => {
            expect(await token.balanceOf(contract.address)).to.be.equal(0)

            const proof = getProof(
                credentials[0],
                claimTypes[0].schema,
                veridaAccounts[0].privateKey
            )
            await expect(contract.claim(
                claimTypes[0].id,
                credentials[0],
                proof,
                receiverAddress[0]
            )).to.be.rejectedWith('Insufficient token in contract')
        })

        it("Claim successfully", async () => {
            await token.mint(contract.address, mintAmount)

            const orgContractBalance = await token.balanceOf(contract.address)

            expect(orgContractBalance).to.be.greaterThan(claimTypes[0].reward)
            expect(await token.balanceOf(receiverAddress[0])).to.be.equal(0)

            const proof = getProof(
                credentials[0],
                claimTypes[0].schema,
                veridaAccounts[0].privateKey
            )
            await contract.claim(
                claimTypes[0].id,
                credentials[0],
                proof,
                receiverAddress[0]
            )

            expect(await token.balanceOf(receiverAddress[0])).to.be.equal(claimTypes[0].reward)
            expect(await token.balanceOf(contract.address)).to.be.equal(orgContractBalance.sub(BigNumber.from(claimTypes[0].reward)))
        })

        it("Failed for already claimed", async () => {
            const orgContractBalance = await token.balanceOf(contract.address)
            expect(orgContractBalance).to.be.greaterThan(claimTypes[0].reward)

            const proof = getProof(
                credentials[0],
                claimTypes[0].schema,
                veridaAccounts[0].privateKey
            )
            await expect(contract.claim(
                claimTypes[0].id,
                credentials[0],
                proof,
                receiverAddress[0]
            )).to.be.rejectedWith('Already claimed')
        })
    })
})