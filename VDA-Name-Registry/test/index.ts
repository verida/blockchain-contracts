import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import hre, { ethers, upgrades } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "@ethersproject/bignumber";

import { NameRegistry } from "../typechain";

import { formatBytes32String } from "ethers/lib/utils";

import EncryptionUtils from '@verida/encryption-utils'
import { Wallet } from "ethers";

chai.use(solidity);
chai.use(chaiAsPromised);

let contract: NameRegistry;


const badSigner = Wallet.createRandom();

const dids = [
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
];

const createVeridaSign = async (
  rawMsg: any,
  privateKey: string,
  docDID: string
) => {
  if (contract === undefined) return "";

  // const nonce = (await contract.getNonce(docDID)).toNumber();
  // console.log("Nonce = ", nonce);
  // rawMsg = ethers.utils.solidityPack(["bytes", "uint256"], [rawMsg, nonce]);
  const privateKeyArray = new Uint8Array(
    Buffer.from(privateKey.slice(2), "hex")
  );
  const signature = EncryptionUtils.signData(rawMsg, privateKeyArray);

  const isValid = EncryptionUtils.verifySig(
    rawMsg,
    signature,
    dids[0].publicKey
  );
  console.log("IsValid : ", isValid);

  return EncryptionUtils.signData(rawMsg, privateKeyArray);
};

describe("NameRegistry", function () {
  let accountList: SignerWithAddress[];

  const testNames = [
    "John.verida",
    "Smith Elba.verida",
    "Bill Clin.verida",
    "Jerry Smith.verida",

    "Jerry Smith.test",
    "Billy.test",
  ];

  const newSuffix = "test";

  const zeroAddress = "0x0000000000000000000000000000000000000000";

  this.beforeAll(async function () {
    await hre.network.provider.send("hardhat_reset");
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    accountList = await ethers.getSigners();

    const contractFactory = await ethers.getContractFactory("NameRegistry");
    // contract = await contractFactory.deploy();
    contract = (await upgrades.deployProxy(contractFactory, {
      initializer: "initialize",
    })) as NameRegistry;

    console.log("NameRegistry deployed at ", contract.address);
  });

  describe("Register", async () => {
    /*
    it("Failed : Invalid signature", async () => {
      await expect(
        contract.register(testNames[0], zeroAddress, "Invalid signature")
      ).to.be.rejectedWith("Invalid signature");
    });

    it("Failed : Invalid zero address", async () => {
      await expect(
        contract.register(
          testNames[0],
          zeroAddress,
          formatBytes32String("Any Signature will fail")
        )
      ).to.be.rejectedWith("Invalid zero address");
    });

    it("Failed : Invalid suffix", async () => {
      const rawMsg = ethers.utils.solidityPack(
        ["string", "address"],
        [testNames[4], dids[0].address]
      );
      const signature = await createVeridaSign(
        rawMsg,
        dids[0].privateKey,
        dids[0].address
      );
      await expect(
        contract.register(testNames[4], dids[0].address, signature)
      ).to.be.rejectedWith("Invalid suffix");
    });
    */

    it("Register one username successfully", async () => {
      console.log("did : ", dids[0].address);
      const rawMsg = ethers.utils.solidityPack(
        ["string", "address"],
        [testNames[0], dids[0].address]
      );
      const signature = await createVeridaSign(
        "0x1234",
        dids[0].privateKey,
        dids[0].address
      );

      await contract.register(testNames[0], dids[0].address, signature);
      // expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
      //   1
      // );
    });

    /*
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
    */
  });

  /*
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
    it("Failed: No registered DID", async () => {
      // This happens when user unregister all user names.
      await contract
        .connect(accountList[1])
        .register(testNames[3], testDIDs[1], testSignature);

      await contract
        .connect(accountList[1])
        .unregister(testNames[3], testDIDs[1], testSignature);

      await expect(
        contract
          .connect(accountList[1])
          .getUserNameList(testDIDs[1], testSignature)
      ).to.be.rejectedWith("No registered DID");
    });

    it("Successfully get username list", async () => {
      const result = await contract.getUserNameList(testDIDs[0], testSignature);
      expect(result.length).to.be.eq(3);

      console.log("Returned usernames: ", result);
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
      ).to.be.rejectedWith("Invalid suffix");

      // Register new suffix
      await contract.addSufix(newSuffix);

      // Register naems success after adding suffix
      await contract.register(testNames[4], testDIDs[0], testSignature);
      await contract.unregister(testNames[4], testDIDs[0], testSignature);
    });
  });
  */
});
