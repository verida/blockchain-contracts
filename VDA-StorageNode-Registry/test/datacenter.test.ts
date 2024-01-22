/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, checkRemoveNodeComplete, checkRemoveNodeStart, createDatacenterStruct, createStorageNodeInputStruct, getFallbackNodeInfo } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { IDataCenter, MockToken, VDADataCenterFacet, VDAStorageNodeFacet, VDAStorageNodeManagementFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, EnumStatus, INVALID_COUNTRY_CODES, INVALID_REGION_CODES, VALID_NUMBER_SLOTS } from "./utils/constant";
import { LibDataCenter } from "../typechain-types/contracts/facets/VDADataCenterFacet";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { FacetCutAction, getSelectors } from "../scripts/libraries/diamond";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

describe('DataCenter Test', async function () {
  let diamondAddress: string
  let tokenAddress: string
  
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let contract: VDADataCenterFacet;

  const datacenterIds : bigint[] = []

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
    } = await deploy(undefined, ['VDADataCenterFacet', 'VDAStorageNodeFacet', 'VDAStorageNodeManagementFacet']));

    contract = await ethers.getContractAt("VDADataCenterFacet", diamondAddress)

  })

  describe("Add datacenter", () => {
    it("Failed : non-owner", async () => {
      await expect(contract
          .connect(accounts[0])
          .addDataCenter(DATA_CENTERS[0])
      ).to.be.revertedWithCustomError(contract, "NotContractOwner");
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
      for (let i = 0; i < DATA_CENTERS.length; i++) {
        const tx = await contract.addDataCenter(DATA_CENTERS[i])

        await expect(tx).to.emit(contract, "AddDataCenter");

        const transactionReceipt = await tx.wait();
        const events =await contract.queryFilter(contract.filters.AddDataCenter, transactionReceipt?.blockNumber, transactionReceipt?.blockNumber);
        if (events.length > 0) {
          datacenterIds.push(events[0].args[0])
        }
      }
    })

    it("Failed: Registered datacenter name", async () => {
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

    it("Failed: removed datacenter name", async () => {
      const currentSnapshot = await takeSnapshot();

      let tx = await contract.removeDataCenter(datacenterIds[0])
      await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], DATA_CENTERS[0].name);

      // Re register removed name
      await expect(
        contract.addDataCenter(DATA_CENTERS[0])
      ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");

      await currentSnapshot.restore();
    })
  })

  describe("Is datacenter name registered", () => {
    let currentSnapShot: SnapshotRestorer;
    const dataCenter = createDatacenterStruct("center-x", "us", "north america", -90, -150);

    before(async () => {
      currentSnapShot = await takeSnapshot();
    })
    after(async () => {
      await currentSnapShot.restore();
    })

    it("Return `False` for unregistered name",async () => {
        expect(await contract.isRegisteredDataCenterName(dataCenter.name)).to.be.eq(false);
    })

    it("Return `True` for registered name",async () => {
        // Add data center
        await expect(
            contract.addDataCenter(dataCenter)
        ).to.emit(contract, "AddDataCenter");

        expect(await contract.isRegisteredDataCenterName(dataCenter.name)).to.be.eq(true);
    })

    it("Return `True` for removed name",async () => {

        // Remove data center
        await expect(
            contract.removeDataCenterByName(dataCenter.name)
        ).to.emit(contract, "RemoveDataCenter");

        expect(await contract.isRegisteredDataCenterName(dataCenter.name)).to.be.eq(true);
    })
  })

  describe("Get datacenters", () => {
    const checkDatacenterResult = (result: LibDataCenter.DataCenterStructOutput, org: IDataCenter.DatacenterInputStruct) => {
      expect(result.name).to.equal(org.name);
      expect(result.countryCode).to.equal(org.countryCode);
      expect(result.regionCode).to.equal(org.regionCode);
      expect(result.lat).to.equal(org.lat);
      expect(result.long).to.equal(org.long);
    }

    describe("Get datacenters by names", () => {
      it("Failed : Unregistered name",async () => {
        await expect(
            contract.getDataCentersByName(["invalid name"])
        ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");

        await expect(
            contract.getDataCentersByName(["invalid name", DATA_CENTERS[0].name])
        ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");

        await expect(
            contract.getDataCentersByName([DATA_CENTERS[0].name, "invalid name"])
        ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName");
      })

      it("Success",async () => {
        const names = DATA_CENTERS.map(item => item.name);

        const result = await contract.getDataCentersByName(names);
        for (let i = 0; i < DATA_CENTERS.length; i++) {
            checkDatacenterResult(result[i], DATA_CENTERS[i]);
            expect(result[i].status).to.be.eq(EnumStatus.active);
        }
      })

      it("Success : Removed data center",async () => {
        const currentSnapshot = await takeSnapshot();

        await expect(
            contract.removeDataCenter(datacenterIds[0])
        ).to.emit(contract, "RemoveDataCenter");

        const result = await contract.getDataCentersByName([DATA_CENTERS[0].name]);
        expect(result.length === 1, "Returned a data center");
        checkDatacenterResult(result[0], DATA_CENTERS[0]);

        expect(result[0].status).to.be.eq(EnumStatus.removed);

        await currentSnapshot.restore();
      })
    })

    describe("Get datacenters by IDs", () => {
      let maxDataCenterID : bigint;
      before(async() => {
        maxDataCenterID = datacenterIds[datacenterIds.length -1];
      })

      it("Failed: Invalid IDs", async () => {
        let invalidIDs: bigint[] = [0n];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

        invalidIDs = [0n, maxDataCenterID + 1n];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

        invalidIDs = [0n, datacenterIds[0]];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

        invalidIDs = [datacenterIds[0], maxDataCenterID + 1n];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
      })

      it("Success",async () => {
        const result = await contract.getDataCenters(datacenterIds);
        for (let i = 0; i < DATA_CENTERS.length; i++) {
            checkDatacenterResult(result[i], DATA_CENTERS[i]);
            expect(result[i].status).to.be.eq(EnumStatus.active);
        }
      })

      it("Success: Removed datacenter ID", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove datacenter ID
        const tx = await contract.removeDataCenter(datacenterIds[0]);
        await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], DATA_CENTERS[0].name);

        const result = await contract.getDataCenters([datacenterIds[0]]);
        checkDatacenterResult(result[0], DATA_CENTERS[0]);
        expect(result[0].status).to.be.eq(EnumStatus.removed);

        await currentSnapshot.restore();
      })
    })

    describe("Get datacenters by country code", () => {
      describe("Get without status filter", () => {
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
          checkDatacenterResult(result[0], DATA_CENTERS[0]);
          checkDatacenterResult(result[1], DATA_CENTERS[2]);
  
          result = await contract.getDataCentersByCountry("uk");
          expect(result.length).to.equal(1);
          checkDatacenterResult(result[0], DATA_CENTERS[1]);
        })
  
        it("Should contain removed data centers", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacenters
          for (let i = 0; i < 2; i++) {
            await expect(
                contract.removeDataCenter(datacenterIds[i])
            ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], DATA_CENTERS[i].name);
          }
          
          // Check getDataCentersByCountry
          let result = await contract.getDataCentersByCountry("us");
          expect(result.length).to.equal(2);
          checkDatacenterResult(result[0], DATA_CENTERS[0]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
          checkDatacenterResult(result[1], DATA_CENTERS[2]);
          expect(result[1].status).to.be.eq(EnumStatus.active);
  
          result = await contract.getDataCentersByCountry("uk");
          expect(result.length).to.equal(1);
          checkDatacenterResult(result[0], DATA_CENTERS[1]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
  
          await currentSnapshot.restore();
        })
      })

      describe("Get with status filter", () => {
        it("Failed: Invalid country code", async () => {
          for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
              await expect(contract.getDataCentersByCountryAndStatus(INVALID_COUNTRY_CODES[i], EnumStatus.active)).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
              await expect(contract.getDataCentersByCountryAndStatus(INVALID_COUNTRY_CODES[i], EnumStatus.removed)).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
          }
        })
  
        it("Return empty array for unregistered counry codes", async () => {
          const unregisteredCountryCodes = ["at", "by", "sg"];
          for (let i = 0; i < unregisteredCountryCodes.length; i++) {
              expect(
                  await contract.getDataCentersByCountryAndStatus(unregisteredCountryCodes[i], EnumStatus.active)
              ).to.deep.equal([]);

              expect(
                await contract.getDataCentersByCountryAndStatus(unregisteredCountryCodes[i], EnumStatus.removed)
            ).to.deep.equal([]);
          }
        })
  
        it("Success", async () => {
          // 2 active data centers for "us"
          let result = await contract.getDataCentersByCountryAndStatus("us", EnumStatus.active);
          expect(result.length).to.equal(2);
          checkDatacenterResult(result[0], DATA_CENTERS[0]);
          checkDatacenterResult(result[1], DATA_CENTERS[2]);
          // No removed data centers for "us"
          result = await contract.getDataCentersByCountryAndStatus("us", EnumStatus.removed);
          expect(result.length).to.equal(0);
  
          // 1 active data cetner for "uk"
          result = await contract.getDataCentersByCountryAndStatus("uk", EnumStatus.active);
          expect(result.length).to.equal(1);
          checkDatacenterResult(result[0], DATA_CENTERS[1]);
          // No removed data centers for "uk"
          result = await contract.getDataCentersByCountryAndStatus("uk", EnumStatus.removed);
          expect(result.length).to.equal(0);
        })
  
        it("Success with removed data centers", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacenters, Remove one data center from "us" and "uk"
          for (let i = 0; i < 2; i++) {
            await expect(
                contract.removeDataCenter(datacenterIds[i])
            ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], DATA_CENTERS[i].name);
          }
          
          // Check getDataCentersByCountry
          // 1 active and 1 removed for "us"
          expect((await contract.getDataCentersByCountryAndStatus("us", EnumStatus.active)).length).to.equal(1);
          expect((await contract.getDataCentersByCountryAndStatus("us", EnumStatus.removed)).length).to.equal(1);
          
          // 0 active and 1 removed for "uk"
          expect((await contract.getDataCentersByCountryAndStatus("uk", EnumStatus.active)).length).to.equal(0);
          expect((await contract.getDataCentersByCountryAndStatus("uk", EnumStatus.removed)).length).to.equal(1);

          await currentSnapshot.restore();
        })
      })
    })
    
    describe("Get datacenters by region code", () => {
      describe("Get without status filter", () => {
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
          checkDatacenterResult(result[0], DATA_CENTERS[0]);
          checkDatacenterResult(result[1], DATA_CENTERS[2]);
  
          result = await contract.getDataCentersByRegion("europe");
          expect(result.length).to.equal(1);
          checkDatacenterResult(result[0], DATA_CENTERS[1]);
        })
  
        it("Should contain removed data centers", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacenter IDs
          for (let i = 0; i < 2; i++) {
              await expect(
                  contract.removeDataCenter(datacenterIds[i])
              ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], DATA_CENTERS[i].name);
          }
          
          // Check getDataCentersByCountry
          let result = await contract.getDataCentersByRegion("north america");
          expect(result.length).to.equal(2);
          checkDatacenterResult(result[0], DATA_CENTERS[0]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
          checkDatacenterResult(result[1], DATA_CENTERS[2]);
          expect(result[1].status).to.be.eq(EnumStatus.active);
  
          result = await contract.getDataCentersByRegion("europe");
          expect(result.length).to.equal(1);
          checkDatacenterResult(result[0], DATA_CENTERS[1]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
  
          await currentSnapshot.restore();
        })
      })

      describe("Get with status filter", () => {
        it("Failed: Invalid region code", async () => {
            await expect(contract.getDataCentersByRegionAndStatus("", EnumStatus.active)).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
            await expect(contract.getDataCentersByRegionAndStatus("", EnumStatus.removed)).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
        })
  
        it("Return empty arry for unregistered region codes", async () => {
          const unregisteredRegionCodes = ["asia", "africa"];
          for (let i = 0; i < unregisteredRegionCodes.length; i++) {
              expect(await contract.getDataCentersByRegionAndStatus(unregisteredRegionCodes[i], EnumStatus.active)).to.deep.equal([]);
              expect(await contract.getDataCentersByRegionAndStatus(unregisteredRegionCodes[i], EnumStatus.removed)).to.deep.equal([]);
          }
        })
  
        it("Success", async () => {
          // 2 active data centers for "north america"
          let result = await contract.getDataCentersByRegionAndStatus("north america", EnumStatus.active);
          expect(result.length).to.equal(2);
          checkDatacenterResult(result[0], DATA_CENTERS[0]);
          checkDatacenterResult(result[1], DATA_CENTERS[2]);
          // no removed data center for "north america"
          result = await contract.getDataCentersByRegionAndStatus("north america", EnumStatus.removed);
          expect(result.length).to.equal(0);
          
          // 1 active data center for "europe"
          result = await contract.getDataCentersByRegionAndStatus("europe", EnumStatus.active);
          expect(result.length).to.equal(1);
          checkDatacenterResult(result[0], DATA_CENTERS[1]);
          // no removed data center for "europe"
          result = await contract.getDataCentersByRegionAndStatus("europe", EnumStatus.removed);
          expect(result.length).to.equal(0);
        })
  
        it("Success with removed data centers", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacenter IDs, remove one data center from "north america" and "europe"
          for (let i = 0; i < 2; i++) {
              await expect(
                  contract.removeDataCenter(datacenterIds[i])
              ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], DATA_CENTERS[i].name);
          }
          
          // 1 active data center and 1 removed data center for "north america"
          expect((await contract.getDataCentersByRegionAndStatus("north america", EnumStatus.active)).length).to.equal(1);
          expect((await contract.getDataCentersByRegionAndStatus("north america", EnumStatus.removed)).length).to.equal(1);
          
          // no active data center and 1 removed data center for "europe"
          expect((await contract.getDataCentersByRegionAndStatus("europe", EnumStatus.active)).length).to.equal(0);
          expect((await contract.getDataCentersByRegionAndStatus("europe", EnumStatus.removed)).length).to.equal(1);

          await currentSnapshot.restore();
        })
      })
    })
  })

  describe("Remove datacenter", () => {
    let maxDataCenterID : bigint;
    let currentSnapShot : SnapshotRestorer;

    const trustedSigner = Wallet.createRandom();
    const user = Wallet.createRandom();
    const fallbackUser = Wallet.createRandom();
    const storageNode = createStorageNodeInputStruct(
      "node-1",
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
      3, // Must be different from the datacenterID of storage Node to test removeDataCenter
      -90,
      -180,
      VALID_NUMBER_SLOTS,
      true
    );
    const fallbackInfo = getFallbackNodeInfo(fallbackUser, fallbackNode.slotCount);

    let tokenContract: MockToken;
    let nodeContract: VDAStorageNodeFacet;
    let nodeManageContract: VDAStorageNodeManagementFacet;

    const approveToken =async (numberSlot: bigint, from: SignerWithAddress, to: string, isMinting = false) => {
      const stakePerSlot = await nodeContract.getStakePerSlot();
      const tokenAmount = stakePerSlot * numberSlot;
      if (isMinting) {
          await tokenContract.mint(from.address, tokenAmount);
      }
      await tokenContract.connect(from).approve(to, tokenAmount);
    }

    const completeRemove=async () => {
      // Add fallback node
      await checkAddNode(nodeManageContract, fallbackNode, fallbackUser, trustedSigner)
      
      const blockTime = await time.latest();
      const unregisterTime = blockTime + days(30);
      // Remove Start
      await checkRemoveNodeStart(nodeManageContract, user, unregisterTime, fallbackInfo); 
      // Remove complete
      await time.increaseTo(unregisterTime);
      await checkRemoveNodeComplete(nodeManageContract, user, fallbackUser, owner.address, owner);
    }

    before(async () => {
      // Add VerificationContractFacet to add a storage node
      const contract = await ethers.deployContract("VDAVerificationFacet");
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      const selectors = getSelectors(contract).get(['addTrustedSigner']);
      
      const diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", diamondAddress);
      const tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        ethers.ZeroAddress, '0x'
      );
      const receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }

      const verifyContract = await ethers.getContractAt("VDAVerificationFacet", diamondAddress);
      await verifyContract.addTrustedSigner(trustedSigner.address);

      nodeContract = await ethers.getContractAt("VDAStorageNodeFacet", diamondAddress);
      nodeManageContract = await ethers.getContractAt("VDAStorageNodeManagementFacet", diamondAddress);
      tokenContract = await ethers.getContractAt("MockToken", tokenAddress);

      maxDataCenterID = datacenterIds[datacenterIds.length -1];

      
      currentSnapShot = await takeSnapshot();
    })

    describe("Remove by IDs", () => {
      it("Failed: Not created datacenterId", async () => {
          const invalidIds = [0n, maxDataCenterID + 1n, maxDataCenterID + 100n]

          for (let i = 0; i < invalidIds.length; i++) {
              await expect(
                  contract.removeDataCenter(invalidIds[i])
              ).to.be.revertedWithCustomError(contract, "InvalidDataCenterId").withArgs(invalidIds[i]);
          }
      })

      it("Success: Fresh datacenters that has no storage nodes added", async () => {
          const tx = await contract.removeDataCenter(datacenterIds[1]);

          await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[1], anyValue);
      })

      it("Failed: Removed datacenterId", async () => {
          await expect(
              contract.removeDataCenter(datacenterIds[1])
          ).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
      })

      it("Failed: Has depending nodes", async () => {
        // Add storage node 
        await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress);
        await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

        // Failed to remove datacenter
        await expect(contract.removeDataCenter(datacenterIds[0])).to.be.revertedWithCustomError(contract, "HasDependingNodes");
      })

      it("Success: After depending nodes are removed",async () => {
        await completeRemove();

        // Success to remove datacenter
        await expect(
            contract.removeDataCenter(datacenterIds[0])
        ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], anyValue);
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
          const tx = await contract.removeDataCenterByName(DATA_CENTERS[1].name);

          await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[1], DATA_CENTERS[1].name);
      })

      it("Failed: Removed datacenter", async () => {
          await expect(
              contract.removeDataCenterByName(DATA_CENTERS[1].name)
          ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName").withArgs(DATA_CENTERS[1].name);
      })

      it("Failed: Has depending nodes", async () => {
          // Add node
          await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress);
          await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
          
          // Failed to remove datacenter
          await expect(contract.removeDataCenterByName(DATA_CENTERS[0].name)).to.be.revertedWithCustomError(contract, "HasDependingNodes");
      })

      it("Success: After depending nodes are removed",async () => {
          // Remove complete
          await completeRemove();

          // Success to remove datacenter
          await expect(
              contract.removeDataCenterByName(DATA_CENTERS[0].name)
          ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], DATA_CENTERS[0].name);
      })
    })
  })
})
