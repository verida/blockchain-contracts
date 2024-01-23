/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, checkRemoveNodeComplete, checkRemoveNodeStart, createStorageNodeInputStruct, getAddNodeSignatures, getFallbackMigrationProof, getFallbackNodeInfo } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { HDNodeWallet, Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { IStorageNodeManagement, MockToken, VDADataCenterFacet, VDAStorageNodeFacet, VDAStorageNodeManagementFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, EnumStatus, INVALID_COUNTRY_CODES, INVALID_REGION_CODES, VALID_NUMBER_SLOTS } from "./utils/constant";
import { days, hours } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { LibStorageNode } from "../typechain-types/contracts/facets/VDAStorageNodeManagementFacet";

const { assert } = require('chai')

const trustedSigner = Wallet.createRandom();
const user = Wallet.createRandom();
const fallbackUser = Wallet.createRandom();
const storageNode = createStorageNodeInputStruct(
  ("node-" + user.address).toLowerCase(),
  user.address, 
  "https://1",
  "us",
  "north america",
  1,
  -90,
  -180,
  VALID_NUMBER_SLOTS,
  true
);
const fallbackNode = createStorageNodeInputStruct(
  "node-fallback",
  fallbackUser.address,
  "https://endpoint-fallback",
  "jp",
  "asia",
  1,
  -90,
  -180,
  VALID_NUMBER_SLOTS,
  true
);

describe('StorageNode Node Management Test', async function () {
  let diamondAddress: string
  let tokenAddress: string
  
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];

  let verificationContract: VDAVerificationFacet;
  let datacenterContract: VDADataCenterFacet;
  let nodeManageContract: VDAStorageNodeManagementFacet;
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
    } = await deploy(undefined, [
      'VDAVerificationFacet', 
      'VDADataCenterFacet', 
      'VDAStorageNodeManagementFacet',
      'VDAStorageNodeFacet'
    ]));

    verificationContract = await ethers.getContractAt("VDAVerificationFacet", diamondAddress);
    datacenterContract = await ethers.getContractAt("VDADataCenterFacet", diamondAddress)
    nodeManageContract = await ethers.getContractAt("VDAStorageNodeManagementFacet", diamondAddress);
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

    const checkDuplicatedValuesFailed = async () => {
      // Registerred name
      await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, false, "InvalidName");
      
      // Registered DID
      const newNode = {...storageNode};
      newNode.name = Wallet.createRandom().address.toLowerCase();
      await checkAddNode(nodeManageContract, newNode, user, trustedSigner, false, "InvalidDIDAddress");
      
      // Registered EndpointURI
      {
          const anotherUser = Wallet.createRandom();
          const nodeInfo = {...newNode};
          nodeInfo.didAddress = anotherUser.address;

          await checkAddNode(nodeManageContract, nodeInfo, anotherUser, trustedSigner, false, "InvalidEndpointUri");
      }
    }

    before(async () => {
        await snapShotWithDatacenters.restore();
    })

    describe("Failed for invalid arguments", () => {
      const validNodeName = "node";

      it("Failed: Invalid name",async () => {
        // Empty name
        let nodeInfo = createStorageNodeInputStruct("", didAddress, "", "", "", 0, 0, 0, 1, true);
        await expect(
          nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidName");

        // Upper-case letters
        nodeInfo = createStorageNodeInputStruct("Invalid Name", didAddress, "", "", "", 0, 0, 0, 1, true);
        await expect(
          nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidName");
      })

      it("Failed: Empty endpoint uri", async () => {
        const nodeInfo = createStorageNodeInputStruct(validNodeName, didAddress, "", "", "", 0, 0, 0, 1, true);
        await expect(
            nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidEndpointUri")
      })

      it("Failed: Invalid country codes", async () => {
        for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
          const nodeInfo = createStorageNodeInputStruct(
            validNodeName,
            didAddress,
            "https://1",
            INVALID_COUNTRY_CODES[i],
            "",
            0,
            0,
            0,
            1,
            true);
          await expect(
              nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidCountryCode");
        }
      })

      it("Failed: Invalid region codes", async () => {
        for (let i = 0; i < INVALID_REGION_CODES.length; i++) {
          const nodeInfo = createStorageNodeInputStruct(
            validNodeName,
            didAddress,
            "https://1",
            "us",
            INVALID_REGION_CODES[i],
            0,
            0,
            0,
            1,
            true);

          await expect(
              nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidRegionCode");
        }
      })

      it("Failed: Invalid datacenterID - unregistered", async () => {
        const invalidIds = [0n, maxDataCenterID + 1n, maxDataCenterID + 100n];
        for (let i = 0; i < invalidIds.length; i++) {
          const nodeInfo = createStorageNodeInputStruct(
            validNodeName,
            didAddress,
            "https://1",
            "us",
            "north america",
            invalidIds[i],
            0,
            0,
            1,
            true);

          await expect(
              nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidDataCenterId");
        }
      })

      it("Failed: Invalid datacenterID - removed", async () => {
        const currentSnapshot = await takeSnapshot();

        await datacenterContract.removeDataCenter(datacenterIds[0]);

        const nodeInfo = createStorageNodeInputStruct(
          validNodeName,
          didAddress,
          "https://1",
          "us",
          "north america",
          datacenterIds[0],
          0,
          0,
          1,
          true);

        await expect(
            nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidDataCenterId");

        await currentSnapshot.restore();
      })

      it("Failed: Invlaid Latitude",async () => {
        const invalidLatValues = [-90.05, -180, 91, 500];
        for (let i = 0; i < invalidLatValues.length; i++) {
          const nodeInfo = createStorageNodeInputStruct(
            validNodeName,
            didAddress,
            "https://1",
            "us",
            "north america",
            datacenterIds[0],
            invalidLatValues[i],
            0,
            1,
            true);
          await expect(
              nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidLatitude")
        }
      })

      it("Failed: Invalid Longitude",async () => {
        const invalidLongValues = [-180.1, -270, -400.2523, 181, 360, 500.235];
        for (let i = 0; i < invalidLongValues.length; i++) {
          const nodeInfo = createStorageNodeInputStruct(
            validNodeName,
            didAddress,
            "https://1",
            "us",
            "north america",
            datacenterIds[0],
            0,
            invalidLongValues[i],
            1,
            true);
          await expect(
              nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidLongitude")
        }
      })

      it("Failed: Invalid slotCount",async () => {
        const invalidSlots = [0, 100, 20001];
        for (let i = 0; i < invalidSlots.length; i++) {
          const nodeInfo = createStorageNodeInputStruct(
            validNodeName,
            didAddress,
            "https://1",
            "us",
            "north america",
            datacenterIds[0],
            0,
            0,
            invalidSlots[i],
            true);
          await expect(
            nodeManageContract.addNode(nodeInfo, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidSlotCount")
        }
          
      })

      it("Failed: No trusted signer",async () => {
        const nonce = await nodeManageContract.nonce(user.address);
        
        const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

        await expect(
            nodeManageContract.addNode(storageNode, requestSignature, requestProof, authSignature)
        ).to.be.revertedWithCustomError(nodeManageContract, "NoSigners");
      })

      it("Failed: Invalid auth signature",async () => {
          await verificationContract.addTrustedSigner(trustedSigner.address);

          const badSigner = Wallet.createRandom();

          const nonce = await nodeManageContract.nonce(user.address);

          const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, badSigner);

          await expect(
              nodeManageContract.addNode(storageNode, requestSignature, requestProof, authSignature)
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidSignature");
      })
    })

    describe("Test when the staking is not required", () => {
      before(async () => {
          await snapShotWithDatacenters.restore();
          await verificationContract.addTrustedSigner(trustedSigner.address);

          expect(await nodeContract.isStakingRequired()).to.be.eq(false);

          // Add fallback node
          await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);
      })

      it("Success", async () => {
          const requestorBeforeTokenAmount = await tokenContract.balanceOf(owner.address);
          // Add node
          await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

          const requestAfterTokenAmount = await tokenContract.balanceOf(owner.address);
          // Check token amount of requestor not changed
          expect(requestAfterTokenAmount).to.be.equal(requestorBeforeTokenAmount);
      })

      it("Failed: Duplicated `name`, `didAddress` & `endpointURI`", async () => {
        await checkDuplicatedValuesFailed();
      })

      it("Failed: `name`, `didAddress` & `endpointURI` in pending `removal` status", async () => {
        const currentSnapshot = await takeSnapshot();

        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Remove a node
        const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo);

        // Check remove started name, address, & endpoint
        await checkDuplicatedValuesFailed();

        await currentSnapshot.restore();
      })

      it("Failed: `name`, `didAddress` & `endpointURI` removed", async () => {
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);
        
        // Remove start
        const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo)

        // Remove complete
        await time.increaseTo(unregisterTime);
        await checkRemoveNodeComplete(nodeManageContract, user, fallbackUser, owner.address, owner);

        // Check remove completed name, address, & endpoint
        await checkDuplicatedValuesFailed();
      })
    })

    describe("Test when the staking is required", () => {
        before(async () => {
          await snapShotWithDatacenters.restore();
          await verificationContract.addTrustedSigner(trustedSigner.address);

          await expect(
              nodeContract.setStakingRequired(true)
          ).to.emit(nodeContract, "UpdateStakingRequired").withArgs(true);

          // Add fallback node
          await approveToken(BigInt(fallbackNode.slotCount), owner, diamondAddress, true);
          await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);
        })

        it("Failed: Token not allowed from requestor",async () => {
          const nonce = await nodeManageContract.nonce(user.address);

          const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

          await expect(
              nodeManageContract.addNode(storageNode, requestSignature, requestProof, authSignature)
          ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
        })

        it("Success", async () => {
            const stakeTokenAmount = await slotTokenAmount(BigInt(storageNode.slotCount))
            
            // Approve Token
            await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);

            const requestorBeforeTokenAmount = await tokenContract.balanceOf(owner.address);
            // Add node
            await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

            const requestAfterTokenAmount = await tokenContract.balanceOf(owner.address);
            // Check token amount updated
            expect(requestAfterTokenAmount).to.be.equal(requestorBeforeTokenAmount - stakeTokenAmount);
        })

        it("Failed: Duplicated `name`, `didAddress` & `endpointURI`", async () => {
          await checkDuplicatedValuesFailed();
        })

        it("Failed: `name`, `didAddress` & `endpointURI` in pending `removal` status", async () => {
          const currentSnapshot = await takeSnapshot();

          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);

          // Remove a node
          const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
          await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo);

          await checkDuplicatedValuesFailed();
          await currentSnapshot.restore();
        })

        it("Failed: `name`, `didAddress` & `endpointURI` removed", async () => {
          const blockTime = await time.latest();
          const unregisterTime = blockTime + days(30);
          
          // Remove start
          const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
          await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo)

          // Remove complete
          await time.increaseTo(unregisterTime);
          await checkRemoveNodeComplete(nodeManageContract, user, fallbackUser, owner.address, owner);

          await checkDuplicatedValuesFailed();
        })
    })
  })

  describe("Is registered data",async () => {
    before(async () => {
      await snapShotWithDatacenters.restore();
      await verificationContract.addTrustedSigner(trustedSigner.address);
      
      // Add node
      await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
      // Add fallback node
      await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);
    })

    it("Return false for unregistered data",async () => {
      expect(await nodeManageContract.isRegisteredNodeName("unregistered name")).to.be.equal(false);
      expect(await nodeManageContract.isRegisteredNodeAddress(Wallet.createRandom().address)).to.be.equal(false);
      expect(await nodeManageContract.isRegisteredNodeEndpoint("https://unregistered-endpoint")).to.be.equal(false);
    })

    it("Return true for registered data",async () => {
      expect(await nodeManageContract.isRegisteredNodeName(storageNode.name)).to.be.equal(true);
      expect(await nodeManageContract.isRegisteredNodeAddress(storageNode.didAddress)).to.be.equal(true);
      expect(await nodeManageContract.isRegisteredNodeEndpoint(storageNode.endpointUri)).to.be.equal(true);
    })

    it("Return true for pending removal state",async () => {
      const blockTime = await time.latest();
      const unregisterTime = blockTime + days(30);
      const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
      await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo);

      expect(await nodeManageContract.isRegisteredNodeName(storageNode.name)).to.be.equal(true);
      expect(await nodeManageContract.isRegisteredNodeAddress(storageNode.didAddress)).to.be.equal(true);
      expect(await nodeManageContract.isRegisteredNodeEndpoint(storageNode.endpointUri)).to.be.equal(true);
    })

    it("Return true for remove completed",async () => {
      const blockTime = await time.latest();
      const unregisterTime = blockTime + days(30);
      // Remove complete
      await time.increaseTo(unregisterTime);
      await checkRemoveNodeComplete(nodeManageContract, user, fallbackUser, owner.address, owner);

      expect(await nodeManageContract.isRegisteredNodeName(storageNode.name)).to.be.equal(true);
      expect(await nodeManageContract.isRegisteredNodeAddress(storageNode.didAddress)).to.be.equal(true);
      expect(await nodeManageContract.isRegisteredNodeEndpoint(storageNode.endpointUri)).to.be.equal(true);
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

    let storageNodes : IStorageNodeManagement.StorageNodeInputStruct[] = [];

    let testEnvironment: SnapshotRestorer

    const checkGetNodeResult = (
        result: LibStorageNode.StorageNodeStructOutput, 
        org: IStorageNodeManagement.StorageNodeInputStruct, ) => {
        expect(result.name).to.equal(org.name);
        expect(result.didAddress).to.equal(org.didAddress);
        expect(result.endpointUri).to.equal(org.endpointUri);
        expect(result.countryCode).to.equal(org.countryCode);
        expect(result.regionCode).to.equal(org.regionCode);
        expect(result.datacenterId).to.equal(org.datacenterId);
        expect(result.lat).to.equal(org.lat);
        expect(result.long).to.equal(org.long);
        expect(result.slotCount).to.equal(org.slotCount);
        expect(result.acceptFallbackSlots).to.equal(org.acceptFallbackSlots);
    }

    const startRemove =async () => {
      const blockTime = await time.latest();
      const unregisterTime = blockTime + days(30);
      const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
      await checkRemoveNodeStart(nodeManageContract, users[0], unregisterTime, fallbackInfo); 
    }

    const completeRemove=async () => {
      const blockTime = await time.latest();
      const unregisterTime = blockTime + days(30);
      // Remove complete
      await time.increaseTo(unregisterTime);
      await checkRemoveNodeComplete(nodeManageContract, users[0], fallbackUser, owner.address, owner);
    }

    before(async () => {
      await snapShotWithDatacenters.restore();

      await verificationContract.addTrustedSigner(trustedSigner.address);

      for (let i = 0; i < users.length; i++) {
        storageNodes.push(createStorageNodeInputStruct(
          `node-${i+1}`,
          users[i].address,
          endpointURI[i],
          nodeCountry[i],
          nodeRegion[i],
          datacenterId[i],
          lat[i],
          long[i],
          VALID_NUMBER_SLOTS,
          true)
        );
      }

      for (let i = 0; i < users.length; i++) {
          await approveToken(1n, owner, diamondAddress, true);
          await checkAddNode(nodeManageContract, storageNodes[i], users[i], trustedSigner, true);
      }

      // Add fallback node
      await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);
      
      testEnvironment = await takeSnapshot();
    })
    
    describe("Get by Name", () => {
      it("Failed: Unregistered name",async () => {
        const randomName = Wallet.createRandom().address.toLowerCase();

        await expect(
          nodeManageContract.getNodeByName(randomName)
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidName");
      })

      it("Success",async () => {
        for (let i = 0; i < users.length; i++) {
          const result = await nodeManageContract.getNodeByName(storageNodes[i].name);
          checkGetNodeResult(result, storageNodes[i]);

          expect(result.status).to.equal(EnumStatus.active);
        }
      })

      it("Success: pending removal state",async () => {
        // Remove start
        await startRemove();
        
        const result =  await nodeManageContract.getNodeByName(storageNodes[0].name);
        checkGetNodeResult(result, storageNodes[0]);
        expect(result.status).to.equal(EnumStatus.removing);        
      })

      it("Success: remmove completed node",async () => {
        await completeRemove();
        const result =  await nodeManageContract.getNodeByName(storageNodes[0].name);
        checkGetNodeResult(result, storageNodes[0]);
        expect(result.status).to.equal(EnumStatus.removed);
      })

    })

    describe("Get by Address", () => {
      before(async () => {
        await testEnvironment.restore();
      })
      
      it("Failed: Unregistered address", async () => {
        const address = Wallet.createRandom().address;

        await expect(
            nodeManageContract.getNodeByAddress(address)
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidDIDAddress");
      })

      it("Success: status active", async () => {
        for (let i = 0; i < users.length; i++) {
          const result = await nodeManageContract.getNodeByAddress(users[i].address);
          checkGetNodeResult(result, storageNodes[i]);

          expect(result.status).to.equal(EnumStatus.active);
        }
      })

      it("Success: pending removal state", async () => {
        await startRemove();

        const result =  await nodeManageContract.getNodeByAddress(users[0].address);
        checkGetNodeResult(result, storageNodes[0]);
        expect(result.status).to.equal(EnumStatus.removing);
      })

      it("Success: remove completed node",async () => {
        await completeRemove();

        const result =  await nodeManageContract.getNodeByAddress(users[0].address);
        checkGetNodeResult(result, storageNodes[0]);
        expect(result.status).to.equal(EnumStatus.removed);
      })
    })

    describe("Get by Endpoint", () => {
      before(async () => {
        await testEnvironment.restore();
      })
      
      it("Failed: Unregistered endpoint", async () => {
        const unregisteredEndpoint = "https://unregistered"

        await expect(
          nodeManageContract.getNodeByEndpoint(unregisteredEndpoint)
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidEndpointUri");
      })

      it("Success : status active", async () => {
        for (let i = 0; i < users.length; i++) {
          const result = await nodeManageContract.getNodeByEndpoint(storageNodes[i].endpointUri);
          checkGetNodeResult(result, storageNodes[i]);
          expect(result.status).to.equal(EnumStatus.active);
        }
      })

      it("Success: pending removal state", async () => {
        await startRemove();
        
        const result = await nodeManageContract.getNodeByEndpoint(storageNodes[0].endpointUri);
        checkGetNodeResult(result, storageNodes[0]);
        expect(result.status).to.equal(EnumStatus.removing);
      })

      it("Success : removed state",async () => {
        await completeRemove();

        const result = await nodeManageContract.getNodeByEndpoint(storageNodes[0].endpointUri);
        checkGetNodeResult(result, storageNodes[0]);
        expect(result.status).to.equal(EnumStatus.removed);
      })
    })

    describe("Get by Country", () => {
      before(async()=> {
        await testEnvironment.restore();
      })

      it("Return empty array for unregistered country", async () => {
        const unregistedCode = "sg";
        assert(storageNodes.findIndex(item => item.countryCode === unregistedCode) === -1);

        expect(await nodeManageContract.getNodesByCountry(unregistedCode)).to.deep.equal([]);
      })

      it("Success: without status option", async () => {
        const allCountryCodes = storageNodes.map(item => item.countryCode);
        const countryCodes = [...new Set(allCountryCodes)]

        for (let i = 0; i < countryCodes.length; i++ ){
          const orgCountryNodes = storageNodes.filter(item => item.countryCode === countryCodes[i])
          const nodesReturned = await nodeManageContract.getNodesByCountry(countryCodes[i]);
          expect(orgCountryNodes.length).to.equal(nodesReturned.length);
  
          for (let j = 0; j < orgCountryNodes.length; j++) {
              checkGetNodeResult(nodesReturned[j], orgCountryNodes[j]);
          }
        }
      })

      it("Success: pending removal state",async () => {
        const country = storageNodes[0].countryCode;

        expect(
          (await nodeManageContract.getNodesByCountryAndStatus(country, EnumStatus.removing)).length
        ).to.eq(0);

        await startRemove();

        expect(
          (await nodeManageContract.getNodesByCountryAndStatus(country, EnumStatus.removing)).length
        ).to.eq(1);
      })

      it("Success: remove completed state",async () => {
        const country = storageNodes[0].countryCode;
        // Before complete remove
        /// 1 pending removal country
        expect(
          (await nodeManageContract.getNodesByCountryAndStatus(country, EnumStatus.removing)).length
        ).to.eq(1);
        /// No remove completed country
        expect(
          (await nodeManageContract.getNodesByCountryAndStatus(country, EnumStatus.removed)).length
        ).to.eq(0);

        await completeRemove();
        // After complete remove
        /// No pending removal country
        expect(
          (await nodeManageContract.getNodesByCountryAndStatus(country, EnumStatus.removing)).length
        ).to.eq(0);
        /// 1 remove completed country
        expect(
          (await nodeManageContract.getNodesByCountryAndStatus(country, EnumStatus.removed)).length
        ).to.eq(1);
      })
    })

    describe("Get by Region", () => {
      before(async()=> {
        await testEnvironment.restore();
      })

      it("Return empty array for unregistered region", async () => {
        const unregistedCode = "africa";
        assert(storageNodes.findIndex(item => item.regionCode === unregistedCode) === -1);

        expect(await nodeManageContract.getNodesByRegion(unregistedCode)).to.deep.equal([]);
      })

      it("Success: without status option", async () => {
        const allRegionCodes = storageNodes.map(item => item.regionCode);
        const regionCodes = [...new Set(allRegionCodes)]

        for (let i = 0; i < regionCodes.length; i++ ){
          const orgRegionNodes = storageNodes.filter(item => item.regionCode === regionCodes[i]);

          const nodesReturned = await nodeManageContract.getNodesByRegion(regionCodes[i]);

          expect(orgRegionNodes.length).to.equal(nodesReturned.length);

          for (let j = 0; j < orgRegionNodes.length; j++) {
              checkGetNodeResult(nodesReturned[j], orgRegionNodes[j]);
          }
        }
      })

      it("Success: pending removal state",async () => {
        const region = storageNodes[0].regionCode;

        expect(
          (await nodeManageContract.getNodesByRegionAndStatus(region, EnumStatus.removing)).length
        ).to.eq(0);

        await startRemove();

        expect(
          (await nodeManageContract.getNodesByRegionAndStatus(region, EnumStatus.removing)).length
        ).to.eq(1);
      })

      it("Success: remove completed state",async () => {
        const region = storageNodes[0].regionCode;
        // Before complete remove
        /// 1 pending removal region
        expect(
          (await nodeManageContract.getNodesByRegionAndStatus(region, EnumStatus.removing)).length
        ).to.eq(1);
        /// No remove completed region
        expect(
          (await nodeManageContract.getNodesByRegionAndStatus(region, EnumStatus.removed)).length
        ).to.eq(0);

        await completeRemove();
        // After complete remove
        /// No pending removal region
        expect(
          (await nodeManageContract.getNodesByRegionAndStatus(region, EnumStatus.removing)).length
        ).to.eq(0);
        /// 1 remove completed region
        expect(
          (await nodeManageContract.getNodesByRegionAndStatus(region, EnumStatus.removed)).length
        ).to.eq(1);
      })
    })
  })

  describe("Remove node", () => {
    const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
    const thirdUser = Wallet.createRandom();
    const thirdNode = createStorageNodeInputStruct(
      "node-fallback-1",
      thirdUser.address,
      "https://endpoint-fallback-1",
      "us",
      "north america",
      1,
      -89,
      -179,
      storageNode.slotCount,
      true
    );

    const startRemove =async (
      nodeUser: Wallet | HDNodeWallet,
      fallbackUser: Wallet | HDNodeWallet,
      fallbackNode: IStorageNodeManagement.StorageNodeInputStruct
    ) => {
      const blockTime = await time.latest();
      const unregisterTime = blockTime + days(30);

      const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);
      await checkRemoveNodeStart(nodeManageContract, nodeUser, unregisterTime, fallbackInfo);
    }

    // Remove node start works regardless of staking required status
    describe("Remove node start", () => {
      let beforeRemoveStartStatus: SnapshotRestorer

      before(async () => {
        await snapShotWithDatacenters.restore();
        await verificationContract.addTrustedSigner(trustedSigner.address);
        // Confirm that staking is not required
        expect(await nodeContract.isStakingRequired()).to.be.eq(false);
        // Add node
        await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
        beforeRemoveStartStatus = await takeSnapshot();
      })

      it("Failed: Invalid address - unregistered", async () => {
        const temp = Wallet.createRandom();

        await expect(
          nodeManageContract.removeNodeStart(temp.address, 0, fallbackInfo, "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidDIDAddress");
      })

      it("Failed: Invalid address - set as fallback of another node",async () => {
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Set current node as fallback of third node
        await checkAddNode(nodeManageContract, thirdNode, thirdUser, trustedSigner, true);
        await startRemove(thirdUser, user, storageNode);

        // Check remove node start
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidDIDAddress");
      })

      it("Failed: Invalid Unregister Time", async () => {
        await beforeRemoveStartStatus.restore();

        const blockTime = await time.latest();
        const invalidTimes = [0, blockTime, blockTime + days(10), blockTime + days(27)];

        for (let i = 0; i < invalidTimes.length; i++) {
          await expect(
            nodeManageContract.removeNodeStart(user.address, 0, fallbackInfo, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidUnregisterTime");
        }
      })

      it("Failed: Invalid fallback node - unregistered",async () => {
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        const temp = Wallet.createRandom();
        const fallbackInfo = getFallbackNodeInfo(temp, 0);
        await expect(
          nodeManageContract.removeNodeStart(user.address, unregisterTime, fallbackInfo, "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidFallbackNodeAddress");
      })

      it("Failed: Invalid fallback node - not acceptable fallback slots",async () => {
        // Add non acceptable fallback node
        const fallbackNode = createStorageNodeInputStruct(
          "node-fallback",
          fallbackUser.address,
          "https://endpoint-fallback",
          "us",
          "north america",
          1,
          -89,
          -179,
          storageNode.slotCount,
          false
        );
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);

        // Check remove node start
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);
        const fallbackInfo = getFallbackNodeInfo(fallbackUser, storageNode.slotCount);
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidFallbackNodeAddress")
      })

      it("Failed: Invalid fallback node - pending removal state",async () => {
        await beforeRemoveStartStatus.restore();

        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Add third node
        const thirdUser = Wallet.createRandom();
        const thirdNode = createStorageNodeInputStruct(
          "node-fallback-1",
          thirdUser.address,
          "https://endpoint-fallback-1",
          "us",
          "north america",
          1,
          -89,
          -179,
          storageNode.slotCount,
          true
        );
        await checkAddNode(nodeManageContract, thirdNode, thirdUser, trustedSigner, true);

        // Add fallback node
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);
        // Remove fallback node
        const thirdFallbackInfo = getFallbackNodeInfo(thirdUser, thirdNode.slotCount);
        await checkRemoveNodeStart(nodeManageContract, fallbackUser, unregisterTime, thirdFallbackInfo);

        // Check remove node
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidFallbackNodeAddress");
      })

      it("Failed: Invalid fallback node - set as fallback for another node",async () => {
        await beforeRemoveStartStatus.restore();

        // Set fallback node as fallback of third node
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner);
        await checkAddNode(nodeManageContract, thirdNode, thirdUser, trustedSigner);
        await startRemove(fallbackUser, thirdUser, thirdNode);
        
        // Check remove node
        const unregisterTime = (await time.latest()) + days(30);
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidFallbackNodeAddress");
      })

      it("Failed: Invalid available slot counts",async () => {
        await beforeRemoveStartStatus.restore();

        const minSlot = 100;
        await nodeContract.updateMinSlotCount(minSlot);

        // Check current node's slot count
        expect(storageNode.slotCount).to.gt(minSlot);

        const fallbackNode = createStorageNodeInputStruct(
          "node-fallback",
          fallbackUser.address,
          "https://endpoint-fallback",
          "us",
          "north america",
          1,
          -89,
          -179,
          minSlot,
          true
        );
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);

        // Call removeNodeStart
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Error : availableSlots is larger than the node's slotCount
        const availableSlots = minSlot + 100;
        const fallbackInfo = getFallbackNodeInfo(fallbackUser, availableSlots);
        await expect(
          nodeManageContract.removeNodeStart(user.address, unregisterTime, fallbackInfo, "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InvalidAvailableSlots");
      })

      it("Failed: Insufficient slot counts",async () => {
        await beforeRemoveStartStatus.restore();

        // Create insufficient fallback node
        const fallbackNode = createStorageNodeInputStruct(
          "node-fallback",
          fallbackUser.address,
          "https://endpoint-fallback",
          "us",
          "north america",
          1,
          -89,
          -179,
          storageNode.slotCount,
          true
        );
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);

        // Call removeNodeStart
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        const availableSlots = 1n;
        expect(availableSlots).to.lt(storageNode.slotCount);
        const fallbackInfo = getFallbackNodeInfo(fallbackUser, availableSlots);
        await expect(
          nodeManageContract.removeNodeStart(user.address, unregisterTime, fallbackInfo, "0x00", "0x00")
        ).to.be.revertedWithCustomError(nodeManageContract, "InsufficientFallbackSlots");
      })

      it("Failed: Invalid fallback proof time",async () => {
        await beforeRemoveStartStatus.restore();

        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Add fallback node
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);

        await time.increaseTo(blockTime + hours(1));
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidFallbackNodeProofTime");
      })

      it("Invalid Fallback Signature",async () => {
        await beforeRemoveStartStatus.restore();

        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Add falback node
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);

        // Get fallback signature by invalid signer
        const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount, Wallet.createRandom());
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidFallbackNodeSiganture");

        // Check for empty fallback signature
        fallbackInfo.availableSlotsProof = "0x";
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidFallbackNodeSiganture");          
      })

      it("Success", async () => {
        await beforeRemoveStartStatus.restore();

        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);

        // Add fallback node
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner, true);

        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo);
      })

      it("Failed: pending removal state",async () => {
        const blockTime = await time.latest();
        const unregisterTime = blockTime + days(30);
        await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo, false, "InvalidDIDAddress");
      })
    })

    describe("Remove node complete", () => {
      const checkRemoveComplete =async (requestor: SignerWithAddress, stakeRequired = false) => {
        const fundReceiver = Wallet.createRandom();
        const stakedTokenAmount = stakeRequired===true ? await nodeContract.getBalance(user.address) : 0n;

        // complete remove node
        await checkRemoveNodeComplete(nodeManageContract, user, fallbackUser, fundReceiver.address, requestor);

        // Confirm fund released
        expect(
          await tokenContract.balanceOf(fundReceiver.address)
        ).to.be.equal(stakedTokenAmount);
      }

      before(async () => {
        await snapShotWithDatacenters.restore();
        await verificationContract.addTrustedSigner(trustedSigner.address);

        // Confirm that staking is not required
        expect(await nodeContract.isStakingRequired()).to.be.eq(false);
        // Add node
        await checkAddNode(nodeManageContract, storageNode, user, trustedSigner);
        // Add fallback node
        await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner)
      })

      describe("Failed for invalid parameters", () => {
        const fundReceiver = Wallet.createRandom();
        it("Failed: Unregistered address", async () => {
          const temp = Wallet.createRandom();
          await expect(
            nodeManageContract.removeNodeComplete(temp.address, fundReceiver.address, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidDIDAddress");
        })

        it("Failed: Remove node not started", async () => {
          await expect(
            nodeManageContract.removeNodeComplete(user.address, fundReceiver.address, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidDIDAddress");
        })

        it("Failed: Before remove time", async () => {
          const currentSnapshot = await takeSnapshot();

          // Remove node start
          await startRemove(user, fallbackUser, fallbackNode);
          
          // Remove node not completed
          await expect(
            nodeManageContract.removeNodeComplete(user.address, fundReceiver.address, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidUnregisterTime")

          const blockTime = await time.latest();
          // After 10 days from start
          await time.increaseTo(blockTime + days(10));
          await expect(
            nodeManageContract.removeNodeComplete(user.address, fundReceiver.address, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidUnregisterTime")

          // After 20 days from start
          await time.increaseTo(blockTime + days(20));
          await expect(
            nodeManageContract.removeNodeComplete(user.address, fundReceiver.address, "0x00", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidUnregisterTime")

          await currentSnapshot.restore();
        })

        it("Failed : Invalid migration proof",async () => {
          const currentSnapShot = await takeSnapshot();
          // Remove node start
          await startRemove(user, fallbackUser, fallbackNode);

          // After 31 days
          const blockTime = await time.latest();
          await time.increaseTo(blockTime + days(31));

          // Empty migration proof
          await expect(
            nodeManageContract.removeNodeComplete(user.address, fundReceiver.address, "0x", "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidFallbackNodeSiganture")

          // Invalid migration proof
          const invalid_migration = getFallbackMigrationProof(user.address, fallbackUser.address, Wallet.createRandom());
          await expect(
            nodeManageContract.removeNodeComplete(user.address, fundReceiver.address, invalid_migration, "0x00", "0x00")
          ).to.be.revertedWithCustomError(nodeManageContract, "InvalidFallbackNodeSiganture")

          await currentSnapShot.restore();
        })
      })

      describe("Test when staking require not enabled", () => {
        let snapShotRemoveStarted: SnapshotRestorer;

        it("Success", async () => {
          // Remove node start
          await startRemove(user, fallbackUser, fallbackNode);

          // After 31 days
          const blockTime = await time.latest();
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

      describe("Test when staking required", () => {
        let snapShotRemoveStarted: SnapshotRestorer;

        before(async () => {
          await snapShotWithDatacenters.restore();
  
          await verificationContract.addTrustedSigner(trustedSigner.address);
          // Set staking as required
          await nodeContract.setStakingRequired(true);
  
          // Register a node
          await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
          await checkAddNode(nodeManageContract, storageNode, user, trustedSigner);

          // Add fallback node
          await approveToken(BigInt(fallbackNode.slotCount), owner, diamondAddress, true);
          await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner);
        })

        it("Success when STAKE_PER_SLOT has no changes", async () => {
          // Remove node start
          await startRemove(user, fallbackUser, fallbackNode);

          // After 31 days
          const blockTime = await time.latest();
          await time.increaseTo(blockTime + days(31));

          snapShotRemoveStarted = await takeSnapshot();

          await checkRemoveComplete(accounts[0], true);
        })

        it("Success when STAKE_PER_SLOT increased",async () => {
          await snapShotRemoveStarted.restore();

          // Increase STAKE_PER_SLOT
          let stakePerSlot = await nodeContract.getStakePerSlot();
          stakePerSlot = stakePerSlot + 10n;
          await nodeContract.updateStakePerSlot(stakePerSlot);

          await checkRemoveComplete(accounts[1], true);
        })

        it("Success when STAKE_PER_SLOT decreased",async () => {
          await snapShotRemoveStarted.restore();

          // Decrease STAKE_PER_SLOT
          let stakePerSlot = await nodeContract.getStakePerSlot();
          stakePerSlot = stakePerSlot - 10n;
          await nodeContract.updateStakePerSlot(stakePerSlot);

          // Confirm excess tokens
          expect(await nodeContract.excessTokenAmount(user.address)).to.not.eq(0);

          await checkRemoveComplete(accounts[2], true);
        })
      })
    })
  })
})
