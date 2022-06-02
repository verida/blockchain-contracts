import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import hre, { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "@ethersproject/bignumber";

import { NameRegistry } from "../typechain";

import { formatBytes32String } from "ethers/lib/utils";

chai.use(solidity);
chai.use(chaiAsPromised);

const testSignature =
  "0x67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c";
const badSignature =
  "0xf157fd349172fa8bb84710d871724091947289182373198723918cabcc888ef888ff8876956050565d5757a57d868b8676876e7678687686f95419238191488923";

describe("NameRegistry", function () {
  let contract: NameRegistry;
  let accountList: SignerWithAddress[];

  const testNames = [
    formatBytes32String("John.verida"),
    formatBytes32String("Smith Elba.verida"),
    formatBytes32String("Bill Clin.verida"),
    formatBytes32String("Jerry Smith.verida"),

    formatBytes32String("Jerry Smith.test"),
    formatBytes32String("Billy.test"),
  ];

  const newSuffix = formatBytes32String("test");
  
  // 0x7665726964610000000000000000000000000000000000000000000000000000

  const testDIDs = [
    "0x181aB2d2F0143cd2046253c56379f7eDb1E9C133",
    "0x2b3f34e9d4b127797ce6244ea341a83733ddd6e4",
    "0x327c1FEd75440d4c3fA067E633A3983D211f0dfD",
    "0x4f41ce9d745404acd3f068E632A1781Da11f0dfD",
  ];

  const zeroAddress = "0x0000000000000000000000000000000000000000";

  this.beforeAll(async function () {
    await hre.network.provider.send("hardhat_reset");
    accountList = await ethers.getSigners();

    const contractFactory = await ethers.getContractFactory("NameRegistry");
    contract = await contractFactory.deploy();
    console.log("NameRegistry deployed at ", contract.address);
  });

  describe("Register", async () => {
    it("Failed : Invalid signature", async () => {
      await expect(
        contract.register(testNames[0], zeroAddress, badSignature)
      ).to.be.rejectedWith("Invalid signature");
    });

    it("Failed : Invalid zero address", async () => {
      await expect(
        contract.register(testNames[0], zeroAddress, testSignature)
      ).to.be.rejectedWith("Invalid zero address");
    });

    it("Failed : Unregistered suffix", async () => {
      await expect(
        contract.register(testNames[4], testDIDs[0], testSignature)
      ).to.be.rejectedWith("Unregistered suffix");
    });

    it("Register one username successfully", async () => {
      await expect(contract.register(testNames[0], testDIDs[0], testSignature));
      expect(
        (await contract.getUserNameList(testDIDs[0], testSignature)).length
      ).to.be.eq(1);
    });

    it("Failed: Name already registered", async () => {
      await expect(
        contract.register(testNames[0], testDIDs[0], testSignature)
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract.register(testNames[0], testDIDs[1], testSignature)
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract
          .connect(accountList[1])
          .register(testNames[0], testDIDs[0], testSignature)
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract
          .connect(accountList[1])
          .register(testNames[0], testDIDs[1], testSignature)
      ).to.be.rejectedWith("Name already registered");
    });

    it("Add multiple user names successfully", async () => {
      await contract.register(testNames[1], testDIDs[0], testSignature);
      expect(
        (await contract.getUserNameList(testDIDs[0], testSignature)).length
      ).to.be.eq(2);

      await contract.register(testNames[2], testDIDs[0], testSignature);
      expect(
        (await contract.getUserNameList(testDIDs[0], testSignature)).length
      ).to.be.eq(3);
    });
  });

  describe("Find DID", async () => {
    it("Failed : Unregistered name", async () => {
      await expect(contract.findDid(testNames[3])).to.be.rejectedWith(
        "Unregistered name"
      );

      await expect(
        contract.connect(accountList[1]).findDid(testNames[3])
      ).to.be.rejectedWith("Unregistered name");
    });

    it("Successfully get DID", async () => {
      expect(await contract.findDid(testNames[0])).to.equal(testDIDs[0]);
      expect(await contract.findDid(testNames[1])).to.equal(testDIDs[0]);
      expect(await contract.findDid(testNames[2])).to.equal(testDIDs[0]);
    });
  });

  describe("getUserNameList", async () => {
    /*
    it("Failed: No registered DID", async () => {
      // This happens when user unregister all user names.
      await contract
        .connect(accountList[1])
        .register(testNames[3], testDIDs[1]);

      await contract.connect(accountList[1]).unregister(testNames[3]);

      await expect(
        contract.connect(accountList[1]).getUserNameList(testDIDs[1])
      ).to.be.rejectedWith("No registered DID");
    });
    */

    it("Successfully get username list", async () => {
      const result = await contract.getUserNameList(testDIDs[0], testSignature);
      expect(result.length).to.be.eq(3);

      // console.log("Returned usernames: ", result);
    });
  });

  describe("Unregister", async () => {
    it("Failed: Unregistered name", async () => {
      await expect(
        contract.unregister(testNames[3], testDIDs[0], testSignature)
      ).to.be.rejectedWith("Unregistered name");
    });

    it("Failed: Invalid DID", async () => {
      await expect(
        contract
          .connect(accountList[1])
          .unregister(testNames[0], testDIDs[1], testSignature)
      ).to.be.rejectedWith("Invalid DID");

      await expect(
        contract
          .connect(accountList[1])
          .unregister(testNames[0], testDIDs[2], testSignature)
      ).to.be.rejectedWith("Invalid DID");

      await expect(
        contract
          .connect(accountList[1])
          .unregister(testNames[1], testDIDs[2], testSignature)
      ).to.be.rejectedWith("Invalid DID");
    });

    it("Successfully unregistered", async () => {
      expect(
        (await contract.getUserNameList(testDIDs[0], testSignature)).length
      ).to.be.eq(3);

      await contract.unregister(testNames[0], testDIDs[0], testSignature);
      expect(
        (await contract.getUserNameList(testDIDs[0], testSignature)).length
      ).to.be.eq(2);

      await contract.unregister(testNames[1], testDIDs[0], testSignature);
      expect(
        (await contract.getUserNameList(testDIDs[0], testSignature)).length
      ).to.be.eq(1);

      await contract.unregister(testNames[2], testDIDs[0], testSignature);
      await expect(
        contract.getUserNameList(testDIDs[0], testSignature)
      ).to.be.rejectedWith("No registered DID");
    });
  });

  describe("Add suffix", async () => {
    it("Failed : Not a owner", async () => {
      await expect(
        contract.connect(accountList[1]).addSufix(newSuffix)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Add sufix successfully", async () => {
      // Register names failed before adding suffix
      await expect(
        contract.register(testNames[4], testDIDs[0], testSignature)
      ).to.be.rejectedWith("Unregistered suffix");

      // Register new suffix
      await contract.addSufix(newSuffix);

      // Register naems success after adding suffix
      await contract.register(testNames[4], testDIDs[0], testSignature);
      await contract.unregister(testNames[4], testDIDs[0], testSignature);
    })
  });
});
