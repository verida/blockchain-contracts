/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, checkRemoveNodeComplete, checkRemoveNodeStart, createStorageNodeInputStruct, getAddNodeSignatures, getWithdrawSignatures } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { IStorageNode, MockToken, VDADataCenterFacet, VDAStorageNodeFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, INVALID_COUNTRY_CODES, INVALID_REGION_CODES, VALID_NUMBER_SLOTS } from "./utils/constant";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { LibStorageNode } from "../typechain-types/contracts/facets/VDAStorageNodeFacet";

const { assert } = require('chai')

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

describe('DiamondTest', async function () {
  let diamondAddress: string
  let tokenAddress: string
  
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];

  let verificationContract: VDAVerificationFacet;
  let datacenterContract: VDADataCenterFacet;
  let nodeContract: VDAStorageNodeFacet;
  let tokenContract: MockToken;

  const datacenterIds : bigint[] = [];
  let maxDataCenterID : bigint;

  let snapShotWithDatacenters: SnapshotRestorer;

  const slotTokenAmount = async (numberSlot: bigint) : Promise<bigint> => {
    const stakePerSlot = await nodeContract.getStakePerSlot();
    let tokenAmount = stakePerSlot * numberSlot;
    return tokenAmount;
  }

  const approveToken =async (numberSlot: bigint, from: SignerWithAddress, to: string, isMinting = false) => {
    const tokenAmount = await slotTokenAmount(numberSlot);
    if (isMinting) {
        await tokenContract.mint(from.address, tokenAmount.toString());
    }
    await tokenContract.connect(from).approve(to, tokenAmount.toString());
  }

  const setNodeAddedStatus = async () => {
    await snapShotWithDatacenters.restore();
    await verificationContract.addTrustedSigner(trustedSigner.address);
    await nodeContract.setStakingRequired(true);
    await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
    await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);
  }

  before(async function () {
    const accountlist = await ethers.getSigners();
    owner = accountlist[0];

    accounts = [
      accountlist[1],
      accountlist[2],
      accountlist[3],
      accountlist[4]
    ];

    ({
      diamondAddress,
      tokenAddress
    } = await deploy(undefined, ['VDAVerificationFacet', 'VDADataCenterFacet', 'VDAStorageNodeFacet']));

    verificationContract = await ethers.getContractAt("VDAVerificationFacet", diamondAddress);
    datacenterContract = await ethers.getContractAt("VDADataCenterFacet", diamondAddress)
    nodeContract = await ethers.getContractAt("VDAStorageNodeFacet", diamondAddress);
    
    tokenContract = await ethers.getContractAt("MockToken", tokenAddress);

    // Add datacenters
    for (let i = 0; i < DATA_CENTERS.length; i++) {
        const tx = await datacenterContract.addDataCenter(DATA_CENTERS[i])

        const transactionReceipt = await tx.wait();
        const events = await datacenterContract.queryFilter(
          datacenterContract.filters.AddDataCenter,
          transactionReceipt?.blockNumber,
          transactionReceipt?.blockNumber
        );
        if (events.length > 0) {
          datacenterIds.push(events[0].args[0]);
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
        it("Failed: Empty endpoint uri", async () => {
            const nodeInfo = createStorageNodeInputStruct(didAddress, "", "", "", 0, 0, 0, 1);
            await expect(
                nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
            ).to.be.revertedWithCustomError(nodeContract, "InvalidEndpointUri")
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
                    nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(nodeContract, "InvalidCountryCode");
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
                    nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(nodeContract, "InvalidRegionCode");
            }
        })

        it("Failed: Invalid datacenterID - unregistered", async () => {
            const invalidIds = [0n, maxDataCenterID + 1n, maxDataCenterID + 100n];
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
                    nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(nodeContract, "InvalidDataCenterId");
            }
        })

        it("Failed: Invalid datacenterID - removed", async () => {
            const currentSnapshot = await takeSnapshot();

            await datacenterContract.removeDataCenter(datacenterIds[0]);

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
                nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
            ).to.be.revertedWithCustomError(nodeContract, "InvalidDataCenterId");

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
                    nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(nodeContract, "InvalidLatitude")
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
                    nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(nodeContract, "InvalidLongitude")
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
                    nodeContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
                ).to.be.revertedWithCustomError(nodeContract, "InvalidSlotCount")
            }
            
        })

        it("Failed: No trusted signer",async () => {
            const nonce = await nodeContract.nonce(user.address);
            
            const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

            await expect(
                nodeContract.addNode(storageNode, requestSignature, requestProof, authSignature)
            ).to.be.revertedWithCustomError(nodeContract, "NoSigners");
        })

        it("Failed: Invalid auth signature",async () => {
            await verificationContract.addTrustedSigner(trustedSigner.address);

            const badSigner = Wallet.createRandom();

            const nonce = await nodeContract.nonce(user.address);

            const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, badSigner);

            await expect(
                nodeContract.addNode(storageNode, requestSignature, requestProof, authSignature)
            ).to.be.revertedWithCustomError(nodeContract, "InvalidSignature");
        })
    })

    describe("Test when the staking is not required", () => {
        before(async () => {
            await snapShotWithDatacenters.restore();
            await verificationContract.addTrustedSigner(trustedSigner.address);

            expect(await nodeContract.isStakingRequired()).to.be.eq(false);
        })

        it("Success", async () => {
            const requestorBeforeTokenAmount = await tokenContract.balanceOf(owner.address);
            // Add node
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);

            const requestAfterTokenAmount = await tokenContract.balanceOf(owner.address);
            // Check token amount of requestor not changed
            expect(requestAfterTokenAmount).to.be.equal(requestorBeforeTokenAmount);
        })

        it("Failed: Duplicated `didAddress` & `endpointURI`", async () => {
            // Registered DID
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, false, "InvalidDIDAddress");
            
            // Registered EndpointURI
            {
                const anotherUser = Wallet.createRandom();

                const nodeInfo = {...storageNode};
                nodeInfo.didAddress = anotherUser.address;

                await checkAddNode(nodeContract, nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
            }

        })

        it("Failed: didAddress & endpointURI in pending `removal` status", async () => {
            const currentSnapshot = await takeSnapshot();

            const blockTime = await time.latest();
            const unregisterTime = blockTime + days(30);

            // Remove a node
            await checkRemoveNodeStart(nodeContract, user, unregisterTime);
            
            // Failed to add for didAddress in pending removal state
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, false, "InvalidDIDAddress");
            
            // Failed to add for endpoint in pending removal state
            {
                const anotherUser = Wallet.createRandom();

                const nodeInfo = {...storageNode};
                nodeInfo.didAddress = anotherUser.address;

                await checkAddNode(nodeContract, nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
            }
            await currentSnapshot.restore();
        })

        it("Success: For remove completed didAddress & endpointURI", async () => {
            const blockTime = await time.latest();
            const unregisterTime = blockTime + days(30);
            
            // Remove start
            await checkRemoveNodeStart(nodeContract, user, unregisterTime)

            // Remove complete
            await time.increaseTo(unregisterTime);
            await checkRemoveNodeComplete(nodeContract, user, owner);

            // Add success
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);
        })
    })

    describe("Test when the staking is required", () => {
        before(async () => {
            await snapShotWithDatacenters.restore();
            await verificationContract.addTrustedSigner(trustedSigner.address);

            await expect(
                nodeContract.setStakingRequired(true)
            ).to.emit(nodeContract, "UpdateStakingRequired").withArgs(true);
        })

        it("Failed: Token not allowed from requestor",async () => {
            const nonce = await nodeContract.nonce(user.address);

            const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

            await expect(
                nodeContract.addNode(storageNode, requestSignature, requestProof, authSignature)
            ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
        })

        it("Success", async () => {
            const stakeTokenAmount = await slotTokenAmount(BigInt(storageNode.slotCount))
            
            // Approve Token
            await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);

            const requestorBeforeTokenAmount = await tokenContract.balanceOf(owner.address);
            // Add node
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);

            const requestAfterTokenAmount = await tokenContract.balanceOf(owner.address);
            // Check token amount updated
            expect(requestAfterTokenAmount).to.be.equal(requestorBeforeTokenAmount - stakeTokenAmount);
        })

        it("Failed: Duplicated `didAddress` & `endpointURI`", async () => {
            // Registered DID
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, false, "InvalidDIDAddress");
            
            // Registered EndpointURI
            {
                const anotherUser = Wallet.createRandom();

                const nodeInfo = {...storageNode};
                nodeInfo.didAddress = anotherUser.address;

                await checkAddNode(nodeContract, nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
            }

        })

        it("Failed: didAddress & endpointURI in pending `removal` status", async () => {
            const currentSnapshot = await takeSnapshot();

            const blockTime = await time.latest();
            const unregisterTime = blockTime + days(30);

            // Remove a node
            await checkRemoveNodeStart(nodeContract, user, unregisterTime);
            
            // Failed to add for didAddress in pending removal state
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, false, "InvalidDIDAddress");
            
            // Failed to add for endpoint in pending removal state
            {
                const anotherUser = Wallet.createRandom();

                const nodeInfo = {...storageNode};
                nodeInfo.didAddress = anotherUser.address;

                await checkAddNode(nodeContract, nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
            }
            await currentSnapshot.restore();
        })

        it("Success: For remove completed didAddress & endpointURI", async () => {
            const blockTime = await time.latest();
            const unregisterTime = blockTime + days(30);
            
            // Remove start
            await checkRemoveNodeStart(nodeContract, user, unregisterTime)

            // Remove complete
            await time.increaseTo(unregisterTime);
            await checkRemoveNodeComplete(nodeContract, user, owner);

            // Approve Token
            await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress);

            // Add success
            await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);
        })
    })
  })

  describe("Update STAKE_PER_SLOT", () => {
    const STAKE_PER_SLOT = (10n^18n) * 100n;
    it("Failed: Only contract owner allowed",async () => {
        await expect(
            nodeContract.connect(accounts[1]).updateStakePerSlot(STAKE_PER_SLOT)
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
    })

    it("Failed: 0 not available",async () => {
        await expect(
          nodeContract.updateStakePerSlot(0)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue")
    })

    it("Failed: Same value",async () => {
        const stakePerSlot = await nodeContract.getStakePerSlot();

        await expect(
          nodeContract.updateStakePerSlot(stakePerSlot)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue")
    })

    it("Success",async () => {
        await expect(
          nodeContract.updateStakePerSlot(STAKE_PER_SLOT)
        ).to.emit(nodeContract, "UpdateStakePerSlot").withArgs(STAKE_PER_SLOT);
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

    let storageNodes : IStorageNode.StorageNodeInputStruct[] = [];

    const checkGetNodeResult = (
        result: LibStorageNode.StorageNodeStructOutput, 
        org: IStorageNode.StorageNodeInputStruct, ) => {
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

      await verificationContract.addTrustedSigner(trustedSigner.address);

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
          await approveToken(1n, owner, diamondAddress, true);
          await checkAddNode(nodeContract, storageNodes[i], users[i], trustedSigner, true);
      }
    })

    describe("Get by Address", () => {
      it("Failed: Unregistered address", async () => {
        const address = Wallet.createRandom().address;

        await expect(
            nodeContract.getNodeByAddress(address)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
      })

      it("Success: status active", async () => {
        for (let i = 0; i < users.length; i++) {
          const result = await nodeContract.getNodeByAddress(users[i].address);
          checkGetNodeResult(result[0], storageNodes[i]);

          expect(result[1]).to.equal("active");
        }
      })

      it("Success: pending removal state", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove start
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);
        await checkRemoveNodeStart(nodeContract, users[0], unregisterTime);

        // Get by address
        const result =  await nodeContract.getNodeByAddress(users[0].address);
        checkGetNodeResult(result[0], storageNodes[0]);

        expect(result[1]).to.equal("removed");
        
        await currentSnapshot.restore();
      })
    })

    describe("Get by Endpoint", () => {
      it("Failed: Unregistered endpoint", async () => {
        const unregisteredEndpoint = "https://unregistered"

        await expect(
          nodeContract.getNodeByEndpoint(unregisteredEndpoint)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidEndpointUri");
      })

      it("Success : status active", async () => {
        for (let i = 0; i < users.length; i++) {
          const result = await nodeContract.getNodeByEndpoint(storageNodes[i].endpointUri);
          checkGetNodeResult(result[0], storageNodes[i]);
          expect(result[1]).to.equal("active");
        }
      })

      it("Success: pending removal state", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove start
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);
        await checkRemoveNodeStart(nodeContract, users[0], unregisterTime);

        // Get by endpoint
        const result = await nodeContract.getNodeByEndpoint(storageNodes[0].endpointUri);
        checkGetNodeResult(result[0], storageNodes[0]);
        expect(result[1]).to.equal("removed");

        await currentSnapshot.restore();
      })
    })

    describe("Get by Country", () => {
      it("Return empty array for unregistered country", async () => {
        const unregistedCode = "sg";
        assert(storageNodes.findIndex(item => item.countryCode === unregistedCode) === -1);

        expect(await nodeContract.getNodesByCountry(unregistedCode)).to.deep.equal([]);
      })

      it("Success", async () => {
        const allCountryCodes = storageNodes.map(item => item.countryCode);
        const countryCodes = [...new Set(allCountryCodes)]

        for (let i = 0; i < countryCodes.length; i++ ){
          const orgCountryNodes = storageNodes.filter(item => item.countryCode === countryCodes[i])

          const nodesReturned = await nodeContract.getNodesByCountry(countryCodes[i]);

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

        expect(await nodeContract.getNodesByRegion(unregistedCode)).to.deep.equal([]);
      })

      it("Success", async () => {
        const allRegionCodes = storageNodes.map(item => item.regionCode);
        const regionCodes = [...new Set(allRegionCodes)]

        for (let i = 0; i < regionCodes.length; i++ ){
          const orgRegionNodes = storageNodes.filter(item => item.regionCode === regionCodes[i]);

          const nodesReturned = await nodeContract.getNodesByRegion(regionCodes[i]);

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
      await verificationContract.addTrustedSigner(trustedSigner.address);
    })

    it("0 for unregistered DID addresses",async () => {
      expect(await nodeContract.getBalance(Wallet.createRandom().address)).to.be.eq(0);
    })

    it("0 when Staking is not required",async () => {
      const currentSnapshot = await takeSnapshot();
      
      await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);
      expect(await nodeContract.getBalance(user.address)).to.eq(0);

      await currentSnapshot.restore();
    })

    it("Success", async () => {
      // Set stakig as required
      await nodeContract.setStakingRequired(true);

      // Approve Token
      await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
      // Add node
      await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);

      expect(await nodeContract.getBalance(user.address)).to.not.eq(0);
    })
    
  })

  describe("Deposit", () => {
    let requestor : SignerWithAddress;

    before(async () => {
      requestor = accounts[1];

      await setNodeAddedStatus();

      // Mint 10000 tokens to the requestor
      await tokenContract.mint(requestor.address, BigInt("10000000000000000000000"));
    })

    it("Failed : unregistered DID", async () => {
      const randomDID = Wallet.createRandom().address;
      await expect(
        nodeContract.connect(requestor).depositToken(randomDID, 1)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
    })

    it("Failed : token not approved", async () => {
      await expect(
        nodeContract.connect(requestor).depositToken(user.address, 100)
      ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
    })

    it("Success", async () => {
      const depositAmount = 100;
      // Approve token
      await tokenContract.connect(requestor).approve(diamondAddress, depositAmount);

      // Deposit
      await expect(
          nodeContract.connect(requestor).depositToken(user.address, depositAmount)
      ).to.emit(nodeContract, "TokenDeposited").withArgs(
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
      expect(await nodeContract.isStakingRequired()).to.be.eq(false);

      await expect(
        nodeContract.setStakingRequired(true)
      ).to.emit(nodeContract, "UpdateStakingRequired").withArgs(true);

      expect(await nodeContract.isStakingRequired()).to.be.eq(true);
    })
  })

  describe("Slot count range", () => {
    let min : bigint
    let max : bigint
    before(async () => {
      [min, max] = await nodeContract.getSlotCountRange();
    })

    describe("Update mininum slot count", () => {
      it("Failed : 0 is not available",async () => {
        await expect(
          nodeContract.updateMinSlotCount(0)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Current value is not available",async () => {
        await expect(
          nodeContract.updateMinSlotCount(min)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Value is bigger than maxSlots",async () => {
        await expect(
          nodeContract.updateMinSlotCount(max + 1n)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Success",async () => {
        await expect(
          nodeContract.updateMinSlotCount(min - 1n)
        ).to.emit(nodeContract, "UpdateMinSlotCount").withArgs(min- 1n);

        const [updateMin, updatedMax] = await nodeContract.getSlotCountRange();
        expect(updateMin).to.be.eq(min- 1n);
        expect(updatedMax).to.be.eq(max);

        // For maxSlots test
        min = updateMin;
      })
    })

    describe("Update maximum slot count", () => {
      it("Failed : 0 is not available",async () => {
        await expect(
            nodeContract.updateMaxSlotCount(0)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Current value is not available",async () => {
        await expect(
          nodeContract.updateMaxSlotCount(max)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Value is less than minSlots",async () => {
        await expect(
          nodeContract.updateMaxSlotCount(min - 1n)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Success",async () => {
        await expect(
          nodeContract.updateMaxSlotCount(max + 1n)
        ).to.emit(nodeContract, "UpdateMaxSlotCount").withArgs(max + 1n);

        const [updateMin, updatedMax] = await nodeContract.getSlotCountRange();
        expect(updateMin).to.be.eq(min);
        expect(updatedMax).to.be.eq(max + 1n);
      })
    })
  })

  describe("Excess token amount", () => {
    let CUR_STAKE_PER_SLOT: bigint;

    before(async () => {
      CUR_STAKE_PER_SLOT = await nodeContract.getStakePerSlot();
    })

    describe("Test when staking not required", () => {
      before(async () => {
        await snapShotWithDatacenters.restore();
        await verificationContract.addTrustedSigner(trustedSigner.address);
        
        expect(await nodeContract.isStakingRequired()).to.be.eq(false);
        await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);

        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0); 
      })

      it("No changes by STAKE_PER_SLOT change",async () => {
        // Decrease STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT - 1n);
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

        // Increase STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT + 1n);
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);
      })

      it("Negative value by set staking required",async () => {
        await nodeContract.setStakingRequired(true);
        expect(await nodeContract.excessTokenAmount(user.address)).to.lessThan(0);  
      })
    })

    describe("Test when staking required", () => {
      before(async () => {
        await setNodeAddedStatus();
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0); 
      })

      it("Positive value by set staking not required",async () => {
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

        await nodeContract.setStakingRequired(false);
        expect(await nodeContract.excessTokenAmount(user.address)).to.greaterThan(0);

        // Restore staking required
        await nodeContract.setStakingRequired(true);
      })

      it("Positive value by decreasing STAKE_PER_SLOT",async () => {
        // Decrease STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT - 1n);
        expect(await nodeContract.excessTokenAmount(user.address)).to.greaterThan(0);
      })

      it("Negative value by increasing STAKE_PER_SLOT",async () => {
        // Increase STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT + 1n);

        expect(await nodeContract.excessTokenAmount(user.address)).to.lessThan(0);
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
      const nonce = await nodeContract.nonce(user.address);
      const amount = 10;

      expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

      const {requestSignature, requestProof} = getWithdrawSignatures(user, amount, nonce);
      await expect(
        nodeContract.withdraw(user.address, amount, requestSignature, requestProof)
      ).to.be.revertedWithCustomError(nodeContract, "NoExcessTokenAmount");
    })

    it("Failed : Amount is bigger than excess token amount",async () => {
      const currentSnapshot = await takeSnapshot();

      // Confirm current excess token amount is zero
      expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

      let stakePerSlot = await nodeContract.getStakePerSlot();
      // Decrease STAKE_PER_SLOT
      stakePerSlot = stakePerSlot - 10n;
      await nodeContract.updateStakePerSlot(stakePerSlot);

      // Confirm current excess token amount is not zero
      const excessTokenAmount = await nodeContract.excessTokenAmount(user.address);
      expect(excessTokenAmount).to.not.eq(0);

      const amount = excessTokenAmount + 10n;

      const nonce = await nodeContract.nonce(user.address);
      const {requestSignature, requestProof} = getWithdrawSignatures(user, amount, nonce);
      await expect(
        nodeContract.connect(requestor).withdraw(user.address, amount, requestSignature, requestProof)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidAmount");
      
      await currentSnapshot.restore();
    })

    it("Success",async () => {
      // Confirm current excess token amount is zero
      expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

      let stakePerSlot = await nodeContract.getStakePerSlot();
      // Decrease STAKE_PER_SLOT
      stakePerSlot = stakePerSlot - 10n;
      await nodeContract.updateStakePerSlot(stakePerSlot);

      // Confirm current excess token amount is not zero
      const excessTokenAmount = await nodeContract.excessTokenAmount(user.address);
      expect(excessTokenAmount).to.not.eq(0);

      const amount = excessTokenAmount;

      const orgRequestorTokenAmount = await tokenContract.balanceOf(requestor.address);

      // Withdraw
      const nonce = await nodeContract.nonce(user.address);
      const {requestSignature, requestProof} = getWithdrawSignatures(user, amount, nonce);
      await expect(
        nodeContract.connect(requestor).withdraw(user.address, amount, requestSignature, requestProof)
      ).to.emit(nodeContract, "TokenWithdrawn").withArgs(
        user.address,
        requestor.address,
        excessTokenAmount);
      
      // Check excess tokens are released to requestor
      const curRequestorTokenAmount = await tokenContract.balanceOf(requestor.address);
      expect(curRequestorTokenAmount).to.be.eq(orgRequestorTokenAmount + excessTokenAmount);
    })
  });

  describe("Remove node", () => {
    describe("Test when staking is not required", () => {
      before(async () => {
        await snapShotWithDatacenters.restore();

        await verificationContract.addTrustedSigner(trustedSigner.address);

        // Confirm that staking is not required
        expect(await nodeContract.isStakingRequired()).to.be.eq(false);
      
        await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);
      })

      describe("Remove node start", () => {
        it("Failed: Unregistered address", async () => {
          const temp = Wallet.createRandom();

          await expect(
            nodeContract.removeNodeStart(temp.address, 0, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
        })

        it("Failed: Invalid Unregister Time", async () => {
          const blockTime = await time.latest();
          const invalidTimes = [0, blockTime, blockTime + days(10), blockTime + days(27)];

          for (let i = 0; i < invalidTimes.length; i++) {
            await expect(
              nodeContract.removeNodeStart(user.address, 0, "0x00", "0x00")
            ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime");
          }
        })

        it("Success", async () => {
          const currentSnapshot = await takeSnapshot();

          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);
          await checkRemoveNodeStart(nodeContract, user, unregisterTime);
          
          await currentSnapshot.restore();
        })
      })

      describe("Remove node complete", () => {
        let snapShotRemoveStarted: SnapshotRestorer

        const checkRemoveComplete =async (requestor: SignerWithAddress) => {
          const requestorOrgTokenAmount = await tokenContract.balanceOf(requestor.address);

          // complete remove node
          await checkRemoveNodeComplete(nodeContract, user, requestor);

          // Confirm requstor token has not changed
          const requestorCurTokenAmount = await tokenContract.balanceOf(requestor.address);
          expect(requestorCurTokenAmount).to.be.equal(requestorOrgTokenAmount);
        }

        it("Failed: Unregistered address", async () => {
          const temp = Wallet.createRandom();
          await expect(
            nodeContract.removeNodeComplete(temp.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
        })

        it("Failed: Remove node not started", async () => {
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime");
        })

        it("Failed: Before remove time", async () => {
          const currentSnapshot = await takeSnapshot();

          // Remove node start
          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);

          await checkRemoveNodeStart(nodeContract, user, unregisterTime);

          // Remove node not completed
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime")

          // After 10 days from start
          await time.increaseTo(blockTime + days(10));
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime")

          // After 20 days from start
          await time.increaseTo(blockTime + days(20));
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime")

          await currentSnapshot.restore();
        })

        it("Success", async () => {
          // Remove node start
          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);
          await checkRemoveNodeStart(nodeContract, user, unregisterTime);

          // After 31 days
          await time.increaseTo(blockTime + days(31));

          snapShotRemoveStarted = await takeSnapshot();

          await checkRemoveComplete(accounts[0]);
        })  
        
        it("Success after stakingRequired is enabled", async () => {
          await snapShotRemoveStarted.restore();

          await nodeContract.setStakingRequired(true);

          await checkRemoveComplete(accounts[0]);
        })  
      })
    })

    describe("Test when staking is required", () => {
      before(async () => {
        await snapShotWithDatacenters.restore();

        await verificationContract.addTrustedSigner(trustedSigner.address);

        // Set staking as required
        await nodeContract.setStakingRequired(true);

        // Register a node
        await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
        await checkAddNode(nodeContract, storageNode, user, trustedSigner, true);
      })

      describe("Remove node start", () => {
        it("Failed: Unregistered address", async () => {
          const temp = Wallet.createRandom();

          await expect(
            nodeContract.removeNodeStart(temp.address, 0, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
        })

        it("Failed: Invalid Unregister Time", async () => {
          const blockTime = await time.latest();

          const invalidTimes = [0, blockTime, blockTime + days(10), blockTime + days(27)];

          for (let i = 0; i < invalidTimes.length; i++) {
              await expect(
                nodeContract.removeNodeStart(user.address, 0, "0x00", "0x00")
              ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime");
          }
        })

        it("Success", async () => {
          const currentSnapshot = await takeSnapshot();

          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);

          await checkRemoveNodeStart(nodeContract, user, unregisterTime);
          
          await currentSnapshot.restore();
        })
      })

      describe("Remove node complete", () => {
        let snapShotRemoveStarted: SnapshotRestorer

        const checkRemoveComplete =async (requestor: SignerWithAddress) => {
          const requestorOrgTokenAmount = await tokenContract.balanceOf(requestor.address);

          const stakedTokenAmount = await nodeContract.getBalance(user.address);

          // complete remove node
          await checkRemoveNodeComplete(nodeContract, user, requestor);

          // Confirm requstor received the staked token
          const requestorCurTokenAmount = await tokenContract.balanceOf(requestor.address);
          expect(requestorCurTokenAmount).to.be.equal(requestorOrgTokenAmount + stakedTokenAmount);
        }

        it("Failed: Unregistered address", async () => {
          const temp = Wallet.createRandom();

          await expect(
            nodeContract.removeNodeComplete(temp.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
        })

        it("Failed: Remove node not started", async () => {
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime");
        })

        it("Failed: Before remove time", async () => {
          const currentSnapshot = await takeSnapshot();

          // Remove node start
          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);

          await checkRemoveNodeStart(nodeContract, user, unregisterTime);

          // Remove node not completed
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime")

          // After 10 days from start
          await time.increaseTo(blockTime + days(10));
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime")

          // After 20 days from start
          await time.increaseTo(blockTime + days(20));
          await expect(
            nodeContract.removeNodeComplete(user.address, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeContract, "InvalidUnregisterTime")

          await currentSnapshot.restore();
        })

        it("Success when STAKE_PER_SLOT has no changes", async () => {
          // Remove node start
          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);
          await checkRemoveNodeStart(nodeContract, user, unregisterTime);

          // After 31 days
          await time.increaseTo(blockTime + days(31));

          snapShotRemoveStarted = await takeSnapshot();

          await checkRemoveComplete(accounts[0]);
        })

        it("Success when STAKE_PER_SLOT increased",async () => {
          await snapShotRemoveStarted.restore();

          // Increase STAKE_PER_SLOT
          let stakePerSlot = await nodeContract.getStakePerSlot();
          stakePerSlot = stakePerSlot + 10n;
          await nodeContract.updateStakePerSlot(stakePerSlot);

          await checkRemoveComplete(accounts[1]);
        })

        it("Success when STAKE_PER_SLOT decreased",async () => {
          await snapShotRemoveStarted.restore();

          // Decrease STAKE_PER_SLOT
          let stakePerSlot = await nodeContract.getStakePerSlot();
          stakePerSlot = stakePerSlot - 10n;
          await nodeContract.updateStakePerSlot(stakePerSlot);

          // Confirm excess tokens
          expect(await nodeContract.excessTokenAmount(user.address)).to.not.eq(0);

          await checkRemoveComplete(accounts[2]);
        })
      })
    })
  })
})