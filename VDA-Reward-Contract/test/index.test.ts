import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SnapshotRestorer, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, Wallet } from "ethers";

import hre, { ethers , upgrades } from "hardhat"
import { MockStorageNode, VDARewardContract } from "../typechain-types";
import { VeridaToken } from "@verida/erc20-contract/typechain-types";
import EncryptionUtils from '@verida/encryption-utils'

import { abi as TokenABI, bytecode as TokenByteCode } from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json";

let accountList: SignerWithAddress[];
let owner: SignerWithAddress;
let user: SignerWithAddress

const trustedSigners = [
    Wallet.createRandom(),
    Wallet.createRandom(),
    Wallet.createRandom(),
]

const credentials = [
    '09c247n5t089247n90812798c14',
    '09c247n5t089247n90812798c15',
    '09c247n5t089247n90812798c16',
]

// Reward receives address
const receiverAddress = [
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
    let token: VeridaToken
    let storageNodeContract: MockStorageNode

    const deployContracts = async() => {
        const tokenFactory = await ethers.getContractFactory(TokenABI, TokenByteCode)
        token = await tokenFactory.deploy() as VeridaToken
        await token.deployed()
        await token.initialize();

        await token.enableTransfer();

        const storageNodeFactory = await ethers.getContractFactory("MockStorageNode");
        storageNodeContract = await storageNodeFactory.deploy(token.address);
        await storageNodeContract.deployed();

        const contractFactory = await ethers.getContractFactory("VDARewardContract")
        contract = (await upgrades.deployProxy(
            contractFactory,
            [token.address, (storageNodeContract as any).address],
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
                )).to.be.revertedWithCustomError(contract, "InvalidId")
            })

            it("Failed for invalid reward amount", async () => {
                await expect(contract.addClaimType(
                    claimTypes[0].id,
                    0,
                    claimTypes[0].schema
                )).to.be.revertedWithCustomError(contract, "InvalidRewardAmount")
            })

            it("Failed for invalid schema", async () => {
                await expect(contract.addClaimType(
                    claimTypes[0].id,
                    claimTypes[0].reward,
                    ""
                )).to.be.revertedWithCustomError(contract, "InvalidSchema")
            })

            it("Add a ClaimType successfully", async () => {
                await expect(
                    contract.getClaimType(claimTypes[0].id)
                ).to.be.revertedWithCustomError(contract, "InvalidId")

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
                )).to.be.revertedWithCustomError(contract, "InvalidId")
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
                )).to.be.revertedWithCustomError(contract, "InvalidId")
            })

            it("Remove a ClaimType successfully", async () => {
                expect(await contract.getClaimType(claimTypes[0].id)).to.have.any.keys('reward', 'schema')
                await contract.removeClaimType(claimTypes[0].id)
                await expect(contract.getClaimType(
                    claimTypes[0].id
                )).to.be.revertedWithCustomError(contract, "InvalidId")
            })

            it("Failed for removed claim type", async () => {
                await expect(contract.removeClaimType(
                    claimTypes[0].id
                )).to.be.revertedWithCustomError(contract, "InvalidId")
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
                )).to.be.revertedWithCustomError(contract, "InvalidId")
            })

            it("Failed for invalid reward amount", async () => {
                await expect(contract.updateClaimTypeReward(
                    claimTypes[0].id,
                    BigNumber.from(0)
                )).to.be.revertedWithCustomError(contract, "InvalidRewardAmount")
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

    describe("TrustedSigners", () => {
        describe("Add an address", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).addTrustedSigner(
                    trustedSigners[0].address
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Add an address successfully", async () => {
                await contract.addTrustedSigner(trustedSigners[0].address)
            })

            it("Failed for already added address", async () => {
                await expect(contract.addTrustedSigner(
                    trustedSigners[0].address)
                ).to.be.revertedWithCustomError(contract, "RegisteredSigner")
            })
        })

        describe("Remove an address", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).removeTrustedSigner(
                    trustedSigners[0].address
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Failed for non-existing address", async () => {
                await expect(contract.removeTrustedSigner(
                    trustedSigners[1].address
                )).to.be.revertedWithCustomError(contract, "UnregisteredSigner")
            })

            it("Remove an address successfully", async () => {
                await contract.removeTrustedSigner(trustedSigners[0].address)
            })

            it("Failed for removed address", async () => {
                await expect(contract.removeTrustedSigner(
                    trustedSigners[0].address)
                ).to.be.revertedWithCustomError(contract, "UnregisteredSigner")
            })
        })
    })

    describe("Get contract addresses", () => {
        it("Get token address",async () => {
            expect(
                await contract.getTokenAddress()
            ).to.be.eq(token.address);
        })

        it("Get StorageNodeRegistry contract address",async () => {
            expect(
                await contract.getStorageNodeContractAddress()
            ).to.be.eq(storageNodeContract.address);
        })
    })

    describe("Claim", () => {
        const mintAmount = ethers.utils.parseEther('100000')

        const contextSigner = Wallet.createRandom()

        let claimSnapShot: SnapshotRestorer;

        const getSignature = (
            hash: string, 
            schema: string,
            receiver: string,
            contextSigner: Wallet, 
            proofSigner : Wallet
        ) => {
            const rawMsg = ethers.utils.solidityPack(
                ['string', 'string', 'string', 'address'],
                [hash, "|", schema, receiver]
            )
            let privateKeyArray = new Uint8Array(Buffer.from(contextSigner.privateKey.slice(2), 'hex'))
            const signature = EncryptionUtils.signData(rawMsg, privateKeyArray)

            const proofMsg = `${proofSigner.address}${contextSigner.address}`.toLowerCase()
            privateKeyArray = new Uint8Array(Buffer.from(proofSigner.privateKey.slice(2), 'hex'))
            const proof = EncryptionUtils.signData(proofMsg, privateKeyArray)

            return [signature, proof]
        }

        before(async () => {
            // Reset chain before claim test
            await hre.network.provider.send("hardhat_reset")

            await deployContracts()
            // // Mint reward token
            // await token.mint(contract.address, mintAmount)

            // Add trusted address
            trustedSigners.forEach(async account => {
                await contract.addTrustedSigner(account.address)
            })

            // Add Claim Types
            claimTypes.forEach(async claimType => {
                await contract.addClaimType(
                    claimType.id,
                    claimType.reward,
                    claimType.schema
                )
            })

            claimSnapShot = await takeSnapshot();
        })

        describe("Claim to address", () => {
            it("Failed for non-existing claim types", async () => {
                const [signature, proof] = await getSignature(
                    credentials[0],
                    claimTypes[0].schema,
                    receiverAddress[0],
                    contextSigner,
                    trustedSigners[0]
                )
                await expect(contract.claim(
                    "Invalid ClaimID",
                    credentials[0],
                    receiverAddress[0],
                    signature,
                    proof
                )).to.be.revertedWithCustomError(contract, "InvalidId")
            })
    
            it("Failed for Invalid signer", async () => {
                const badSigner = Wallet.createRandom()
                const [signature, proof] = await getSignature(
                    credentials[0],
                    claimTypes[0].schema,
                    receiverAddress[0],
                    contextSigner,
                    badSigner
                )
                await expect(contract.claim(
                    claimTypes[0].id,
                    credentials[0],
                    receiverAddress[0],
                    signature,
                    proof
                )).to.be.revertedWithCustomError(contract, "InvalidSignature")
            })
    
            it("Claim successfully", async () => {
                await token.mint(contract.address, mintAmount)
    
                const orgContractBalance = await token.balanceOf(contract.address)
    
                expect(orgContractBalance).to.be.greaterThan(claimTypes[0].reward)
                expect(await token.balanceOf(receiverAddress[0])).to.be.equal(0)
    
                const [signature, proof] = await getSignature(
                    credentials[0],
                    claimTypes[0].schema,
                    receiverAddress[0],
                    contextSigner,
                    trustedSigners[0]
                )
    
                await expect(
                    contract.claim(claimTypes[0].id, credentials[0], receiverAddress[0], signature,proof)
                ).to.emit(contract, "Claim").withArgs(claimTypes[0].id, credentials[0], receiverAddress[0])
    
                expect(await token.balanceOf(receiverAddress[0])).to.be.equal(claimTypes[0].reward)
                expect(await token.balanceOf(contract.address)).to.be.equal(orgContractBalance.sub(BigNumber.from(claimTypes[0].reward)))
            })
    
            it("Failed for already claimed", async () => {
                const orgContractBalance = await token.balanceOf(contract.address)
                expect(orgContractBalance).to.be.greaterThan(claimTypes[0].reward)
    
                const [signature, proof] = await getSignature(
                    credentials[0],
                    claimTypes[0].schema,
                    receiverAddress[0],
                    contextSigner,
                    trustedSigners[0]
                )
    
                await expect(contract.claim(
                    claimTypes[0].id,
                    credentials[0],
                    receiverAddress[0],
                    signature,
                    proof                
                )).to.be.revertedWithCustomError(contract, "DuplicatedRequest")
            })
        })

        describe("Claim to storage", () => {
            before(async () => {
                await claimSnapShot.restore();
            })
    
            it("Claim successfully", async () => {
                await token.mint(contract.address, mintAmount)
                const orgContractBalance = await token.balanceOf(contract.address)
                expect(orgContractBalance).to.be.greaterThan(claimTypes[0].reward)

                const orgStorageBalance = await token.balanceOf(storageNodeContract.address);

                const nodeDID = Wallet.createRandom();
                const orgDIDBalance = await storageNodeContract.getBalance(nodeDID.address);              
                    
                const [signature, proof] = await getSignature(
                    credentials[0],
                    claimTypes[0].schema,
                    nodeDID.address,
                    contextSigner,
                    trustedSigners[0]
                )
    
                await expect(
                    contract.claimToStorage(claimTypes[0].id, credentials[0], nodeDID.address, signature,proof)
                ).to.emit(contract, "ClaimToStorage").withArgs(claimTypes[0].id, credentials[0], nodeDID.address)
    
                // Check token deposited
                expect(
                    await token.balanceOf(storageNodeContract.address)
                ).to.be.equal(orgStorageBalance + claimTypes[0].reward);
                expect(
                    await token.balanceOf(contract.address)
                ).to.be.equal(orgContractBalance.sub(BigNumber.from(claimTypes[0].reward)))

                // Check DID balance changed
                expect(
                    await storageNodeContract.getBalance(nodeDID.address)
                ).to.be.eq(orgDIDBalance + claimTypes[0].reward);
            })
        })
    })
})