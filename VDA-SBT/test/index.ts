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

chai.use(chaiAsPromised);

const tokenURI = [
    "https://sbt/1.jpg",
    "https://sbt/2.jpg",
    "https://sbt/3.jpg",
]
export const zeroAddress = "0x0000000000000000000000000000000000000000"

describe("Verida Soulbound", () => {
    let contract: SoulboundNFT
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

    describe("NFT Mint", () => {
        it("Failed : Not a owner", async() => {
            await expect(contract.connect(veridians[0]).safeMint(
                veridians[1].address,
                tokenURI[1]
            )).to.be.rejectedWith("Ownable: caller is not the owner");
        });

        it("Success : NFT mint", async () => {
            await expect(contract.ownerOf(0)).to.be.rejectedWith("ERC721: invalid token ID")
            const tx  = await contract.safeMint(veridians[0].address, tokenURI[0])
            expect(await contract.ownerOf(0)).equal(veridians[0].address)

            const events = (await tx.wait()).events

            const transferEvent = events?.[0] as TransferEvent
            const lockEvent = events?.[1] as LockedEvent

            expect(transferEvent.event).to.equal("Transfer")
            expect(transferEvent.args.from).to.equal(zeroAddress)
            expect(transferEvent.args.to).to.equal(veridians[0].address)
            expect(transferEvent.args.tokenId).to.equal(0)

            expect(lockEvent.event).to.equal("Locked")
            expect(lockEvent.args.tokenId).to.equal(0)
        })
    });

    describe("NFT Transfer Restricted", () => {
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
});