import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { Wallet } from 'ethers'

import { generateProof, SignInfo } from "./utils"
import { Keyring } from "@verida/keyring";
import { VeridaDIDLinkage } from "../typechain-types";

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
        
        contract = await deployContract()
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
        before(async () => {
            signInfo = await generateProof()
        })
    })

    /*
    describe("Claim SBT", () => {
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
            
            [contract, signInfo] = await Promise.all([
                deployContract(true),
                generateProof()
            ])

            const msg = ethers.utils.solidityPack(
                ['string','address'],
                [`${sbtType}-${uniqueId}-`, signInfo.userAddress]
            )
            signedData = await signInfo.signKeyring.sign(msg)
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

    })
    */
});