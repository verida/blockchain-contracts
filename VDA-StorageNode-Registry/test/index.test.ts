import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import hre, { ethers , upgrades } from "hardhat"
import { BigNumber, Wallet } from 'ethers'

import { generateProof, SignInfo } from "./proof"
import EncryptionUtils from '@verida/encryption-utils'
import { Keyring } from "@verida/keyring";
import { IStorageNodeRegistry, StorageNodeRegistry } from "../typechain-types";

import { createDatacenterStruct, createStorageNodeInputStruct, getAddNodeSignatures, getRemoveCompleteSignatures, getRemoveStartSignatures } from "./helpers"; 

import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers"
import { assert } from "console";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

let contract: StorageNodeRegistry

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

const dataCenters : IStorageNodeRegistry.DatacenterStruct[] = [
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
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);
    const {requestSignature, requestProof} = getRemoveCompleteSignatures(user, nonce);

    if (expectResult === true) {
        await expect(
            contract.removeNodeComplete(user.address, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeComplete").withArgs(user.address);
    } else {
        await expect(
            contract.removeNodeComplete(user.address, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}

describe("Verida StorageNodeRegistry", function () {

    this.timeout(200000);

    let owner: SignerWithAddress;
    let accounts: SignerWithAddress[]

    let signInfo : SignInfo

    let snapShotAfterDeploy: SnapshotRestorer
    
    
    const deployContract = async (isReset = false) : Promise<StorageNodeRegistry> => {
        if (isReset) {
            // reset chain before every test
            await hre.network.provider.send("hardhat_reset");
        }

        const contractFactory = await ethers.getContractFactory("StorageNodeRegistry")
        const contract = (await upgrades.deployProxy(
            contractFactory,
            {
                initializer: "initialize"
            }
        )) as StorageNodeRegistry;
        await contract.deployed();

        return contract
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
        
        contract = await deployContract();

        snapShotAfterDeploy = await takeSnapshot();
    });

    /*
    describe("Data center", () => {
        const datacenterIds : BigNumber[] = []

        describe("Add datacenter", () => {
            it("Failed : non-owner", async () => {
                await expect(contract
                    .connect(accounts[0])
                    .addDatacenter(dataCenters[0])
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
                        contract.addDatacenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidDatacenterName");
                }
                
            })
            
            it("Failed: Invalid country codes",async () => {
                for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", INVALID_COUNTRY_CODES[i], "north america", 0, 0 );
                    await expect(
                        contract.addDatacenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
                }
            })

            it("Failed: Invalid region codes",async () => {
                for (let i = 0; i < INVALID_REGION_CODES.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", "us", "", 0, 0 );
                    await expect(
                        contract.addDatacenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidRegionCode")
                }
            })

            it("Failed: Invlaid Latitude",async () => {
                const invalidLatValues = [-90.05, -180, 91, 500];
                for (let i = 0; i < invalidLatValues.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", "us", "north america", invalidLatValues[i], 0 );
                    await expect(
                        contract.addDatacenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidLatitude")
                }
            })

            it("Failed: Invalid Longitude",async () => {
                const invalidLongValues = [-180.1, -270, -400.2523, 181, 360, 500.235];
                for (let i = 0; i < invalidLongValues.length; i++) {
                    const invalidDataCenter = createDatacenterStruct("dc-test", "us", "north america", -90, invalidLongValues[i] );
                    await expect(
                        contract.addDatacenter(invalidDataCenter)
                    ).to.be.revertedWithCustomError(contract, "InvalidLongitude")
                }
            })

            it("Success", async () => {
                for (let i = 0; i < dataCenters.length; i++) {
                    const tx = await contract.addDatacenter(dataCenters[i])

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
                        contract.addDatacenter(invalidDatacenters[i])
                    ).to.be.revertedWithCustomError(contract, "InvalidDatacenterName")
                }
            })

            it("Can reuse datacenter name once removed", async () => {
                const currentSnapshot = await takeSnapshot();

                let tx = await contract.removeDatacenter(datacenterIds[0])
                await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0]);

                // Re register removed name
                tx = await contract.addDatacenter(dataCenters[0]);
                await expect(tx).to.emit(contract, "AddDataCenter");

                await currentSnapshot.restore();
            })
        })

        describe("Get datacenters", () => {
            const checkDatacenterResult = (result: IStorageNodeRegistry.DatacenterStructOutput, org: IStorageNodeRegistry.DatacenterStruct) => {
                expect(result.name).to.equal(org.name);
                expect(result.countryCode).to.equal(org.countryCode);
                expect(result.regionCode).to.equal(org.regionCode);
                expect(result.lat).to.equal(org.lat);
                expect(result.long).to.equal(org.long);
            }

            describe("Get by datacenter IDs", () => {
                let maxDataCenterID : BigNumber;
                before(() => {
                    maxDataCenterID = datacenterIds[datacenterIds.length -1];
                })

                it("Failed: Invalid IDs", async () => {
                    let invalidIDs: BigNumber[] = [BigNumber.from(0)];
                    await expect(contract.getDatacenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");

                    invalidIDs = [BigNumber.from(0), maxDataCenterID.add(1)];
                    await expect(contract.getDatacenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");

                    invalidIDs = [BigNumber.from(0), datacenterIds[0]];
                    await expect(contract.getDatacenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");

                    invalidIDs = [datacenterIds[0], maxDataCenterID.add(1)];
                    await expect(contract.getDatacenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");
                })

                it("Success",async () => {
                    const result = await contract.getDatacenters(datacenterIds);
                    for (let i = 0; i < dataCenters.length; i++) {
                        checkDatacenterResult(result[i], dataCenters[i]);
                    }
                })

                it("Failed: Removed datacenter ID", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove datacenter ID
                    const tx = await contract.removeDatacenter(datacenterIds[0]);
                    await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0]);

                    // Failed to get datacenters
                    await expect(contract.getDatacenters(datacenterIds)).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");

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
                            contract.removeDatacenter(datacenterIds[i])
                        ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i]);
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
                            contract.removeDatacenter(datacenterIds[i])
                        ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i]);
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

            const user = Wallet.createRandom();
            const trustedSigner = Wallet.createRandom();
            const storageNode = createStorageNodeInputStruct(
                user.address, 
                "https://1",
                "us",
                "north america",
                1,
                -90,
                -180
            );


            before(async () => {
                maxDataCenterID = datacenterIds[datacenterIds.length -1];

                await contract.addTrustedSigner(trustedSigner.address);
            })

            it("Failed: Not created datacenterId", async () => {
                const invalidIds = [BigNumber.from(0), maxDataCenterID.add(1), maxDataCenterID.add(100)]

                for (let i = 0; i < invalidIds.length; i++) {
                    await expect(
                        contract.removeDatacenter(invalidIds[i])
                    ).to.be.revertedWithCustomError(contract, "InvalidDatacenterId").withArgs(invalidIds[i]);
                }
            })

            it("Success: Fresh datacenters that has no storage nodes added", async () => {
                const tx = await contract.removeDatacenter(datacenterIds[0]);

                await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0]);
            })

            it("Failed: Removed datacenterId", async () => {
                await expect(
                    contract.removeDatacenter(datacenterIds[0])
                ).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");
            })

            it("Failed: Has depending nodes", async () => {
                storageNode.datacenterId = datacenterIds[1];
                // Add storage node 
                await checkAddNode(storageNode, user, trustedSigner, true);

                // Failed to remove datacenter
                await expect(contract.removeDatacenter(datacenterIds[1])).to.be.revertedWithCustomError(contract, "HasDependingNodes");
            })

            it("Success: After depending nodes are removed",async () => {
                // Remove start
                const blockTime = await time.latest();
                const unregisterTime = blockTime + days(30);
                await checkRemoveNodeStart(user, unregisterTime);
                
                // Remove complete
                await time.increaseTo(unregisterTime);
                await checkRemoveNodeComplete(user);

                // Success to remove datacenter
                await expect(
                    contract.removeDatacenter(datacenterIds[1])
                ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[1]);
            })
        })
    });
    */

    describe("Storage node", () => {

        let snapShotWithDatacenters: SnapshotRestorer

        const trustedSigner = Wallet.createRandom();
        
        const datacenterIds : BigNumber[] = [];
        let maxDataCenterID : BigNumber;

        before(async () => {
            await snapShotAfterDeploy.restore();

            // Add datacenters
            for (let i = 0; i < dataCenters.length; i++) {
                const tx = await contract.addDatacenter(dataCenters[i])

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
            const user = Wallet.createRandom();
            const storageNode = createStorageNodeInputStruct(
                user.address, 
                "https://1",
                "us",
                "north america",
                1,
                -90,
                -180
            );
            const didAddress = Wallet.createRandom().address //signInfo.userAddress;

            it("Failed: Invalid didAddress", async () => {
                const invalidDIDAddresses = [
                    "",                         // Empty address
                    `did:vda:${didAddress}`     // DID
                ]
                for (let i = 0; i < 1; i++) {
                    const nodeInfo = createStorageNodeInputStruct(invalidDIDAddresses[i], "", "", "", 0, 0, 0);
                    try {
                        await contract.addNode(nodeInfo, "0x00", "0x00", "0x00");
                    } catch (err) {
                        expect(err.reason).to.equal('resolver or addr is not configured for ENS name');
                    }
                }
            })
            
            it("Failed: Empty endpoint uri", async () => {
                const nodeInfo = createStorageNodeInputStruct(didAddress, "", "", "", 0, 0, 0);
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
                        0);
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
                        0);

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
                        0);

                    await expect(
                        contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                    ).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");
                }
            })

            it("Failed: Invalid datacenterID - removed", async () => {
                const currentSnapshot = await takeSnapshot();

                await contract.removeDatacenter(datacenterIds[0]);

                const nodeInfo = createStorageNodeInputStruct(
                    didAddress,
                    "https://1",
                    "us",
                    "north america",
                    datacenterIds[0],
                    0,
                    0);

                await expect(
                    contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(contract, "InvalidDatacenterId");

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
                        0);
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
                        invalidLongValues[i]);
                    await expect(
                        contract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                    ).to.be.revertedWithCustomError(contract, "InvalidLongitude")
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

            it("Success", async () => {
                const nonce = await contract.nonce(user.address);

                const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

                const tx = await contract.addNode(storageNode, requestSignature, requestProof, authSignature);

                await expect(tx).to.emit(contract, "AddNode").withArgs(
                    storageNode.didAddress,
                    storageNode.endpointUri,
                    storageNode.countryCode,
                    storageNode.regionCode,
                    storageNode.datacenterId,
                    storageNode.lat,
                    storageNode.long,
                    anyValue
                );
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
                await checkRemoveNodeComplete(user);

                // Add success
                await checkAddNode(storageNode, user, trustedSigner, true);
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
                result: IStorageNodeRegistry.StorageNodeWithStatusStructOutput | IStorageNodeRegistry.StorageNodeStructOutput, 
                org: IStorageNodeRegistry.StorageNodeInputStruct, 
                status : "active" | "removed" = "active") => {
                expect(result.didAddress).to.equal(org.didAddress);
                expect(result.endpointUri).to.equal(org.endpointUri);
                expect(result.countryCode).to.equal(org.countryCode);
                expect(result.regionCode).to.equal(org.regionCode);
                expect(result.datacenterId).to.equal(org.datacenterId);
                expect(result.lat).to.equal(org.lat);
                expect(result.long).to.equal(org.long);
                if (result.status !== undefined) {
                    expect(result.status).to.equal(status); 
                }
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
                        long[i])
                    );
                }

                for (let i = 0; i < users.length; i++) {
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
                        const node = await contract.getNodeByAddress(users[i].address);
                        checkGetNodeResult(node, storageNodes[i]);
                    }
                })

                it("Success: pending removal state", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove start
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    await checkRemoveNodeStart(users[0], unregisterTime);

                    // Get by address
                    const node =  await contract.getNodeByAddress(users[0].address);
                    checkGetNodeResult(node, storageNodes[0], "removed");
                    
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
                        const node = await contract.getNodeByEndpoint(storageNodes[i].endpointUri);
                        checkGetNodeResult(node, storageNodes[i]);
                    }
                })

                it("Success: pending removal state", async () => {
                    const currentSnapshot = await takeSnapshot();

                    // Remove start
                    const blockTime = await time.latest();
                    const unregisterTime = blockTime + days(30);
                    await checkRemoveNodeStart(users[0], unregisterTime);

                    // Get by endpoint
                    const node = await contract.getNodeByEndpoint(storageNodes[0].endpointUri);
                    checkGetNodeResult(node, storageNodes[0], "removed");

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

        describe("Remove node", () => {
            const user = Wallet.createRandom();
            const storageNode = createStorageNodeInputStruct(
                user.address, 
                "https://1",
                "us",
                "north america",
                1,
                -90,
                -180
            );

            before(async () => {
                await snapShotWithDatacenters.restore();

                await contract.addTrustedSigner(trustedSigner.address);

                // Register a node
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
                it("Failed: Unregistered address", async () => {
                    const temp = Wallet.createRandom();

                    await expect(
                        contract.removeNodeComplete(temp.address, "0x00", "0x00")
                    ).to.be.revertedWithCustomError(contract, "InvalidDIDAddress");
                })

                it("Failed: removenode not started", async () => {
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

                    await checkRemoveNodeComplete(user);
                })
            })
        })
    });
  
});