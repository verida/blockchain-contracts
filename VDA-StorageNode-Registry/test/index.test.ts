import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { BigNumber, BigNumberish, Wallet } from 'ethers'

import { IStorageNodeRegistry, MockToken, StorageNodeRegistry } from "../typechain-types";

import { createDatacenterStruct, createStorageNodeInputStruct, getAddNodeSignatures, getLogNodeIssueSignatures, getRemoveCompleteSignatures, getRemoveStartSignatures, getWithdrawSignatures } from "./helpers"; 

import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers"
import { assert } from "console";
import { days, hours, minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

let contract: StorageNodeRegistry
let token: MockToken

const INVALID_COUNTRY_CODES = [
    "",         // Invalid code length
    " ",        // Invalid code length
    "A",        // Invalid code length
    "ABC",      // Invalid code length
    "ACCD",     // Invalid code length
    "SG"        // Capital letters in the code
];

const INVALID_REGION_CODES = [
    "",                 // region code can not empty
    "North America",    // Capital letters in the code
    "Europe"            // Capital letter in the code
]

const dataCenters : IStorageNodeRegistry.DatacenterInputStruct[] = [
    createDatacenterStruct("center-1", "us", "north america", -90, -150),
    createDatacenterStruct("center-2", "uk", "europe", 80, 130),
    createDatacenterStruct("center-3", "us", "north america", -70, -120),
]

const checkAddNode = async (
    storageNode: IStorageNodeRegistry.StorageNodeInputStruct,
    user: Wallet,
    trustedSigner: Wallet,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);
    const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

    if (expectResult === true) {
        const tx = await contract.addNode(storageNode, requestSignature, requestProof, authSignature);

        await expect(tx).to.emit(contract, "AddNode").withArgs(
            storageNode.didAddress,
            storageNode.endpointUri,
            storageNode.countryCode,
            storageNode.regionCode,
            storageNode.datacenterId,
            storageNode.lat,
            storageNode.long,
            storageNode.slotCount,
            anyValue
        );
    } else {
        await expect(
            contract.addNode(storageNode, requestSignature, requestProof, authSignature)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}

const checkRemoveNodeStart = async (
    user: Wallet,
    unregisterTime: number,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);

    const { requestSignature, requestProof } = getRemoveStartSignatures(user, unregisterTime, nonce);

    if (expectResult === true) {
        await expect(
            contract.removeNodeStart(user.address, unregisterTime, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeStart").withArgs(user.address, unregisterTime);
    } else {
        await expect(
            contract.removeNodeStart(user.address, unregisterTime, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }    
}

const checkRemoveNodeComplete = async (
    user: Wallet,
    requestor: SignerWithAddress,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);
    const {requestSignature, requestProof} = getRemoveCompleteSignatures(user, nonce);

    if (expectResult === true) {
        await expect(
            contract.connect(requestor).removeNodeComplete(user.address, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeComplete").withArgs(user.address);
    } else {
        await expect(
            contract.connect(requestor).removeNodeComplete(user.address, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}

const VALID_NUMBER_SLOTS = 20000;

describe("Verida StorageNodeRegistry", function () {

    this.timeout(200000);

    let owner: SignerWithAddress;
    let accounts: SignerWithAddress[]

    let snapShotAfterDeploy: SnapshotRestorer

    const deployToken = async () : Promise<MockToken> => {
        const tokenFactory = await ethers.getContractFactory("MockToken")
        const token = (await upgrades.deployProxy(
            tokenFactory,
            ["VdaToken", "VDA"],
            {
                initializer: "initialize"
            }
        )) as MockToken
        await token.deployed();

        return token;
    }
    
    const deployContract = async (isReset = false) : Promise<[MockToken, StorageNodeRegistry]> => {
        if (isReset) {
            // reset chain before every test
            await hre.network.provider.send("hardhat_reset");
        }

        const token = await deployToken();

        const contractFactory = await ethers.getContractFactory("StorageNodeRegistry")
        const contract = (await upgrades.deployProxy(
            contractFactory,
            [token.address],
            {
                initializer: "initialize"   
            }
        )) as StorageNodeRegistry;
        await contract.deployed();

        return [token, contract];
    }

    const slotTokenAmount = async (numberSlot: BigNumberish) : Promise<BigNumber> => {
        const stakePerSlot = await contract.getStakePerSlot();
        let tokenAmount = stakePerSlot.mul(numberSlot);
        return tokenAmount;
    }

    const approveToken =async (numberSlot: BigNumberish, from: SignerWithAddress, to: string, isMinting = false) => {
        const tokenAmount = await slotTokenAmount(numberSlot);
        if (isMinting) {
            await token.mint(from.address, tokenAmount.toString());
        }
        await token.connect(from).approve(to, tokenAmount.toString());
    }

    before(async () => {
        const accountList = await ethers.getSigners();
        owner = accountList[0];

        accounts = [
            accountList[1],
            accountList[2],
            accountList[3],
            accountList[4]
        ];
        
        [token, contract] = await deployContract();
                
        snapShotAfterDeploy = await takeSnapshot();
        
        await token.mint(owner.address, BigNumber.from("1000000000000000000000"));
    });

    describe("Data center", () => {
        const datacenterIds : BigNumber[] = []

        describe("Add datacenter", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(accounts[0])
                    .addDataCenter(dataCenters[0])
                ).to.be.rejectedWith("Ownable: caller is not the owner");
            })

            it("Failed: Invalid datacenter names", async () => {
                const invalidDatacenterNames = [
                    "", // Empty name
                    "A3523", //Capital letter in the name
                    "Aa" //Capital letter in the name
                ]
                for (let i = 0; i < invalidDatacenterNames.length; i++ ) {
                    const invalidDataCenter = createDatacenterStruct(invalidDatacenterNames[i], "", "", 0, 0 );
                    await expect(
                        contract.addDataCenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");
                }
                
            })
            
            it("Failed: Invalid country codes",async () => {
                for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", INVALID_COUNTRY_CODES[i], "north america", 0, 0 );
                    await expect(
                        contract.addDataCenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
                }
            })

            it("Failed: Invalid region codes",async () => {
                for (let i = 0; i < INVALID_REGION_CODES.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", "us", "", 0, 0 );
                    await expect(
                        contract.addDataCenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidRegionCode")
                }
            })

            it("Failed: Invlaid Latitude",async () => {
                const invalidLatValues = [-90.05, -180, 91, 500];
                for (let i = 0; i < invalidLatValues.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", "us", "north america", invalidLatValues[i], 0 );
                    await expect(
                        contract.addDataCenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidLatitude")
                }
            })

            it("Failed: Invalid Longitude",async () => {
                const invalidLongValues = [-180.1, -270, -400.2523, 181, 360, 500.235];
                for (let i = 0; i < invalidLongValues.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", "us", "north america", -90, invalidLongValues[i] );
                    await expect(
                        contract.addDataCenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidLongitude")
                }
            })

            it("Success", async () => {
                for (let i = 0; i < dataCenters.length; i++) {
                    const tx = await contract.addDataCenter(dataCenters[i])

                    await expect(tx).to.emit(contract, "AddDataCenter");

                    const transactionReceipt = await tx.wait();
                    const event = transactionReceipt.events?.find(item => {
                        return item.event === 'AddDataCenter'
                    })
                    if (event !== undefined) {
                        datacenterIds.push(event.args![0])
                    }
                }
            })

            it("Failed : Registered datacenter name", async () => {
                const invalidDatacenters = [
                    createDatacenterStruct("center-1", "us", "north america", -90, -150),
                    createDatacenterStruct("center-1", "uk", "europe", 0, 0),
                    createDatacenterStruct("center-2", "au", "oceania", -90, -150),
                    createDatacenterStruct("center-2", "hk", "asia", 0, 0),
                ]

                for (let i = 0; i < invalidDatacenters.length; i++) {
                    await expect(
                        contract.addDataCenter(invalidDatacenters[i])
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName")
                }
            })

            it("Can reuse datacenter name once removed", async () => {
                const currentSnapshot = await takeSnapshot();

                let tx = await contract.removeDataCenter(datacenterIds[0])
                await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], dataCenters[0].name);

                // Re register removed name
                tx = await contract.addDataCenter(dataCenters[0]);
                await expect(tx).to.emit(contract, "AddDataCenter");

                await currentSnapshot.restore();
            })
        })

        describe("Is datacenter name registered", () => {
            const dataCenter = createDatacenterStruct("center-x", "us", "north america", -90, -150);

            it("Return `False` for unregistered name",async () => {
                expect(await contract.isDataCenterNameRegistered(dataCenter.name)).to.be.eq(false);
            })

            it("Return `True` for registered name",async () => {
                // Add data center
                await expect(
                    contract.addDataCenter(dataCenter)
                ).to.emit(contract, "AddDataCenter");

                expect(await contract.isDataCenterNameRegistered(dataCenter.name)).to.be.eq(true);
            })

            it("Return `False` for unregistered name",async () => {
                // Remove data center
                await expect(
                    contract.removeDataCenterByName(dataCenter.name)
                ).to.emit(contract, "RemoveDataCenter");

                expect(await contract.isDataCenterNameRegistered(dataCenter.name)).to.be.eq(false);
            })
        })

        describe("Get datacenters", () => {
            const checkDatacenterResult = (result: IStorageNodeRegistry.DatacenterStructOutput, org: IStorageNodeRegistry.DatacenterInputStruct) => {
                expect(result.name).to.equal(org.name);
                expect(result.countryCode).to.equal(org.countryCode);
                expect(result.regionCode).to.equal(org.regionCode);
                expect(result.lat).to.equal(org.lat);
                expect(result.long).to.equal(org.long);
            }

            describe("Get datacenters by names", () => {
                let currentSnapshot : SnapshotRestorer;
                let dataCenterId : BigNumberish;
                const dataCenter = createDatacenterStruct("center-x", "us", "north america", -90, -150);

                before(async () => {
                    currentSnapshot = await takeSnapshot();

                    const tx = await contract.addDataCenter(dataCenter);

                    await expect(tx).to.emit(contract, "AddDataCenter");

                    const transactionReceipt = await tx.wait();
                    const event = transactionReceipt.events?.find(item => {
                        return item.event === 'AddDataCenter'
                    })
                    if (event !== undefined) {
                        dataCenterId = event.args![0];
                    }
                })

                it("Failed : Unregistered name",async () => {
                    await expect(
                        contract.getDataCentersByName(["invalid name"])
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");

                    await expect(
                        contract.getDataCentersByName(["invalid name", dataCenter.name])
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");

                    await expect(
                        contract.getDataCentersByName([dataCenter.name, "invalid name"])
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");
                })

                it("Success",async () => {
                    const result = await contract.getDataCentersByName([dataCenter.name]);
                    expect(result.length === 1, "Returned a data center");
                    checkDatacenterResult(result[0], dataCenter);
                })

                it("Failed : Removed data center",async () => {
                    await expect(
                        contract.removeDataCenter(dataCenterId)
                    ).to.emit(contract, "RemoveDataCenter");

                    await expect(
                        contract.getDataCentersByName([dataCenter.name])
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");
                })

                after(async () => {
                    await currentSnapshot.restore();
                })
            })

            describe("Get datacenters by IDs", () => {
                let maxDataCenterID : BigNumber;
                before(() => {
                    maxDataCenterID = datacenterIds[datacenterIds.length -1];
                })

                it("Failed: Invalid IDs", async () => {
                    let invalidIDs: BigNumber[] = [BigNumber.from(0)];
                    await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

                    invalidIDs = [BigNumber.from(0), maxDataCenterID.add(1)];
                    await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

                    invalidIDs = [BigNumber.from(0), datacenterIds[0]];
                    await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

                    invalidIDs = [datacenterIds[0], maxDataCenterID.add(1)];
                    await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
                })

                it("Success",async () => {
                    const result = await contract.getDataCenters(datacenterIds);
                    for (let i = 0; i < dataCenters.length; i++) {
                        checkDatacenterResult(result[i], dataCenters[i]);
                    }
                })

                it("Failed: Removed datacenter ID", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove datacenter ID
                    const tx = await contract.removeDataCenter(datacenterIds[0]);
                    await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], dataCenters[0].name);

                    // Failed to get datacenters
                    await expect(contract.getDataCenters(datacenterIds)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

                    await currentSnapshot.restore();
                })

            })

            describe("Get datacenters by country code", () => {
                it("Failed: Invalid country code", async () => {
                    for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
                        await expect(contract.getDataCentersByCountry(INVALID_COUNTRY_CODES[i])).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
                    }
                })

                it("Return empty array for unregistered counry codes", async () => {
                    const unregisteredCountryCodes = ["at", "by", "sg"];
                    for (let i = 0; i < unregisteredCountryCodes.length; i++) {
                        expect(
                            await contract.getDataCentersByCountry(unregisteredCountryCodes[i])
                        ).to.deep.equal([]);
                    }
                })

                it("Success", async () => {
                    let result = await contract.getDataCentersByCountry("us");
                    expect(result.length).to.equal(2);
                    checkDatacenterResult(result[0], dataCenters[0]);
                    checkDatacenterResult(result[1], dataCenters[2]);

                    result = await contract.getDataCentersByCountry("uk");
                    expect(result.length).to.equal(1);
                    checkDatacenterResult(result[0], dataCenters[1]);
                })

                it("Should not include removed data centers", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove datacenters
                    for (let i = 0; i < 2; i++) {
                        await expect(
                            contract.removeDataCenter(datacenterIds[i])
                        ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], dataCenters[i].name);
                    }
                    
                    // Check getDataCentersByCountry
                    let result = await contract.getDataCentersByCountry("us");
                    expect(result.length).to.equal(1);
                    checkDatacenterResult(result[0], dataCenters[2]);

                    result = await contract.getDataCentersByCountry("uk");
                    expect(result.length).to.equal(0);

                    await currentSnapshot.restore();
                })
            })

            describe("Get datacenters by region code", () => {
                it("Failed: Invalid region code", async () => {
                    await expect(contract.getDataCentersByRegion("")).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
                })

                it("Return empty arry for unregistered region codes", async () => {
                    const unregisteredRegionCodes = ["asia", "africa"];
                    for (let i = 0; i < unregisteredRegionCodes.length; i++) {
                        expect(await contract.getDataCentersByRegion(unregisteredRegionCodes[i])).to.deep.equal([]);
                    }
                })

                it("Success", async () => {
                    let result = await contract.getDataCentersByRegion("north america");
                    expect(result.length).to.equal(2);
                    checkDatacenterResult(result[0], dataCenters[0]);
                    checkDatacenterResult(result[1], dataCenters[2]);

                    result = await contract.getDataCentersByRegion("europe");
                    expect(result.length).to.equal(1);
                    checkDatacenterResult(result[0], dataCenters[1]);
                })

                it("Should not include removed data centers", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove datacenter IDs
                    for (let i = 0; i < 2; i++) {
                        await expect(
                            contract.removeDataCenter(datacenterIds[i])
                        ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], dataCenters[i].name);
                    }
                    
                    // Check getDataCentersByCountry
                    let result = await contract.getDataCentersByRegion("north america");
                    expect(result.length).to.equal(1);
                    checkDatacenterResult(result[0], dataCenters[2]);

                    result = await contract.getDataCentersByRegion("europe");
                    expect(result.length).to.equal(0);

                    await currentSnapshot.restore();
                })
            })
        })

        describe("Remove datacenter", () => {
            let maxDataCenterID : BigNumber;
            let currentSnapShot : SnapshotRestorer;

            const user = Wallet.createRandom();
            const trustedSigner = Wallet.createRandom();
            const storageNode = createStorageNodeInputStruct(
                user.address, 
                "https://1",
                "us",
                "north america",
                1,
                -90,
                -180,
                VALID_NUMBER_SLOTS
            );


            before(async () => {
                maxDataCenterID = datacenterIds[datacenterIds.length -1];

                await contract.addTrustedSigner(trustedSigner.address);

                currentSnapShot = await takeSnapshot();
            })

            describe("Remove by IDs", () => {
                it("Failed: Not created datacenterId", async () => {
                    const invalidIds = [BigNumber.from(0), maxDataCenterID.add(1), maxDataCenterID.add(100)]
    
                    for (let i = 0; i < invalidIds.length; i++) {
                        await expect(
                            contract.removeDataCenter(invalidIds[i])
                        ).to.be.revertedWithCustomError(contract, "InvalidDataCenterId").withArgs(invalidIds[i]);
                    }
                })
    
                it("Success: Fresh datacenters that has no storage nodes added", async () => {
                    const tx = await contract.removeDataCenter(datacenterIds[0]);
    
                    await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], anyValue);
                })
    
                it("Failed: Removed datacenterId", async () => {
                    await expect(
                        contract.removeDataCenter(datacenterIds[0])
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
                })
    
                it("Failed: Has depending nodes", async () => {
                    storageNode.datacenterId = datacenterIds[1];
    
                    const decimal = await token.decimals()
                    const stakePerSlot = await contract.getStakePerSlot();
                    let tokenAmount = BigNumber.from(10);
                    tokenAmount = tokenAmount.pow(decimal);
                    tokenAmount = tokenAmount.mul(BigNumber.from(storageNode.slotCount))
                    tokenAmount = tokenAmount.mul(stakePerSlot)
                    await token.approve(contract.address, tokenAmount.toString());
    
                    // Add storage node 
                    await checkAddNode(storageNode, user, trustedSigner, true);
    
                    // Failed to remove datacenter
                    await expect(contract.removeDataCenter(datacenterIds[1])).to.be.revertedWithCustomError(contract, "HasDependingNodes");
                })
    
                it("Success: After depending nodes are removed",async () => {
                    // Remove start
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    await checkRemoveNodeStart(user, unregisterTime);
                    
                    // Remove complete
                    await time.increaseTo(unregisterTime);
                    await checkRemoveNodeComplete(user, owner);
    
                    // Success to remove datacenter
                    await expect(
                        contract.removeDataCenter(datacenterIds[1])
                    ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[1], anyValue);
                })
            })

            describe("Remove by name", () => {
                before(async () => {
                    await currentSnapShot.restore();
                })

                it("Failed: Invalid name", async () => {
                    const invalidNames = ["Invalid1", "Unregistered"];
    
                    for (let i = 0; i < invalidNames.length; i++) {
                        await expect(
                            contract.removeDataCenterByName(invalidNames[i])
                        ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName").withArgs(invalidNames[i]);
                    }
                })
    
                it("Success: Fresh datacenters that has no storage nodes added", async () => {
                    const tx = await contract.removeDataCenterByName(dataCenters[0].name);
    
                    await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], dataCenters[0].name);
                })
    
                it("Failed: Removed datacenter", async () => {
                    await expect(
                        contract.removeDataCenterByName(dataCenters[0].name)
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName").withArgs(dataCenters[0].name);
                })
    
                it("Failed: Has depending nodes", async () => {
                    storageNode.datacenterId = datacenterIds[1];
    
                    const decimal = await token.decimals()
                    const stakePerSlot = await contract.getStakePerSlot();
                    let tokenAmount = BigNumber.from(10);
                    tokenAmount = tokenAmount.pow(decimal);
                    tokenAmount = tokenAmount.mul(BigNumber.from(storageNode.slotCount))
                    tokenAmount = tokenAmount.mul(stakePerSlot)
                    await token.approve(contract.address, tokenAmount.toString());
    
                    // Add storage node 
                    await checkAddNode(storageNode, user, trustedSigner, true);
    
                    // Failed to remove datacenter
                    await expect(contract.removeDataCenterByName(dataCenters[1].name)).to.be.revertedWithCustomError(contract, "HasDependingNodes");
                })
    
                it("Success: After depending nodes are removed",async () => {
                    // Remove start
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    await checkRemoveNodeStart(user, unregisterTime);
                    
                    // Remove complete
                    await time.increaseTo(unregisterTime);
                    await checkRemoveNodeComplete(user, owner);
    
                    // Success to remove datacenter
                    await expect(
                        contract.removeDataCenterByName(dataCenters[1].name)
                    ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[1], dataCenters[1].name);
                })
            })
        })
    });

    describe("Storage node", () => {

        let snapShotWithDatacenters: SnapshotRestorer

        const setNodeAddedStatus = async () => {
            await snapShotWithDatacenters.restore();
            await contract.addTrustedSigner(trustedSigner.address);
            await contract.setStakingRequired(true);
            await approveToken(BigNumber.from(storageNode.slotCount), owner, contract.address, true);
            await checkAddNode(storageNode, user, trustedSigner, true);
        }

        const trustedSigner = Wallet.createRandom();
        const user = Wallet.createRandom();
        
        const storageNode = createStorageNodeInputStruct(
            user.address, 
            "https://1",
            "us",
            "north america",
            1,
            -90,
            -180,
            VALID_NUMBER_SLOTS
        );
        
        const datacenterIds : BigNumber[] = [];
        let maxDataCenterID : BigNumber;

        before(async () => {
            await snapShotAfterDeploy.restore();

            // Add datacenters
            for (let i = 0; i < dataCenters.length; i++) {
                const tx = await contract.addDataCenter(dataCenters[i])

                const transactionReceipt = await tx.wait();
                const event = transactionReceipt.events?.find(item => {
                    return item.event === 'AddDataCenter'
                })
                if (event !== undefined) {
                    datacenterIds.push(event.args![0])
                }
            }

            maxDataCenterID = datacenterIds[datacenterIds.length -1];

            snapShotWithDatacenters = await takeSnapshot();
        })

        describe("Add storage node", () => {
            const didAddress = Wallet.createRandom().address //signInfo.userAddress;

            before(async () => {
                await snapShotWithDatacenters.restore();
            })

            describe("Failed for invalid arguments", () => {
                it("Failed: Invalid didAddress", async () => {
                    const invalidDIDAddresses = [
                        "",                         // Empty address
                        `did:vda:${didAddress}`     // DID
                    ]
                    for (let i = 0; i < 1; i++) {
                        const nodeInfo = createStorageNodeInputStruct(invalidDIDAddresses[i], "", "", "", 0, 0, 0, 1);
                        try {
                            await contract.addNode(nodeInfo, "0x00", "0x00", "0x00");
                        } catch (err) {
                            expect(err.reason).to.equal('resolver or addr is not configured for ENS name');
                        }
                    }
                })
                
                it("Failed: Empty endpoint uri", async () => {
                    const nodeInfo = createStorageNodeInputStruct(didAddress, "", "", "", 0, 0, 0, 1);
                    await expect(
                        contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                    ).to.be.revertedWithCustomError(contract, "InvalidEndpointUri")
                })
    
                it("Failed: Invalid country codes", async () => {
                    for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
                        const nodeInfo = createStorageNodeInputStruct(
                            didAddress,
                            "https://1",
                            INVALID_COUNTRY_CODES[i],
                            "",
                            0,
                            0,
                            0,
                            1);
                        await expect(
                            contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
                    }
                })
    
                it("Failed: Invalid region codes", async () => {
                    for (let i = 0; i < INVALID_REGION_CODES.length; i++) {
                        const nodeInfo = createStorageNodeInputStruct(
                            didAddress,
                            "https://1",
                            "us",
                            INVALID_REGION_CODES[i],
                            0,
                            0,
                            0,
                            1);
    
                        await expect(
                            contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
                    }
                })
    
                it("Failed: Invalid datacenterID - unregistered", async () => {
                    const invalidIds = [BigNumber.from(0), maxDataCenterID.add(1), maxDataCenterID.add(100)];
                    for (let i = 0; i < invalidIds.length; i++) {
                        const nodeInfo = createStorageNodeInputStruct(
                            didAddress,
                            "https://1",
                            "us",
                            "north america",
                            invalidIds[i],
                            0,
                            0,
                            1);
    
                        await expect(
                            contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
                    }
                })
    
                it("Failed: Invalid datacenterID - removed", async () => {
                    const currentSnapshot = await takeSnapshot();
    
                    await contract.removeDataCenter(datacenterIds[0]);
    
                    const nodeInfo = createStorageNodeInputStruct(
                        didAddress,
                        "https://1",
                        "us",
                        "north america",
                        datacenterIds[0],
                        0,
                        0,
                        1);
    
                    await expect(
                        contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                    ).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
    
                    await currentSnapshot.restore();
                })
    
                it("Failed: Invlaid Latitude",async () => {
                    const invalidLatValues = [-90.05, -180, 91, 500];
                    for (let i = 0; i < invalidLatValues.length; i++) {
                        const nodeInfo = createStorageNodeInputStruct(
                            didAddress,
                            "https://1",
                            "us",
                            "north america",
                            datacenterIds[0],
                            invalidLatValues[i],
                            0,
                            1);
                        await expect(
                            contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidLatitude")
                    }
                })
    
                it("Failed: Invalid Longitude",async () => {
                    const invalidLongValues = [-180.1, -270, -400.2523, 181, 360, 500.235];
                    for (let i = 0; i < invalidLongValues.length; i++) {
                        const nodeInfo = createStorageNodeInputStruct(
                            didAddress,
                            "https://1",
                            "us",
                            "north america",
                            datacenterIds[0],
                            0,
                            invalidLongValues[i],
                            1);
                        await expect(
                            contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidLongitude")
                    }
                })
    
                it("Failed: Invalid slotCount",async () => {
                    const invalidSlots = [0, 100, 20001];
                    for (let i = 0; i < invalidSlots.length; i++) {
                        const nodeInfo = createStorageNodeInputStruct(
                            didAddress,
                            "https://1",
                            "us",
                            "north america",
                            datacenterIds[0],
                            0,
                            0,
                            invalidSlots[i]);
                        await expect(
                            contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidSlotCount")
                    }
                    
                })
    
                it("Failed: No trusted signer",async () => {
                    const nonce = await contract.nonce(user.address);
                    
                    const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);
    
                    await expect(
                        contract.addNode(storageNode, requestSignature, requestProof, authSignature)
                    ).to.be.revertedWithCustomError(contract, "NoSigners");
                })
    
                it("Failed: Invalid auth signature",async () => {
                    await contract.addTrustedSigner(trustedSigner.address);
    
                    const badSigner = Wallet.createRandom();
    
                    const nonce = await contract.nonce(user.address);
    
                    const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, badSigner);
    
                    await expect(
                        contract.addNode(storageNode, requestSignature, requestProof, authSignature)
                    ).to.be.revertedWithCustomError(contract, "InvalidSignature");
                })
            })

            describe("Test when the staking is not required", () => {
                before(async () => {
                    await snapShotWithDatacenters.restore();
                    await contract.addTrustedSigner(trustedSigner.address);

                    expect(await contract.isStakingRequired()).to.be.eq(false);
                })

                it("Success", async () => {
                    const requestorBeforeTokenAmount = await token.balanceOf(owner.address);
                    // Add node
                    await checkAddNode(storageNode, user, trustedSigner, true);
    
                    const requestAfterTokenAmount = await token.balanceOf(owner.address);
                    // Check token amount of requestor not changed
                    expect(requestAfterTokenAmount).to.be.equal(requestorBeforeTokenAmount);
                })
    
                it("Failed: Duplicated `didAddress` & `endpointURI`", async () => {
                    // Registered DID
                    await checkAddNode(storageNode, user, trustedSigner, false, "InvalidDIDAddress");
                    
                    // Registered EndpointURI
                    {
                        const anotherUser = Wallet.createRandom();
    
                        const nodeInfo = {...storageNode};
                        nodeInfo.didAddress = anotherUser.address;
    
                        await checkAddNode(nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
                    }
    
                })
    
                it("Failed: didAddress & endpointURI in pending `removal` status", async () => {
                    const currentSnapshot = await takeSnapshot();
    
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
    
                    // Remove a node
                    await checkRemoveNodeStart(user, unregisterTime);
                    
                    // Failed to add for didAddress in pending removal state
                    await checkAddNode(storageNode, user, trustedSigner, false, "InvalidDIDAddress");
                    
                    // Failed to add for endpoint in pending removal state
                    {
                        const anotherUser = Wallet.createRandom();
    
                        const nodeInfo = {...storageNode};
                        nodeInfo.didAddress = anotherUser.address;
    
                        await checkAddNode(nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
                    }
                    await currentSnapshot.restore();
                })
    
                it("Success: For remove completed didAddress & endpointURI", async () => {
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    
                    // Remove start
                    await checkRemoveNodeStart(user, unregisterTime)
    
                    // Remove complete
                    await time.increaseTo(unregisterTime);
                    await checkRemoveNodeComplete(user, owner);
    
                    // Add success
                    await checkAddNode(storageNode, user, trustedSigner, true);
                })
            })

            describe("Test when the staking is required", () => {
                before(async () => {
                    await snapShotWithDatacenters.restore();
                    await contract.addTrustedSigner(trustedSigner.address);

                    await expect(
                        contract.setStakingRequired(true)
                    ).to.emit(contract, "UpdateStakingRequired").withArgs(true);
                })

                it("Failed: Token not allowed from requestor",async () => {
                    const nonce = await contract.nonce(user.address);
    
                    const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

                    await expect(
                        contract.addNode(storageNode, requestSignature, requestProof, authSignature)
                    ).to.be.revertedWith("ERC20: insufficient allowance");
                })
    
                it("Success", async () => {
                    const stakeTokenAmount = await slotTokenAmount(BigNumber.from(storageNode.slotCount))
                    
                    // Approve Token
                    await approveToken(BigNumber.from(storageNode.slotCount), owner, contract.address, true);
    
                    const requestorBeforeTokenAmount = await token.balanceOf(owner.address);
                    // Add node
                    await checkAddNode(storageNode, user, trustedSigner, true);
    
                    const requestAfterTokenAmount = await token.balanceOf(owner.address);
                    // Check token amount updated
                    expect(requestAfterTokenAmount).to.be.equal(requestorBeforeTokenAmount.sub(stakeTokenAmount));
                })
    
                it("Failed: Duplicated `didAddress` & `endpointURI`", async () => {
                    // Registered DID
                    await checkAddNode(storageNode, user, trustedSigner, false, "InvalidDIDAddress");
                    
                    // Registered EndpointURI
                    {
                        const anotherUser = Wallet.createRandom();
    
                        const nodeInfo = {...storageNode};
                        nodeInfo.didAddress = anotherUser.address;
    
                        await checkAddNode(nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
                    }
    
                })
    
                it("Failed: didAddress & endpointURI in pending `removal` status", async () => {
                    const currentSnapshot = await takeSnapshot();
    
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
    
                    // Remove a node
                    await checkRemoveNodeStart(user, unregisterTime);
                    
                    // Failed to add for didAddress in pending removal state
                    await checkAddNode(storageNode, user, trustedSigner, false, "InvalidDIDAddress");
                    
                    // Failed to add for endpoint in pending removal state
                    {
                        const anotherUser = Wallet.createRandom();
    
                        const nodeInfo = {...storageNode};
                        nodeInfo.didAddress = anotherUser.address;
    
                        await checkAddNode(nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
                    }
                    await currentSnapshot.restore();
                })
    
                it("Success: For remove completed didAddress & endpointURI", async () => {
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    
                    // Remove start
                    await checkRemoveNodeStart(user, unregisterTime)
    
                    // Remove complete
                    await time.increaseTo(unregisterTime);
                    await checkRemoveNodeComplete(user, owner);
    
                    // Approve Token
                    await approveToken(BigNumber.from(storageNode.slotCount), owner, contract.address);
    
                    // Add success
                    await checkAddNode(storageNode, user, trustedSigner, true);
                })
            })
        })

        describe("Update STAKE_PER_SLOT", () => {
            const STAKE_PER_SLOT = BigNumber.from(10).pow(18).mul(100);
            it("Failed: Only contract owner allowed",async () => {
                await expect(
                    contract.connect(accounts[1]).updateStakePerSlot(STAKE_PER_SLOT)
                ).to.be.revertedWith('Ownable: caller is not the owner');
            })

            it("Failed: 0 not available",async () => {
                await expect(
                    contract.updateStakePerSlot(0)
                ).to.be.revertedWithCustomError(contract, "InvalidValue")
            })

            it("Failed: Same value",async () => {
                const stakePerSlot = await contract.getStakePerSlot();

                await expect(
                    contract.updateStakePerSlot(stakePerSlot)
                ).to.be.revertedWithCustomError(contract, "InvalidValue")
            })

            it("Success",async () => {
                await expect(
                    contract.updateStakePerSlot(STAKE_PER_SLOT)
                ).to.emit(contract, "UpdateStakePerSlot").withArgs(STAKE_PER_SLOT);
            })
        })

        describe("Get storage node", () => {
            const users = [
                Wallet.createRandom(),
                Wallet.createRandom(),
                Wallet.createRandom()
            ];

            const endpointURI = ["https://1", "https://2", "https://3"];
            const nodeCountry = ["us", "us", "uk"];
            const nodeRegion = ["north america", "north america", "europe"];
            const datacenterId = [1, 2, 3];
            const lat = [-90, -88.5, 40];
            const long = [-180, 10.436, 120.467];

            let storageNodes : IStorageNodeRegistry.StorageNodeInputStruct[] = [];

            const checkGetNodeResult = (
                result: IStorageNodeRegistry.StorageNodeStructOutput, 
                org: IStorageNodeRegistry.StorageNodeInputStruct, ) => {
                expect(result.didAddress).to.equal(org.didAddress);
                expect(result.endpointUri).to.equal(org.endpointUri);
                expect(result.countryCode).to.equal(org.countryCode);
                expect(result.regionCode).to.equal(org.regionCode);
                expect(result.datacenterId).to.equal(org.datacenterId);
                expect(result.lat).to.equal(org.lat);
                expect(result.long).to.equal(org.long);
            }


            before(async () => {
                await snapShotWithDatacenters.restore();

                await contract.addTrustedSigner(trustedSigner.address);

                for (let i = 0; i < users.length; i++) {
                    storageNodes.push(createStorageNodeInputStruct(
                        users[i].address,
                        endpointURI[i],
                        nodeCountry[i],
                        nodeRegion[i],
                        datacenterId[i],
                        lat[i],
                        long[i],
                        VALID_NUMBER_SLOTS)
                    );
                }

                for (let i = 0; i < users.length; i++) {
                    await approveToken(1, owner, contract.address, true);
                    await checkAddNode(storageNodes[i], users[i], trustedSigner, true);
                }
            })

            describe("Get by Address", () => {
                it("Failed: Unregistered address", async () => {
                    const address = Wallet.createRandom().address;

                    await expect(
                        contract.getNodeByAddress(address)
                    ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
                })

                it("Success: status active", async () => {
                    for (let i = 0; i < users.length; i++) {
                        const result = await contract.getNodeByAddress(users[i].address);
                        checkGetNodeResult(result[0], storageNodes[i]);

                        expect(result[1]).to.equal("active");
                    }
                })

                it("Success: pending removal state", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove start
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    await checkRemoveNodeStart(users[0], unregisterTime);

                    // Get by address
                    const result =  await contract.getNodeByAddress(users[0].address);
                    checkGetNodeResult(result[0], storageNodes[0]);

                    expect(result[1]).to.equal("removed");
                    
                    await currentSnapshot.restore();
                })
            })

            describe("Get by Endpoint", () => {
                it("Failed: Unregistered endpoint", async () => {
                    const unregisteredEndpoint = "https://unregistered"

                    await expect(
                        contract.getNodeByEndpoint(unregisteredEndpoint)
                    ).to.be.revertedWithCustomError(contract, "InvalidEndpointUri");
                })

                it("Success : status active", async () => {
                    for (let i = 0; i < users.length; i++) {
                        const result = await contract.getNodeByEndpoint(storageNodes[i].endpointUri);
                        checkGetNodeResult(result[0], storageNodes[i]);
                        expect(result[1]).to.equal("active");
                    }
                })

                it("Success: pending removal state", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove start
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    await checkRemoveNodeStart(users[0], unregisterTime);

                    // Get by endpoint
                    const result = await contract.getNodeByEndpoint(storageNodes[0].endpointUri);
                    checkGetNodeResult(result[0], storageNodes[0]);
                    expect(result[1]).to.equal("removed");

                    await currentSnapshot.restore();
                })
            })

            describe("Get by Country", () => {
                it("Return empty array for unregistered country", async () => {
                    const unregistedCode = "sg";
                    assert(storageNodes.findIndex(item => item.countryCode === unregistedCode) === -1);

                    expect(await contract.getNodesByCountry(unregistedCode)).to.deep.equal([]);
                })

                it("Success", async () => {
                    const allCountryCodes = storageNodes.map(item => item.countryCode);
                    const countryCodes = [...new Set(allCountryCodes)]

                    for (let i = 0; i < countryCodes.length; i++ ){
                        const orgCountryNodes = storageNodes.filter(item => item.countryCode === countryCodes[i])

                        const nodesReturned = await contract.getNodesByCountry(countryCodes[i]);

                        expect(orgCountryNodes.length).to.equal(nodesReturned.length);

                
                        for (let j = 0; j < orgCountryNodes.length; j++) {
                            checkGetNodeResult(nodesReturned[j], orgCountryNodes[j]);
                        }
                    }
                })
            })

            describe("Get by Region", () => {
                it("Return empty array for unregistered country", async () => {
                    const unregistedCode = "africa";
                    assert(storageNodes.findIndex(item => item.regionCode === unregistedCode) === -1);

                    expect(await contract.getNodesByRegion(unregistedCode)).to.deep.equal([]);
                })

                it("Success", async () => {
                    const allRegionCodes = storageNodes.map(item => item.regionCode);
                    const regionCodes = [...new Set(allRegionCodes)]

                    for (let i = 0; i < regionCodes.length; i++ ){
                        const orgRegionNodes = storageNodes.filter(item => item.regionCode === regionCodes[i]);

                        const nodesReturned = await contract.getNodesByRegion(regionCodes[i]);

                        expect(orgRegionNodes.length).to.equal(nodesReturned.length);

                        for (let j = 0; j < orgRegionNodes.length; j++) {
                            checkGetNodeResult(nodesReturned[j], orgRegionNodes[j]);
                        }
                    }
                })
            })
        })

        describe("Get balance", () => {
            before(async () => {
                await snapShotWithDatacenters.restore();
                await contract.addTrustedSigner(trustedSigner.address);
            })

            it("0 for unregistered DID addresses",async () => {
                expect(await contract.getBalance(Wallet.createRandom().address)).to.be.eq(0);
            })

            it("0 when Staking is not required",async () => {
                const currentSnapshot = await takeSnapshot();
                
                await checkAddNode(storageNode, user, trustedSigner, true);
                expect(await contract.getBalance(user.address)).to.eq(0);

                await currentSnapshot.restore();
            })

            it("Success", async () => {
                // Set stakig as required
                await contract.setStakingRequired(true);

                // Approve Token
                await approveToken(BigNumber.from(storageNode.slotCount), owner, contract.address, true);
                // Add node
                await checkAddNode(storageNode, user, trustedSigner, true);

                expect(await contract.getBalance(user.address)).to.not.eq(0);
            })
            
        })

        describe("Deposit", () => {
            let requestor : SignerWithAddress;

            before(async () => {
                requestor = accounts[1];

                await setNodeAddedStatus();

                // Mint 10000 tokens to the requestor
                await token.mint(requestor.address, BigNumber.from("10000000000000000000000"));
            })

            it("Failed : unregistered DID", async () => {
                const randomDID = Wallet.createRandom().address;
                await expect(
                    contract.connect(requestor).depositToken(randomDID, 1)
                ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
            })

            it("Failed : token not approved", async () => {
                await expect(
                    contract.connect(requestor).depositToken(user.address, 100)
                ).to.be.revertedWith("ERC20: insufficient allowance");
            })

            it("Success", async () => {
                const depositAmount = 100;
                // Approve token
                await token.connect(requestor).approve(contract.address, depositAmount);

                // Deposit
                await expect(
                    contract.connect(requestor).depositToken(user.address, depositAmount)
                ).to.emit(contract, "TokenDeposited").withArgs(
                    user.address,
                    requestor.address,
                    depositAmount
                );
            })
            
        })

        describe("StakingRequired", () => {
            before(async() => {
                await snapShotWithDatacenters.restore();
            })

            it("setStakingRequired() & isStakingRequired()",async () => {
                expect(await contract.isStakingRequired()).to.be.eq(false);

                await expect(
                    contract.setStakingRequired(true)
                ).to.emit(contract, "UpdateStakingRequired").withArgs(true);

                expect(await contract.isStakingRequired()).to.be.eq(true);
                
            })
        })

        describe("Slot count range", () => {
            let min : BigNumber
            let max : BigNumber
            before(async () => {
                [min, max] = await contract.getSlotCountRange();
            })

            describe("Update mininum slot count", () => {
                it("Failed : 0 is not available",async () => {
                    await expect(
                        contract.updateMinSlotCount(0)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Current value is not available",async () => {
                    await expect(
                        contract.updateMinSlotCount(min)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Value is bigger than maxSlots",async () => {
                    await expect(
                        contract.updateMinSlotCount(max.add(1))
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Success",async () => {
                    await expect(
                        contract.updateMinSlotCount(min.sub(1))
                    ).to.emit(contract, "UpdateMinSlotCount").withArgs(min.sub(1));

                    const [updateMin, updatedMax] = await contract.getSlotCountRange();
                    expect(updateMin).to.be.eq(min.sub(1));
                    expect(updatedMax).to.be.eq(max);

                    // For maxSlots test
                    min = updateMin;
                })
            })

            describe("Update maximum slot count", () => {
                it("Failed : 0 is not available",async () => {
                    await expect(
                        contract.updateMaxSlotCount(0)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Current value is not available",async () => {
                    await expect(
                        contract.updateMaxSlotCount(max)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Value is less than minSlots",async () => {
                    await expect(
                        contract.updateMaxSlotCount(min.sub(1))
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Success",async () => {
                    await expect(
                        contract.updateMaxSlotCount(max.add(1))
                    ).to.emit(contract, "UpdateMaxSlotCount").withArgs(max.add(1));

                    const [updateMin, updatedMax] = await contract.getSlotCountRange();
                    expect(updateMin).to.be.eq(min);
                    expect(updatedMax).to.be.eq(max.add(1));
                })
            })
        })

        describe("Excess token amount", () => {
            let CUR_STAKE_PER_SLOT: BigNumber;

            before(async () => {
                CUR_STAKE_PER_SLOT = await contract.getStakePerSlot();
            })

            describe("Test when staking not required", () => {
                before(async () => {
                    await snapShotWithDatacenters.restore();
                    await contract.addTrustedSigner(trustedSigner.address);
                    
                    expect(await contract.isStakingRequired()).to.be.eq(false);
                    await checkAddNode(storageNode, user, trustedSigner, true);

                    expect(await contract.excessTokenAmount(user.address)).to.be.eq(0); 
                })

                it("No changes by STAKE_PER_SLOT change",async () => {
                    // Decrease STAKE_PER_SLOT
                    await contract.updateStakePerSlot(CUR_STAKE_PER_SLOT.sub(1));
                    expect(await contract.excessTokenAmount(user.address)).to.be.eq(0);

                    // Increase STAKE_PER_SLOT
                    await contract.updateStakePerSlot(CUR_STAKE_PER_SLOT.add(1));
                    expect(await contract.excessTokenAmount(user.address)).to.be.eq(0);
                })

                it("Negative value by set staking required",async () => {
                    await contract.setStakingRequired(true);
                    expect(await contract.excessTokenAmount(user.address)).to.lessThan(0);  
                })
            })

            describe("Test when staking required", () => {
                before(async () => {
                    await setNodeAddedStatus();
                    expect(await contract.excessTokenAmount(user.address)).to.be.eq(0); 
                })

                it("Positive value by set staking not required",async () => {
                    expect(await contract.excessTokenAmount(user.address)).to.be.eq(0);

                    await contract.setStakingRequired(false);
                    expect(await contract.excessTokenAmount(user.address)).to.greaterThan(0);

                    // Restore staking required
                    await contract.setStakingRequired(true);
                })

                it("Positive value by decreasing STAKE_PER_SLOT",async () => {
                    // Decrease STAKE_PER_SLOT
                    await contract.updateStakePerSlot(CUR_STAKE_PER_SLOT.sub(1));
                    expect(await contract.excessTokenAmount(user.address)).to.greaterThan(0);
                })
    
                it("Negative value by increasing STAKE_PER_SLOT",async () => {
                    // Increase STAKE_PER_SLOT
                    await contract.updateStakePerSlot(CUR_STAKE_PER_SLOT.add(1));
    
                    expect(await contract.excessTokenAmount(user.address)).to.lessThan(0);
                })
            })            
        })

        describe("Withdraw", () => {
            let requestor : SignerWithAddress;

            before(async () => {
                requestor = accounts[1];

                await setNodeAddedStatus();
            })

            it("Failed : No excess token",async () => {
                const nonce = await contract.nonce(user.address);
                const amount = 10;

                expect(await contract.excessTokenAmount(user.address)).to.be.eq(0);

                const {requestSignature, requestProof} = getWithdrawSignatures(user, amount, nonce);
                await expect(
                    contract.withdraw(user.address, amount, requestSignature, requestProof)
                ).to.be.revertedWithCustomError(contract, "NoExcessTokenAmount");
            })

            it("Failed : Amount is bigger than excess token amount",async () => {
                const currentSnapshot = await takeSnapshot();

                // Confirm current excess token amount is zero
                expect(await contract.excessTokenAmount(user.address)).to.be.eq(0);

                let stakePerSlot = await contract.getStakePerSlot();
                // Decrease STAKE_PER_SLOT
                stakePerSlot = stakePerSlot.sub(10);
                await contract.updateStakePerSlot(stakePerSlot);

                // Confirm current excess token amount is not zero
                const excessTokenAmount = await contract.excessTokenAmount(user.address);
                expect(excessTokenAmount).to.not.eq(0);

                const amount = excessTokenAmount.add(10);

                const nonce = await contract.nonce(user.address);
                const {requestSignature, requestProof} = getWithdrawSignatures(user, amount, nonce);
                await expect(
                    contract.connect(requestor).withdraw(user.address, amount, requestSignature, requestProof)
                ).to.be.revertedWithCustomError(contract, "InvalidAmount");
                
                await currentSnapshot.restore();
            })

            it("Success",async () => {
                // Confirm current excess token amount is zero
                expect(await contract.excessTokenAmount(user.address)).to.be.eq(0);

                let stakePerSlot = await contract.getStakePerSlot();
                // Decrease STAKE_PER_SLOT
                stakePerSlot = stakePerSlot.sub(10);
                await contract.updateStakePerSlot(stakePerSlot);

                // Confirm current excess token amount is not zero
                const excessTokenAmount = await contract.excessTokenAmount(user.address);
                expect(excessTokenAmount).to.not.eq(0);

                const amount = excessTokenAmount;

                const orgRequestorTokenAmount = await token.balanceOf(requestor.address);

                // Withdraw
                const nonce = await contract.nonce(user.address);
                const {requestSignature, requestProof} = getWithdrawSignatures(user, amount, nonce);
                await expect(
                    contract.connect(requestor).withdraw(user.address, amount, requestSignature, requestProof)
                ).to.emit(contract, "TokenWithdrawn").withArgs(
                    user.address,
                    requestor.address,
                    excessTokenAmount);
                
                // Check excess tokens are released to requestor
                const curRequestorTokenAmount = await token.balanceOf(requestor.address);
                expect(curRequestorTokenAmount).to.be.eq(orgRequestorTokenAmount.add(excessTokenAmount));
            })
        });

        describe("Log node issue", () => {
            const node = user;
            let requestor : SignerWithAddress;

            let snapShotWithNodeAdded : SnapshotRestorer;

            const checkLogNodeIssue = async (
                requestor: SignerWithAddress,
                logger: Wallet,
                nodeDID: string,
                reasonCode: BigNumberish,
                needMintToRequestor: boolean = false,
                expectResult: boolean = true,
                revertError: string | null = null
            ) => {
                // Mint token to requestor
                if (needMintToRequestor === true)  {
                    const nodeIssueFee = await contract.getNodeIssueFee();
                    // Mint tokens to the requestor
                    await token.mint(requestor.address, nodeIssueFee);
                    // Make requestor approve tokens to the contract
                    await token.connect(requestor).approve(contract.address, nodeIssueFee);
                }

                const nonce = await contract.nonce(logger.address);
                const { requestSignature, requestProof } = getLogNodeIssueSignatures(logger, nodeDID, reasonCode, nonce);
            
                if (expectResult === true) {
                    const tx = await contract.connect(requestor).logNodeIssue(logger.address, nodeDID, reasonCode, requestSignature, requestProof);
            
                    await expect(tx).to.emit(contract, "LoggedNodeIssue").withArgs(
                        logger.address,
                        nodeDID,
                        reasonCode
                    );
                } else {
                    await expect(
                        contract.connect(requestor).logNodeIssue(logger.address, nodeDID, reasonCode, requestSignature, requestProof)
                    ).to.be.revertedWithCustomError(contract, revertError!);
                }
            }

            before(async () => {
                requestor = accounts[1];

                await setNodeAddedStatus();

                snapShotWithNodeAdded = await takeSnapshot();
            })

            describe("Update node issue fee", () => {
                it("Failed : non-owner",async () => {
                    await expect(
                        contract.connect(accounts[0]).updateNodeIssueFee(1)
                    ).to.be.revertedWith("Ownable: caller is not the owner");
                })

                it("Failed : 0 is not allowed",async () => {
                    await expect(
                        contract.updateNodeIssueFee(0)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Update to current value",async () => {
                    const currentNodeIssueFee = await contract.getNodeIssueFee();

                    await expect(
                        contract.updateNodeIssueFee(currentNodeIssueFee)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Success",async () => {
                    const fee = 6; // 5 VDA token
                    const tokenDecimal = await token.decimals();

                    const feeValue = BigNumber.from(10).pow(tokenDecimal).mul(fee);

                    const curFee = await contract.getNodeIssueFee();

                    expect(feeValue).not.to.eq(curFee);

                    await expect(
                        contract.updateNodeIssueFee(feeValue)
                    ).to.emit(contract, "UpdateNodeIssueFee").withArgs(
                        curFee, 
                        feeValue
                    );
                })
            })

            describe("Update log duration for same node", () => {
                it("Failed : non-owner",async () => {
                    await expect(
                        contract.connect(accounts[0]).updateSameNodeLogDuration(hours(1))
                    ).to.be.revertedWith("Ownable: caller is not the owner");
                })

                it("Failed : 0 is not allowed",async () => {
                    await expect(
                        contract.updateSameNodeLogDuration(0)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Update to current value",async () => {
                    const currentSameNodeLogDuration = await contract.getSameNodeLogDuration();

                    await expect(
                        contract.updateSameNodeLogDuration(currentSameNodeLogDuration)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Success",async () => {
                    const curDuration = await contract.getSameNodeLogDuration();
                    const duration = hours(2);
                    await expect(
                        contract.updateSameNodeLogDuration(duration)
                    ).to.emit(contract, "UpdateSameNodeLogDuration").withArgs(
                        curDuration,
                        duration
                    );
                })
            })

            describe("Update log limit per day", () => {
                it("Failed : non-owner",async () => {
                    await expect(
                        contract.connect(accounts[0]).updateLogLimitPerDay(hours(1))
                    ).to.be.revertedWith("Ownable: caller is not the owner");
                })

                it("Failed : 0 is not allowed",async () => {
                    await expect(
                        contract.updateLogLimitPerDay(0)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Failed : Update to current value",async () => {
                    const currentLogLimitPerday = await contract.getLogLimitPerDay();

                    await expect(
                        contract.updateLogLimitPerDay(currentLogLimitPerday)
                    ).to.be.revertedWithCustomError(contract, "InvalidValue");
                })

                it("Success",async () => {
                    const curLogLimitPerDay = await contract.getLogLimitPerDay();
                    await expect(
                        contract.updateLogLimitPerDay(curLogLimitPerDay.add(1))
                    ).to.emit(contract, "UpdateLogLimitPerDay").withArgs(
                        curLogLimitPerDay,
                        curLogLimitPerDay.add(1)
                    );
                })
            })

            describe("Log node issue", () => {
                let requestor: SignerWithAddress;

                const logger = Wallet.createRandom();

                before(async () => {
                    requestor = accounts[1];

                    await snapShotWithNodeAdded.restore();
                })

                describe("Log an issue", () => {
                    it("Failed : Invalid node DID",async () => {
                        const randomNodeDID = Wallet.createRandom().address;
                        await checkLogNodeIssue(requestor, logger, randomNodeDID, 10, false, false, "InvalidDIDAddress");
                    })

                    it("Failed : DID equals to node address",async () => {
                        await checkLogNodeIssue(requestor, logger, logger.address, 10, false, false, "InvalidDIDAddress");
                    })
    
                    it("Failed : Token not approved or insufficient",async () => {
                        const nonce = await contract.nonce(logger.address);
                        const { requestSignature, requestProof } = getLogNodeIssueSignatures(logger, node.address, 10, nonce);
                        await expect(
                            contract.connect(requestor).logNodeIssue(logger.address, node.address, 10, requestSignature, requestProof)
                        ).to.be.rejectedWith("ERC20: insufficient allowance");
                    })
    
                    it("Success",async () => {
                        await checkLogNodeIssue(requestor, logger, node.address, 10, true);
                    })
                })

                describe("Log limit test for same node", () => {
                    it("1 hour log limit for same node DID",async () => {
                        let curBlockTime = await time.latest();
    
                        // Failed in an hour
                        await checkLogNodeIssue(requestor, logger, node.address, 10, true, false, "InvalidSameNodeTime");
    
                        // Success after 1 hour
                        curBlockTime = curBlockTime + hours(1);
                        time.increaseTo(curBlockTime);
                        await checkLogNodeIssue(requestor, logger, node.address, 10, true);
                    })
                })

                describe("Log limit test per day", () => {
                    let curLogLimitPerday: number;
                    const nodes: Wallet[] = [];
                    let logLimitedPerDayState : SnapshotRestorer;

                    before(async () => {
                        await snapShotWithNodeAdded.restore();
    
                        curLogLimitPerday = (await contract.getLogLimitPerDay()).toNumber();

                        for (let i = 0; i <= curLogLimitPerday; i++) {
                            nodes.push(Wallet.createRandom());
                        }

                        // Add different nodes for test
                        for (let i = 0; i < nodes.length; i++) {
                            const storageNode = createStorageNodeInputStruct(
                                nodes[i].address, 
                                "https://1" + i,
                                "us",
                                "north america",
                                1,
                                -90,
                                -180,
                                VALID_NUMBER_SLOTS
                            );
                            // Approve Token
                            await approveToken(BigNumber.from(storageNode.slotCount), owner, contract.address, true);
                            // Add node
                            await checkAddNode(storageNode, nodes[i], trustedSigner, true);
                        }

                        // Add logs till current limit per day
                        for (let i = 0; i < curLogLimitPerday; i++) {
                            const reasonCode = 20;
                            await checkLogNodeIssue(requestor, logger, nodes[i].address, reasonCode, true);
                        }

                        logLimitedPerDayState = await takeSnapshot();
                    })

                    it("Test for current log limit per day",async () => {                       
                        const curBlockTime = await time.latest();

                        // Failed for log limit per day
                        await checkLogNodeIssue(requestor, logger, nodes[curLogLimitPerday].address, 20, true, false, "TimeNotElapsed");
    
                        // Success after 24 hours condition
                        await time.increaseTo(curBlockTime + hours(24));
                        await checkLogNodeIssue(requestor, logger, nodes[curLogLimitPerday].address, 20, true);
                    })

                    it("Test for updating log limit per day",async () => {
                        // Restore limited state
                        await logLimitedPerDayState.restore();

                        // Failed for log limit per day
                        await checkLogNodeIssue(requestor, logger, nodes[curLogLimitPerday].address, 20, true, false, "TimeNotElapsed");

                        // Increase log limit per day
                        await contract.updateLogLimitPerDay(curLogLimitPerday+1);

                        // Success after limit increased
                        await checkLogNodeIssue(requestor, logger, nodes[curLogLimitPerday].address, 20, true);
                    })
                })
            })

            describe("Slash", () => {
                const REASON_CODE = 10;
                const INVALID_REASON_CODE = 11;

                const moreInfoURL = "https://slash"
                
                let requestors : SignerWithAddress[] = [];
                const loggers = [Wallet.createRandom(), Wallet.createRandom()];

                before(async () => {
                    await snapShotWithNodeAdded.restore();

                    // Add requestors. Requestors can be the same
                    for (let i = 0; i < loggers.length; i++) {
                        requestors.push(accounts[i]);
                    }
                })

                it("Failed : non-owner",async () => {
                    await expect(
                        contract.connect(accounts[0]).slash(node.address, REASON_CODE, 10, moreInfoURL)
                    ).to.be.revertedWith("Ownable: caller is not the owner");
                })

                it("Failed : Amount can not be 0",async () => {
                    await expect(
                        contract.slash(node.address, REASON_CODE, 0, moreInfoURL)
                    ).to.be.revertedWithCustomError(contract, "InvalidAmount");
                })

                it("Failed : Amount can not be bigger than the node's staked amount", async () => {
                    const currentAmount = await contract.getBalance(node.address);
                    await expect(
                        contract.slash(node.address, REASON_CODE, currentAmount.add(1), moreInfoURL)
                    ).to.be.revertedWithCustomError(contract, "InvalidAmount");
                })

                it("Failed : Invalid reason code",async () => {
                    const currentAmount = await contract.getBalance(node.address);
                    await expect(
                        contract.slash(node.address, INVALID_REASON_CODE, currentAmount, moreInfoURL)
                    ).to.be.revertedWithCustomError(contract, "InvalidReasonCode");
                })

                it("Success : same portion for 2 loggers",async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Log issues for same node & reason code with same node fee
                    for (let i = 0; i < loggers.length; i++) {
                        await checkLogNodeIssue(requestors[i], loggers[i], node.address, REASON_CODE, true);
                    }

                    const loggerOrgBalances : BigNumber[] = [];
                    for (let i = 0; i < loggers.length; i++) {
                        loggerOrgBalances.push(await contract.getBalance(loggers[i].address));
                    }

                    // Slash 200 token
                    const slashAmount = BigNumber.from(10).pow(await token.decimals()).mul(200);
                    await expect(
                        contract.slash(node.address, REASON_CODE, slashAmount, moreInfoURL)
                    ).to.emit(contract, "Slash").withArgs(
                        node.address,
                        REASON_CODE,
                        anyValue,
                        anyValue,
                        moreInfoURL
                    );

                    // Check the loggers's balance updated
                    for (let i = 0; i < loggers.length; i++) {
                        const curBalance = await contract.getBalance(loggers[i].address);
                        expect(curBalance).to.be.eq(loggerOrgBalances[i].add(slashAmount.div(2)));
                    }                   

                    await currentSnapshot.restore();
                })

                it("Success : different portion by `NodeIssueFee` updated",async () => {
                    const currentSnapshot = await takeSnapshot();

                    const orgNodeIssueFee = await contract.getNodeIssueFee();

                    // Log issue with original fee
                    await checkLogNodeIssue(requestors[0], loggers[0], node.address, REASON_CODE, true);

                    // Update issue fee 3 times of original value.
                    const updatedNodeIssueFee = orgNodeIssueFee.mul(3);
                    await contract.updateNodeIssueFee(updatedNodeIssueFee);

                    // Log issue with updated fee
                    await checkLogNodeIssue(requestors[1], loggers[1], node.address, REASON_CODE, true);

                    // Save original balances of loggers
                    const loggerOrgBalances : BigNumber[] = [];
                    for (let i = 0; i < loggers.length; i++) {
                        loggerOrgBalances.push(await contract.getBalance(loggers[i].address));
                    }

                    // Slash 200 token
                    const slashAmount = BigNumber.from(10).pow(await token.decimals()).mul(200);
                    await expect(
                        contract.slash(node.address, REASON_CODE, slashAmount, moreInfoURL)
                    ).to.emit(contract, "Slash").withArgs(
                        node.address,
                        REASON_CODE,
                        anyValue,
                        anyValue,
                        moreInfoURL
                    );

                    // Check the loggers's balance updated
                    const loggerUpdatedBalances : BigNumber[] = [];
                    for (let i = 0; i < loggers.length; i++) {
                        loggerUpdatedBalances.push(await contract.getBalance(loggers[i].address));
                    }

                    // Confirm that 2nd logger get 3 times of slashed tokens than first logger
                    expect(loggerUpdatedBalances[1].sub(loggerOrgBalances[1])).to.be.eq(
                        (loggerUpdatedBalances[0].sub(loggerOrgBalances[0])).mul(3)
                    );

                    await currentSnapshot.restore();
                })

                it("Success : Different portion by multiple logs from one account",async () => {
                    // Log issues for same node & reason code with same node fee
                    for (let i = 0; i < loggers.length; i++) {
                        await checkLogNodeIssue(requestors[i], loggers[i], node.address, REASON_CODE, true);
                    }

                    // Log 2 more times for second logger
                    for (let i = 0; i < 2; i++) {
                        const curTime = await time.latest();
                        await time.increaseTo(curTime + hours(1));
                        await checkLogNodeIssue(owner, loggers[1], node.address, REASON_CODE, true);
                    }


                    const loggerOrgBalances : BigNumber[] = [];
                    for (let i = 0; i < loggers.length; i++) {
                        loggerOrgBalances.push(await contract.getBalance(loggers[i].address));
                    }

                    // Slash 200 token
                    const slashAmount = BigNumber.from(10).pow(await token.decimals()).mul(200);
                    await expect(
                        contract.slash(node.address, REASON_CODE, slashAmount, moreInfoURL)
                    ).to.emit(contract, "Slash").withArgs(
                        node.address,
                        REASON_CODE,
                        anyValue,
                        anyValue,
                        moreInfoURL
                    );

                    // Get updated balances
                    const loggerUpdatedBalances : BigNumber[] = [];
                    for (let i = 0; i < loggers.length; i++) {
                        loggerUpdatedBalances.push(await contract.getBalance(loggers[i].address));
                    }

                    // Confirm that 2nd logger get 3 times of slashed tokens than first logger
                    expect(loggerUpdatedBalances[1].sub(loggerOrgBalances[1])).to.be.eq(
                        (loggerUpdatedBalances[0].sub(loggerOrgBalances[0])).mul(3)
                    );
                })
            })

            describe("Withdraw issue fee", () => {
                const receiver = Wallet.createRandom();
                const logger = Wallet.createRandom();

                before(async () => {
                    await snapShotWithNodeAdded.restore();
                })

                it("Failed : non-owner",async () => {
                    await expect(
                        contract.connect(accounts[0]).withdrawIssueFee(receiver.address, 100)
                    ).to.be.revertedWith("Ownable: caller is not the owner");
                })

                it("Success",async () => {
                    // No fees before logging an issue
                    expect(await contract.getTotalIssueFee()).to.be.eq(0);

                    // Log a issue
                    const curIssueFee = await contract.getNodeIssueFee();
                    await checkLogNodeIssue(requestor, logger, node.address, 10, true);

                    expect(await contract.getTotalIssueFee()).to.be.eq(curIssueFee);

                    // Withdraw to the receiver
                    expect(await token.balanceOf(receiver.address)).to.be.eq(0);

                    await expect(
                        contract.withdrawIssueFee(receiver.address, curIssueFee)
                    ).to.emit(contract, "WithdrawIssueFee").withArgs(
                        receiver.address,
                        curIssueFee
                    );

                    // Confirm receiver received tokens
                    expect(await token.balanceOf(receiver.address)).to.be.eq(curIssueFee);

                })
            })
        });

        describe("Remove node", () => {
            describe("Test when staking is not required", () => {
                before(async () => {
                    await snapShotWithDatacenters.restore();
    
                    await contract.addTrustedSigner(trustedSigner.address);

                    // Confirm that staking is not required
                    expect(await contract.isStakingRequired()).to.be.eq(false);
                  
                    await checkAddNode(storageNode, user, trustedSigner, true);
                })
    
                describe("Remove node start", () => {
                    it("Failed: Unregistered address", async () => {
                        const temp = Wallet.createRandom();
    
                        await expect(
                            contract.removeNodeStart(temp.address, 0, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
                    })
    
                    it("Failed: Invalid Unregister Time", async () => {
                        const blockTime = await time.latest();
    
                        const invalidTimes = [0, blockTime, blockTime + days(10), blockTime + days(27)];
    
                        for (let i = 0; i < invalidTimes.length; i++) {
                            await expect(
                                contract.removeNodeStart(user.address, 0, "0x00", "0x00")
                            ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime");
                        }
                    })
    
                    it("Success", async () => {
                        const currentSnapshot = await takeSnapshot();
    
                        const blockTime = await time.latest();
                        const unregisterTime = blockTime + days(30);
    
                        await checkRemoveNodeStart(user, unregisterTime);
                        
                        await currentSnapshot.restore();
                    })
                })
    
                describe("Remove node complete", () => {
                    let snapShotRemoveStarted: SnapshotRestorer
    
                    const checkRemoveComplete =async (requestor: SignerWithAddress) => {
                        const requestorOrgTokenAmount = await token.balanceOf(requestor.address);
    
                        // complete remove node
                        await checkRemoveNodeComplete(user, requestor);
    
                        // Confirm requstor token has not changed
                        const requestorCurTokenAmount = await token.balanceOf(requestor.address);
                        expect(requestorCurTokenAmount).to.be.equal(requestorOrgTokenAmount);
                    }
    
                    it("Failed: Unregistered address", async () => {
                        const temp = Wallet.createRandom();
    
                        await expect(
                            contract.removeNodeComplete(temp.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
                    })
    
                    it("Failed: Remove node not started", async () => {
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime");
                    })
    
                    it("Failed: Before remove time", async () => {
                        const currentSnapshot = await takeSnapshot();
    
                        // Remove node start
                        const blockTime = await time.latest();
                        const unregisterTime = blockTime + days(30);
    
                        await checkRemoveNodeStart(user, unregisterTime);
    
                        // Remove node not completed
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime")
    
                        // After 10 days from start
                        await time.increaseTo(blockTime + days(10));
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime")
    
                        // After 20 days from start
                        await time.increaseTo(blockTime + days(20));
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime")
    
                        await currentSnapshot.restore();
                    })
    
                    it("Success", async () => {
                        // Remove node start
                        const blockTime = await time.latest();
                        const unregisterTime = blockTime + days(30);
                        await checkRemoveNodeStart(user, unregisterTime);
    
                        // After 31 days
                        await time.increaseTo(blockTime + days(31));
    
                        snapShotRemoveStarted = await takeSnapshot();
    
                        await checkRemoveComplete(accounts[0]);
                    })  
                    
                    it("Success after stakingRequired is enabled", async () => {
                        await snapShotRemoveStarted.restore();

                        await contract.setStakingRequired(true);
    
                        await checkRemoveComplete(accounts[0]);
                    })  
                })
            })

            describe("Test when staking is required", () => {
                before(async () => {
                    await snapShotWithDatacenters.restore();
    
                    await contract.addTrustedSigner(trustedSigner.address);

                    // Set staking as required
                    await contract.setStakingRequired(true);
    
                    // Register a node
                    await approveToken(BigNumber.from(storageNode.slotCount), owner, contract.address, true);
                    await checkAddNode(storageNode, user, trustedSigner, true);
                })
    
                describe("Remove node start", () => {
                    it("Failed: Unregistered address", async () => {
                        const temp = Wallet.createRandom();
    
                        await expect(
                            contract.removeNodeStart(temp.address, 0, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
                    })
    
                    it("Failed: Invalid Unregister Time", async () => {
                        const blockTime = await time.latest();
    
                        const invalidTimes = [0, blockTime, blockTime + days(10), blockTime + days(27)];
    
                        for (let i = 0; i < invalidTimes.length; i++) {
                            await expect(
                                contract.removeNodeStart(user.address, 0, "0x00", "0x00")
                            ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime");
                        }
                    })
    
                    it("Success", async () => {
                        const currentSnapshot = await takeSnapshot();
    
                        const blockTime = await time.latest();
                        const unregisterTime = blockTime + days(30);
    
                        await checkRemoveNodeStart(user, unregisterTime);
                        
                        await currentSnapshot.restore();
                    })
                })
    
                describe("Remove node complete", () => {
                    let snapShotRemoveStarted: SnapshotRestorer
    
                    const checkRemoveComplete =async (requestor: SignerWithAddress) => {
                        const requestorOrgTokenAmount = await token.balanceOf(requestor.address);
    
                        const stakedTokenAmount = await contract.getBalance(user.address);
    
                        // complete remove node
                        await checkRemoveNodeComplete(user, requestor);
    
                        // Confirm requstor received the staked token
                        const requestorCurTokenAmount = await token.balanceOf(requestor.address);
                        expect(requestorCurTokenAmount).to.be.equal(requestorOrgTokenAmount.add(stakedTokenAmount));
                    }
    
                    it("Failed: Unregistered address", async () => {
                        const temp = Wallet.createRandom();
    
                        await expect(
                            contract.removeNodeComplete(temp.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
                    })
    
                    it("Failed: Remove node not started", async () => {
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime");
                    })
    
                    it("Failed: Before remove time", async () => {
                        const currentSnapshot = await takeSnapshot();
    
                        // Remove node start
                        const blockTime = await time.latest();
                        const unregisterTime = blockTime + days(30);
    
                        await checkRemoveNodeStart(user, unregisterTime);
    
                        // Remove node not completed
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime")
    
                        // After 10 days from start
                        await time.increaseTo(blockTime + days(10));
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime")
    
                        // After 20 days from start
                        await time.increaseTo(blockTime + days(20));
                        await expect(
                            contract.removeNodeComplete(user.address, "0x00", "0x00")
                        ).to.be.revertedWithCustomError(contract, "InvalidUnregisterTime")
    
                        await currentSnapshot.restore();
                    })
    
                    it("Success when STAKE_PER_SLOT has no changes", async () => {
                        // Remove node start
                        const blockTime = await time.latest();
                        const unregisterTime = blockTime + days(30);
                        await checkRemoveNodeStart(user, unregisterTime);
    
                        // After 31 days
                        await time.increaseTo(blockTime + days(31));
    
                        snapShotRemoveStarted = await takeSnapshot();
    
                        await checkRemoveComplete(accounts[0]);
                    })
    
                    it("Success when STAKE_PER_SLOT increased",async () => {
                        await snapShotRemoveStarted.restore();
    
                        // Increase STAKE_PER_SLOT
                        let stakePerSlot = await contract.getStakePerSlot();
                        stakePerSlot = stakePerSlot.add(10);
                        await contract.updateStakePerSlot(stakePerSlot);
    
                        await checkRemoveComplete(accounts[1]);
                    })
    
                    it("Success when STAKE_PER_SLOT decreased",async () => {
                        await snapShotRemoveStarted.restore();
    
                        // Decrease STAKE_PER_SLOT
                        let stakePerSlot = await contract.getStakePerSlot();
                        stakePerSlot = stakePerSlot.sub(10);
                        await contract.updateStakePerSlot(stakePerSlot);
    
                        // Confirm excess tokens
                        expect(await contract.excessTokenAmount(user.address)).to.not.eq(0);
    
                        await checkRemoveComplete(accounts[2]);
                    })
                })
            })
        })
    });  
});