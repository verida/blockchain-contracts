/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, checkRemoveNodeComplete, checkRemoveNodeStart, createDatacentreStruct, createStorageNodeInputStruct, getFallbackNodeInfo } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { IDataCentre, MockToken, VDADataCentreFacet, VDAStorageNodeFacet, VDAStorageNodeManagementFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, EnumStatus, INVALID_COUNTRY_CODES, INVALID_REGION_CODES, VALID_NUMBER_SLOTS } from "./utils/constant";
import { LibDataCentre } from "../typechain-types/contracts/facets/VDADataCentreFacet";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { FacetCutAction, getSelectors } from "../scripts/libraries/diamond";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

describe('DataCentre Test', async function () {
  let diamondAddress: string
  let tokenAddress: string
  
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let contract: VDADataCentreFacet;

  const datacentreIds : bigint[] = []

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
    } = await deploy(undefined, ['VDADataCentreFacet', 'VDAStorageNodeFacet', 'VDAStorageNodeManagementFacet']));

    contract = await ethers.getContractAt("VDADataCentreFacet", diamondAddress)

  })

  describe("Add datacentre", () => {
    it("Failed : non-owner", async () => {
      await expect(contract
          .connect(accounts[0])
          .addDataCentre(DATA_CENTERS[0])
      ).to.be.revertedWithCustomError(contract, "NotContractOwner");
    })

    it("Failed: Invalid datacentre names", async () => {
      const invalidDatacentreNames = [
          "", // Empty name
          "A3523", //Capital letter in the name
          "Aa" //Capital letter in the name
      ]
      for (let i = 0; i < invalidDatacentreNames.length; i++ ) {
          const invalidDataCentre = createDatacentreStruct(invalidDatacentreNames[i], "", "", 0, 0 );
          await expect(
              contract.addDataCentre(invalidDataCentre)
          ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName");
      }
        
    })
    
    it("Failed: Invalid country codes",async () => {
      for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
          const invalidDataCentre = createDatacentreStruct("dc-test", INVALID_COUNTRY_CODES[i], "north america", 0, 0 );
          await expect(
              contract.addDataCentre(invalidDataCentre)
          ).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
      }
    })

    it("Failed: Invalid region codes",async () => {
      for (let i = 0; i < INVALID_REGION_CODES.length; i++) {
          const invalidDataCentre = createDatacentreStruct("dc-test", "us", "", 0, 0 );
          await expect(
              contract.addDataCentre(invalidDataCentre)
          ).to.be.revertedWithCustomError(contract, "InvalidRegionCode")
      }
    })

    it("Failed: Invlaid Latitude",async () => {
      const invalidLatValues = [-90.05, -180, 91, 500];
      for (let i = 0; i < invalidLatValues.length; i++) {
          const invalidDataCentre = createDatacentreStruct("dc-test", "us", "north america", invalidLatValues[i], 0 );
          await expect(
              contract.addDataCentre(invalidDataCentre)
          ).to.be.revertedWithCustomError(contract, "InvalidLatitude")
      }
    })

    it("Failed: Invalid Longitude",async () => {
      const invalidLongValues = [-180.1, -270, -400.2523, 181, 360, 500.235];
      for (let i = 0; i < invalidLongValues.length; i++) {
          const invalidDataCentre = createDatacentreStruct("dc-test", "us", "north america", -90, invalidLongValues[i] );
          await expect(
              contract.addDataCentre(invalidDataCentre)
          ).to.be.revertedWithCustomError(contract, "InvalidLongitude")
      }
    })

    it("Success", async () => {
      for (let i = 0; i < DATA_CENTERS.length; i++) {
        const tx = await contract.addDataCentre(DATA_CENTERS[i])

        await expect(tx).to.emit(contract, "AddDataCentre");

        const transactionReceipt = await tx.wait();
        const events =await contract.queryFilter(contract.filters.AddDataCentre, transactionReceipt?.blockNumber, transactionReceipt?.blockNumber);
        if (events.length > 0) {
          datacentreIds.push(events[0].args[0])
        }
      }
    })

    it("Failed: Registered datacentre name", async () => {
      const invalidDatacentres = [
          createDatacentreStruct("centre-1", "us", "north america", -90, -150),
          createDatacentreStruct("centre-1", "uk", "europe", 0, 0),
          createDatacentreStruct("centre-2", "au", "oceania", -90, -150),
          createDatacentreStruct("centre-2", "hk", "asia", 0, 0),
      ]

      for (let i = 0; i < invalidDatacentres.length; i++) {
          await expect(
              contract.addDataCentre(invalidDatacentres[i])
          ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName")
      }
    })

    it("Failed: removed datacentre name", async () => {
      const currentSnapshot = await takeSnapshot();

      let tx = await contract.removeDataCentre(datacentreIds[0])
      await expect(tx).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[0], DATA_CENTERS[0].name);

      // Re register removed name
      await expect(
        contract.addDataCentre(DATA_CENTERS[0])
      ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName");

      await currentSnapshot.restore();
    })
  })

  describe("Is datacentre name registered", () => {
    let currentSnapShot: SnapshotRestorer;
    const dataCentre = createDatacentreStruct("centre-x", "us", "north america", -90, -150);

    before(async () => {
      currentSnapShot = await takeSnapshot();
    })
    after(async () => {
      await currentSnapShot.restore();
    })

    it("Return `False` for unregistered name",async () => {
        expect(await contract.isRegisteredDataCentreName(dataCentre.name)).to.be.eq(false);
    })

    it("Return `True` for registered name",async () => {
        // Add data centre
        await expect(
            contract.addDataCentre(dataCentre)
        ).to.emit(contract, "AddDataCentre");

        expect(await contract.isRegisteredDataCentreName(dataCentre.name)).to.be.eq(true);
    })

    it("Return `True` for removed name",async () => {

        // Remove data centre
        await expect(
            contract.removeDataCentreByName(dataCentre.name)
        ).to.emit(contract, "RemoveDataCentre");

        expect(await contract.isRegisteredDataCentreName(dataCentre.name)).to.be.eq(true);
    })
  })

  describe("Get datacentres", () => {
    const checkDatacentreResult = (result: LibDataCentre.DataCentreStructOutput, org: IDataCentre.DatacentreInputStruct) => {
      expect(result.name).to.equal(org.name);
      expect(result.countryCode).to.equal(org.countryCode);
      expect(result.regionCode).to.equal(org.regionCode);
      expect(result.lat).to.equal(org.lat);
      expect(result.long).to.equal(org.long);
    }

    describe("Get datacentres by names", () => {
      it("Failed : Unregistered name",async () => {
        await expect(
            contract.getDataCentresByName(["invalid name"])
        ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName");

        await expect(
            contract.getDataCentresByName(["invalid name", DATA_CENTERS[0].name])
        ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName");

        await expect(
            contract.getDataCentresByName([DATA_CENTERS[0].name, "invalid name"])
        ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName");
      })

      it("Success",async () => {
        const names = DATA_CENTERS.map(item => item.name);

        const result = await contract.getDataCentresByName(names);
        for (let i = 0; i < DATA_CENTERS.length; i++) {
            checkDatacentreResult(result[i], DATA_CENTERS[i]);
            expect(result[i].status).to.be.eq(EnumStatus.active);
        }
      })

      it("Success : Removed data centre",async () => {
        const currentSnapshot = await takeSnapshot();

        await expect(
            contract.removeDataCentre(datacentreIds[0])
        ).to.emit(contract, "RemoveDataCentre");

        const result = await contract.getDataCentresByName([DATA_CENTERS[0].name]);
        expect(result.length === 1, "Returned a data centre");
        checkDatacentreResult(result[0], DATA_CENTERS[0]);

        expect(result[0].status).to.be.eq(EnumStatus.removed);

        await currentSnapshot.restore();
      })
    })

    describe("Get datacentres by IDs", () => {
      let maxDataCentreID : bigint;
      before(async() => {
        maxDataCentreID = datacentreIds[datacentreIds.length -1];
      })

      it("Failed: Invalid IDs", async () => {
        let invalidIDs: bigint[] = [0n];
        await expect(contract.getDataCentres(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCentreId");

        invalidIDs = [0n, maxDataCentreID + 1n];
        await expect(contract.getDataCentres(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCentreId");

        invalidIDs = [0n, datacentreIds[0]];
        await expect(contract.getDataCentres(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCentreId");

        invalidIDs = [datacentreIds[0], maxDataCentreID + 1n];
        await expect(contract.getDataCentres(invalidIDs)).to.be.revertedWithCustomError(contract, "InvalidDataCentreId");
      })

      it("Success",async () => {
        const result = await contract.getDataCentres(datacentreIds);
        for (let i = 0; i < DATA_CENTERS.length; i++) {
            checkDatacentreResult(result[i], DATA_CENTERS[i]);
            expect(result[i].status).to.be.eq(EnumStatus.active);
        }
      })

      it("Success: Removed datacentre ID", async () => {
        const currentSnapshot = await takeSnapshot();

        // Remove datacentre ID
        const tx = await contract.removeDataCentre(datacentreIds[0]);
        await expect(tx).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[0], DATA_CENTERS[0].name);

        const result = await contract.getDataCentres([datacentreIds[0]]);
        checkDatacentreResult(result[0], DATA_CENTERS[0]);
        expect(result[0].status).to.be.eq(EnumStatus.removed);

        await currentSnapshot.restore();
      })
    })

    describe("Get datacentres by country code", () => {
      describe("Get without status filter", () => {
        it("Failed: Invalid country code", async () => {
          for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
              await expect(contract.getDataCentresByCountry(INVALID_COUNTRY_CODES[i])).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
          }
        })
  
        it("Return empty array for unregistered counry codes", async () => {
          const unregisteredCountryCodes = ["at", "by", "sg"];
          for (let i = 0; i < unregisteredCountryCodes.length; i++) {
              expect(
                  await contract.getDataCentresByCountry(unregisteredCountryCodes[i])
              ).to.deep.equal([]);
          }
        })
  
        it("Success", async () => {
          let result = await contract.getDataCentresByCountry("us");
          expect(result.length).to.equal(2);
          checkDatacentreResult(result[0], DATA_CENTERS[0]);
          checkDatacentreResult(result[1], DATA_CENTERS[2]);
  
          result = await contract.getDataCentresByCountry("uk");
          expect(result.length).to.equal(1);
          checkDatacentreResult(result[0], DATA_CENTERS[1]);
        })
  
        it("Should contain removed data centres", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacentres
          for (let i = 0; i < 2; i++) {
            await expect(
                contract.removeDataCentre(datacentreIds[i])
            ).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[i], DATA_CENTERS[i].name);
          }
          
          // Check getDataCentresByCountry
          let result = await contract.getDataCentresByCountry("us");
          expect(result.length).to.equal(2);
          checkDatacentreResult(result[0], DATA_CENTERS[0]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
          checkDatacentreResult(result[1], DATA_CENTERS[2]);
          expect(result[1].status).to.be.eq(EnumStatus.active);
  
          result = await contract.getDataCentresByCountry("uk");
          expect(result.length).to.equal(1);
          checkDatacentreResult(result[0], DATA_CENTERS[1]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
  
          await currentSnapshot.restore();
        })
      })

      describe("Get with status filter", () => {
        it("Failed: Invalid country code", async () => {
          for (let i = 0; i < INVALID_COUNTRY_CODES.length; i++) {
              await expect(contract.getDataCentresByCountryAndStatus(INVALID_COUNTRY_CODES[i], EnumStatus.active)).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
              await expect(contract.getDataCentresByCountryAndStatus(INVALID_COUNTRY_CODES[i], EnumStatus.removed)).to.be.revertedWithCustomError(contract, "InvalidCountryCode");
          }
        })
  
        it("Return empty array for unregistered counry codes", async () => {
          const unregisteredCountryCodes = ["at", "by", "sg"];
          for (let i = 0; i < unregisteredCountryCodes.length; i++) {
              expect(
                  await contract.getDataCentresByCountryAndStatus(unregisteredCountryCodes[i], EnumStatus.active)
              ).to.deep.equal([]);

              expect(
                await contract.getDataCentresByCountryAndStatus(unregisteredCountryCodes[i], EnumStatus.removed)
            ).to.deep.equal([]);
          }
        })
  
        it("Success", async () => {
          // 2 active data centres for "us"
          let result = await contract.getDataCentresByCountryAndStatus("us", EnumStatus.active);
          expect(result.length).to.equal(2);
          checkDatacentreResult(result[0], DATA_CENTERS[0]);
          checkDatacentreResult(result[1], DATA_CENTERS[2]);
          // No removed data centres for "us"
          result = await contract.getDataCentresByCountryAndStatus("us", EnumStatus.removed);
          expect(result.length).to.equal(0);
  
          // 1 active data cetner for "uk"
          result = await contract.getDataCentresByCountryAndStatus("uk", EnumStatus.active);
          expect(result.length).to.equal(1);
          checkDatacentreResult(result[0], DATA_CENTERS[1]);
          // No removed data centres for "uk"
          result = await contract.getDataCentresByCountryAndStatus("uk", EnumStatus.removed);
          expect(result.length).to.equal(0);
        })
  
        it("Success with removed data centres", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacentres, Remove one data centre from "us" and "uk"
          for (let i = 0; i < 2; i++) {
            await expect(
                contract.removeDataCentre(datacentreIds[i])
            ).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[i], DATA_CENTERS[i].name);
          }
          
          // Check getDataCentresByCountry
          // 1 active and 1 removed for "us"
          expect((await contract.getDataCentresByCountryAndStatus("us", EnumStatus.active)).length).to.equal(1);
          expect((await contract.getDataCentresByCountryAndStatus("us", EnumStatus.removed)).length).to.equal(1);
          
          // 0 active and 1 removed for "uk"
          expect((await contract.getDataCentresByCountryAndStatus("uk", EnumStatus.active)).length).to.equal(0);
          expect((await contract.getDataCentresByCountryAndStatus("uk", EnumStatus.removed)).length).to.equal(1);

          await currentSnapshot.restore();
        })
      })
    })
    
    describe("Get datacentres by region code", () => {
      describe("Get without status filter", () => {
        it("Failed: Invalid region code", async () => {
            await expect(contract.getDataCentresByRegion("")).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
        })
  
        it("Return empty arry for unregistered region codes", async () => {
          const unregisteredRegionCodes = ["asia", "africa"];
          for (let i = 0; i < unregisteredRegionCodes.length; i++) {
              expect(await contract.getDataCentresByRegion(unregisteredRegionCodes[i])).to.deep.equal([]);
          }
        })
  
        it("Success", async () => {
          let result = await contract.getDataCentresByRegion("north america");
          expect(result.length).to.equal(2);
          checkDatacentreResult(result[0], DATA_CENTERS[0]);
          checkDatacentreResult(result[1], DATA_CENTERS[2]);
  
          result = await contract.getDataCentresByRegion("europe");
          expect(result.length).to.equal(1);
          checkDatacentreResult(result[0], DATA_CENTERS[1]);
        })
  
        it("Should contain removed data centres", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacentre IDs
          for (let i = 0; i < 2; i++) {
              await expect(
                  contract.removeDataCentre(datacentreIds[i])
              ).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[i], DATA_CENTERS[i].name);
          }
          
          // Check getDataCentresByCountry
          let result = await contract.getDataCentresByRegion("north america");
          expect(result.length).to.equal(2);
          checkDatacentreResult(result[0], DATA_CENTERS[0]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
          checkDatacentreResult(result[1], DATA_CENTERS[2]);
          expect(result[1].status).to.be.eq(EnumStatus.active);
  
          result = await contract.getDataCentresByRegion("europe");
          expect(result.length).to.equal(1);
          checkDatacentreResult(result[0], DATA_CENTERS[1]);
          expect(result[0].status).to.be.eq(EnumStatus.removed);
  
          await currentSnapshot.restore();
        })
      })

      describe("Get with status filter", () => {
        it("Failed: Invalid region code", async () => {
            await expect(contract.getDataCentresByRegionAndStatus("", EnumStatus.active)).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
            await expect(contract.getDataCentresByRegionAndStatus("", EnumStatus.removed)).to.be.revertedWithCustomError(contract, "InvalidRegionCode");
        })
  
        it("Return empty arry for unregistered region codes", async () => {
          const unregisteredRegionCodes = ["asia", "africa"];
          for (let i = 0; i < unregisteredRegionCodes.length; i++) {
              expect(await contract.getDataCentresByRegionAndStatus(unregisteredRegionCodes[i], EnumStatus.active)).to.deep.equal([]);
              expect(await contract.getDataCentresByRegionAndStatus(unregisteredRegionCodes[i], EnumStatus.removed)).to.deep.equal([]);
          }
        })
  
        it("Success", async () => {
          // 2 active data centres for "north america"
          let result = await contract.getDataCentresByRegionAndStatus("north america", EnumStatus.active);
          expect(result.length).to.equal(2);
          checkDatacentreResult(result[0], DATA_CENTERS[0]);
          checkDatacentreResult(result[1], DATA_CENTERS[2]);
          // no removed data centre for "north america"
          result = await contract.getDataCentresByRegionAndStatus("north america", EnumStatus.removed);
          expect(result.length).to.equal(0);
          
          // 1 active data centre for "europe"
          result = await contract.getDataCentresByRegionAndStatus("europe", EnumStatus.active);
          expect(result.length).to.equal(1);
          checkDatacentreResult(result[0], DATA_CENTERS[1]);
          // no removed data centre for "europe"
          result = await contract.getDataCentresByRegionAndStatus("europe", EnumStatus.removed);
          expect(result.length).to.equal(0);
        })
  
        it("Success with removed data centres", async () => {
          const currentSnapshot = await takeSnapshot();
  
          // Remove datacentre IDs, remove one data centre from "north america" and "europe"
          for (let i = 0; i < 2; i++) {
              await expect(
                  contract.removeDataCentre(datacentreIds[i])
              ).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[i], DATA_CENTERS[i].name);
          }
          
          // 1 active data centre and 1 removed data centre for "north america"
          expect((await contract.getDataCentresByRegionAndStatus("north america", EnumStatus.active)).length).to.equal(1);
          expect((await contract.getDataCentresByRegionAndStatus("north america", EnumStatus.removed)).length).to.equal(1);
          
          // no active data centre and 1 removed data centre for "europe"
          expect((await contract.getDataCentresByRegionAndStatus("europe", EnumStatus.active)).length).to.equal(0);
          expect((await contract.getDataCentresByRegionAndStatus("europe", EnumStatus.removed)).length).to.equal(1);

          await currentSnapshot.restore();
        })
      })
    })
  })

  describe("Remove datacentre", () => {
    let maxDataCentreID : bigint;
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
      3, // Must be different from the datacentreID of storage Node to test removeDataCentre
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

      maxDataCentreID = datacentreIds[datacentreIds.length -1];

      
      currentSnapShot = await takeSnapshot();
    })

    describe("Remove by IDs", () => {
      it("Failed: Not created datacentreId", async () => {
          const invalidIds = [0n, maxDataCentreID + 1n, maxDataCentreID + 100n]

          for (let i = 0; i < invalidIds.length; i++) {
              await expect(
                  contract.removeDataCentre(invalidIds[i])
              ).to.be.revertedWithCustomError(contract, "InvalidDataCentreId").withArgs(invalidIds[i]);
          }
      })

      it("Success: Fresh datacentres that has no storage nodes added", async () => {
          const tx = await contract.removeDataCentre(datacentreIds[1]);

          await expect(tx).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[1], anyValue);
      })

      it("Failed: Removed datacentreId", async () => {
          await expect(
              contract.removeDataCentre(datacentreIds[1])
          ).to.be.revertedWithCustomError(contract, "InvalidDataCentreId");
      })

      it("Failed: Has depending nodes", async () => {
        // Add storage node 
        await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress);
        await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

        // Failed to remove datacentre
        await expect(contract.removeDataCentre(datacentreIds[0])).to.be.revertedWithCustomError(contract, "HasDependingNodes");
      })

      it("Success: After depending nodes are removed",async () => {
        await completeRemove();

        // Success to remove datacentre
        await expect(
            contract.removeDataCentre(datacentreIds[0])
        ).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[0], anyValue);
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
                  contract.removeDataCentreByName(invalidNames[i])
              ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName").withArgs(invalidNames[i]);
          }
      })

      it("Success: Fresh datacentres that has no storage nodes added", async () => {
          const tx = await contract.removeDataCentreByName(DATA_CENTERS[1].name);

          await expect(tx).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[1], DATA_CENTERS[1].name);
      })

      it("Failed: Removed datacentre", async () => {
          await expect(
              contract.removeDataCentreByName(DATA_CENTERS[1].name)
          ).to.be.revertedWithCustomError(contract, "InvalidDataCentreName").withArgs(DATA_CENTERS[1].name);
      })

      it("Failed: Has depending nodes", async () => {
          // Add node
          await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress);
          await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
          
          // Failed to remove datacentre
          await expect(contract.removeDataCentreByName(DATA_CENTERS[0].name)).to.be.revertedWithCustomError(contract, "HasDependingNodes");
      })

      it("Success: After depending nodes are removed",async () => {
          // Remove complete
          await completeRemove();

          // Success to remove datacentre
          await expect(
              contract.removeDataCentreByName(DATA_CENTERS[0].name)
          ).to.emit(contract, "RemoveDataCentre").withArgs(datacentreIds[0], DATA_CENTERS[0].name);
      })
    })
  })
})
