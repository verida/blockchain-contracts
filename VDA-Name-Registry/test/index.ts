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

describe("NameRegistry", function () {
  let contract: NameRegistry;
  let accountList: SignerWithAddress[];

  const testNames = [
    formatBytes32String("John"),
    formatBytes32String("Smith Elba"),
    formatBytes32String("Bill Clin"),
    formatBytes32String("Jerry Smith"),
  ];

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
    it("Failed : Invalid zero address", async () => {
      await expect(
        contract.register(testNames[0], zeroAddress)
      ).to.be.rejectedWith("Invalid zero address");
    });

    it("Register one username successfully", async () => {
      await expect(contract.register(testNames[0], testDIDs[0]));
      expect((await contract.getUserNameList(testDIDs[0])).length).to.be.eq(1);
    });

    it("Failed: Name already registered", async () => {
      await expect(
        contract.register(testNames[0], testDIDs[0])
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract.register(testNames[0], testDIDs[1])
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract.connect(accountList[1]).register(testNames[0], testDIDs[0])
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract.connect(accountList[1]).register(testNames[0], testDIDs[1])
      ).to.be.rejectedWith("Name already registered");
    });

    it("Failed: Not a DID owner", async () => {
      await expect(
        contract.connect(accountList[1]).register(testNames[1], testDIDs[0])
      ).to.be.rejectedWith("Not a DID owner");
    });

    it("Add multiple user names successfully", async () => {
      await contract.register(testNames[1], testDIDs[0]);
      expect((await contract.getUserNameList(testDIDs[0])).length).to.be.eq(2);

      await contract.register(testNames[2], testDIDs[0]);
      expect((await contract.getUserNameList(testDIDs[0])).length).to.be.eq(3);
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

    it("Failed : Not a owner", async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          contract.connect(accountList[1]).findDid(testNames[i])
        ).to.be.rejectedWith("Not a owner");
      }
    });

    it("Successfully get DID", async () => {
      expect(await contract.findDid(testNames[0])).to.equal(testDIDs[0]);
      expect(await contract.findDid(testNames[1])).to.equal(testDIDs[0]);
      expect(await contract.findDid(testNames[2])).to.equal(testDIDs[0]);
    });
  });

  describe("getUserNameList", async () => {
    it("Failed: Not a owner", async () => {
      await expect(
        contract.connect(accountList[1]).getUserNameList(testDIDs[0])
      ).to.be.rejectedWith("Not a owner");

      await expect(
        contract.connect(accountList[2]).getUserNameList(testDIDs[0])
      ).to.be.rejectedWith("Not a owner");
    });

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
      const result = await contract.getUserNameList(testDIDs[0]);
      expect(result.length).to.be.eq(3);

      console.log("Returned usernames: ", result);
    });
  });

  describe("Unregister", async () => {
    it("Failed: Unregistered name", async () => {
      await expect(contract.unregister(testNames[3])).to.be.rejectedWith(
        "Unregistered name"
      );

      await expect(
        contract.connect(accountList[1]).unregister(testNames[3])
      ).to.be.rejectedWith("Unregistered name");
    });

    it("Failed: Not a owner", async () => {
      await expect(
        contract.connect(accountList[1]).unregister(testNames[0])
      ).to.be.rejectedWith("Not a owner");

      await expect(
        contract.connect(accountList[2]).unregister(testNames[1])
      ).to.be.rejectedWith("Not a owner");

      await expect(
        contract.connect(accountList[3]).unregister(testNames[2])
      ).to.be.rejectedWith("Not a owner");
    });

    it("Successfully unregistered", async () => {
      expect((await contract.getUserNameList(testDIDs[0])).length).to.be.eq(3);

      await contract.unregister(testNames[0]);
      expect((await contract.getUserNameList(testDIDs[0])).length).to.be.eq(2);

      await contract.unregister(testNames[1]);
      expect((await contract.getUserNameList(testDIDs[0])).length).to.be.eq(1);

      await contract.unregister(testNames[2]);
      await expect(contract.getUserNameList(testDIDs[0])).to.be.rejectedWith(
        "Not a owner"
      );
    });
  });
});
