/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, checkRemoveNodeComplete, checkRemoveNodeStart, createDatacenterStruct, createStorageNodeInputStruct } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { IDataCenter, VDADataCenterFacet, VDAStorageNodeFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, INVALID_COUNTRY_CODES, INVALID_REGION_CODES, VALID_NUMBER_SLOTS } from "./utils/constant";
import { LibDataCenter } from "../typechain-types/contracts/facets/VDADataCenterFacet";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { FacetCutAction, getSelectors } from "../scripts/libraries/diamond";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

const { assert } = require('chai')

describe('DiamondTest', async function () {
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
    } = await deploy(undefined, ['VDADataCenterFacet', 'VDAStorageNodeFacet']));

    contract = await ethers.getContractAt("VDADataCenterFacet", diamondAddress)
  })

  /*
  it('should test function call', async () => {
    const datacenter = createDatacenterStruct("center-1", "us", "north america", -90, -150);

    const datacenterFacet = await ethers.getContractAt("VDADataCenterFacet", diamondAddress);
    
    const tx = await datacenterFacet.addDataCenter(datacenter);

    await expect(tx).to.emit(datacenterFacet, "AddDataCenter");
  })
  */

  // it.only("Node selector test",async () => {
  //   const nodeFacet = await ethers.deployContract("VDAStorageNodeFacet");
  //   const selectors = getSelectors(nodeFacet);
  //   console.log(selectors);
  // })

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
      await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], DATA_CENTERS[0].name);

      // Re register removed name
      tx = await contract.addDataCenter(DATA_CENTERS[0]);
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
    const checkDatacenterResult = (result: LibDataCenter.DatacenterStructOutput, org: IDataCenter.DatacenterInputStruct) => {
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
        const events = await contract.queryFilter(
          contract.filters.AddDataCenter,
          transactionReceipt?.blockNumber,
          transactionReceipt?.blockNumber
        );

        if (events.length > 0) {
          dataCenterId = events[0].args[0];
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
      let maxDataCenterID : bigint;
      before(() => {
          maxDataCenterID = datacenterIds[datacenterIds.length -1];
      })

      it("Failed: Invalid IDs", async () => {
        let invalidIDs: BigNumberish[] = [0n];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

        invalidIDs = [0n, maxDataCenterID + 1n];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

        invalidIDs = [0, datacenterIds[0]];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");

        invalidIDs = [datacenterIds[0], maxDataCenterID + 1n];
        await expect(contract.getDataCenters(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCenterId");
      })

      it("Success",async () => {
        const result = await contract.getDataCenters(datacenterIds);
        for (let i = 0; i < DATA_CENTERS.length; i++) {
            checkDatacenterResult(result[i], DATA_CENTERS[i]);
        }
      })

      it("Failed: Removed datacenter ID", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove datacenter ID
        const tx = await contract.removeDataCenter(datacenterIds[0]);
        await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], DATA_CENTERS[0].name);

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
        checkDatacenterResult(result[0], DATA_CENTERS[0]);
        checkDatacenterResult(result[1], DATA_CENTERS[2]);

        result = await contract.getDataCentersByCountry("uk");
        expect(result.length).to.equal(1);
        checkDatacenterResult(result[0], DATA_CENTERS[1]);
      })

      it("Should not include removed data centers", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove datacenters
        for (let i = 0; i < 2; i++) {
          await expect(
              contract.removeDataCenter(datacenterIds[i])
          ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], DATA_CENTERS[i].name);
        }
        
        // Check getDataCentersByCountry
        let result = await contract.getDataCentersByCountry("us");
        expect(result.length).to.equal(1);
        checkDatacenterResult(result[0], DATA_CENTERS[2]);

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
        checkDatacenterResult(result[0], DATA_CENTERS[0]);
        checkDatacenterResult(result[1], DATA_CENTERS[2]);

        result = await contract.getDataCentersByRegion("europe");
        expect(result.length).to.equal(1);
        checkDatacenterResult(result[0], DATA_CENTERS[1]);
      })

      it("Should not include removed data centers", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove datacenter IDs
        for (let i = 0; i < 2; i++) {
            await expect(
                contract.removeDataCenter(datacenterIds[i])
            ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[i], DATA_CENTERS[i].name);
        }
        
        // Check getDataCentersByCountry
        let result = await contract.getDataCentersByRegion("north america");
        expect(result.length).to.equal(1);
        checkDatacenterResult(result[0], DATA_CENTERS[2]);

        result = await contract.getDataCentersByRegion("europe");
        expect(result.length).to.equal(0);

        await currentSnapshot.restore();
      })
    })
  })

  describe("Remove datacenter", () => {
      let maxDataCenterID : bigint;
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

      let storageNodeContract: VDAStorageNodeFacet;


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

        storageNodeContract = await ethers.getContractAt("VDAStorageNodeFacet", diamondAddress);

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

              const tokenContract = await ethers.getContractAt("MockToken", tokenAddress);
              const decimal = await tokenContract.decimals()
              const stakePerSlot = await storageNodeContract.getStakePerSlot();
              let tokenAmount = (10n^decimal) * BigInt(storageNode.slotCount) * stakePerSlot;
              await tokenContract.approve(await contract.getAddress(), tokenAmount.toString());

              // Add storage node 
              await checkAddNode(storageNodeContract, storageNode, user, trustedSigner, true);

              // Failed to remove datacenter
              await expect(contract.removeDataCenter(datacenterIds[1])).to.be.revertedWithCustomError(contract, "HasDependingNodes");
          })

          it("Success: After depending nodes are removed",async () => {
              // Remove start
              const blockTime = await time.latest();
              const unregisterTime = blockTime + days(30);
              await checkRemoveNodeStart(storageNodeContract, user, unregisterTime);
              
              // Remove complete
              await time.increaseTo(unregisterTime);
              await checkRemoveNodeComplete(storageNodeContract, user, owner);

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
              const tx = await contract.removeDataCenterByName(DATA_CENTERS[0].name);

              await expect(tx).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[0], DATA_CENTERS[0].name);
          })

          it("Failed: Removed datacenter", async () => {
              await expect(
                  contract.removeDataCenterByName(DATA_CENTERS[0].name)
              ).to.be.revertedWithCustomError(contract, "InvalidDataCenterName").withArgs(DATA_CENTERS[0].name);
          })

          it("Failed: Has depending nodes", async () => {
              storageNode.datacenterId = datacenterIds[1];

              const tokenContract = await ethers.getContractAt("MockToken", tokenAddress);
              const decimal = await tokenContract.decimals()
              const stakePerSlot = await storageNodeContract.getStakePerSlot();
              let tokenAmount = (10n^decimal) * BigInt(storageNode.slotCount) * stakePerSlot;
              await tokenContract.approve(await contract.getAddress(), tokenAmount.toString());

              // Add storage node 
              await checkAddNode(storageNodeContract, storageNode, user, trustedSigner, true);

              // Failed to remove datacenter
              await expect(contract.removeDataCenterByName(DATA_CENTERS[1].name)).to.be.revertedWithCustomError(contract, "HasDependingNodes");
          })

          it("Success: After depending nodes are removed",async () => {
              // Remove start
              const blockTime = await time.latest();
              const unregisterTime = blockTime + days(30);
              await checkRemoveNodeStart(storageNodeContract, user, unregisterTime);
              
              // Remove complete
              await time.increaseTo(unregisterTime);
              await checkRemoveNodeComplete(storageNodeContract, user, owner);

              // Success to remove datacenter
              await expect(
                  contract.removeDataCenterByName(DATA_CENTERS[1].name)
              ).to.emit(contract, "RemoveDataCenter").withArgs(datacenterIds[1], DATA_CENTERS[1].name);
          })
      })
  })
})
