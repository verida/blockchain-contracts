import { expect } from "chai";
import hre, { ethers, upgrades } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { NameRegistry } from "../typechain-types";

import { formatBytes32String } from "ethers/lib/utils";

import EncryptionUtils from "@verida/encryption-utils";
import { Wallet } from "ethers";


let contract: NameRegistry;

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

  const nonce = (await contract.nonce(docDID)).toNumber();
  rawMsg = ethers.utils.solidityPack(["bytes", "uint256"], [rawMsg, nonce]);
  const privateKeyArray = new Uint8Array(
    Buffer.from(privateKey.slice(2), "hex")
  );
  return EncryptionUtils.signData(rawMsg, privateKeyArray);
};

const getRegisterSignature = async (name: string, did: Wallet) => {
  const rawMsg = ethers.utils.solidityPack(
    ["string", "address"],
    [name, did.address]
  );
  return createVeridaSign(rawMsg, did.privateKey, did.address);
};

describe("NameRegistry", function () {
  let accountList: SignerWithAddress[];

  const testNames = [
    "helloworld.vda",
    "hello----world--.vda",
    "hello_world-dave.vda",
    "JerrySmith.vda",

    "JerrySmith.test",
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
  });

  describe("Register", () => {
    it("Failed : Invalid zero address", async () => {
      await expect(
        contract.register(
          testNames[0],
          zeroAddress,
          formatBytes32String("Correct signature not working")
        )
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    });

    it("Failed : Invalid character specified in names", async () => {
      const invalidnames = ["hello world.vda", "hello!world.vda"];
      for (let i = 0; i < invalidnames.length; i++) {
        const name = invalidnames[i];
        const signature = await getRegisterSignature(name, dids[0]);
        await expect(
          contract.register(name, dids[0].address, signature)
        ).to.be.revertedWithCustomError(contract, "InvalidName");
      }
    });

    it("Failed : . not permitted", async () => {
      const invalidnames = ["david.test.vda", "hello..vda"];
      for (let i = 0; i < invalidnames.length; i++) {
        const name = invalidnames[i];
        const signature = await getRegisterSignature(name, dids[0]);
        await expect(
          contract.register(name, dids[0].address, signature)
        ).to.be.revertedWithCustomError(contract, "InvalidName");
      }
    });

    it("Failed : Unregistered suffix", async () => {
      const signature = await getRegisterSignature(testNames[4], dids[0]);

      await expect(
        contract.register(testNames[4], dids[0].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidSuffix");
    });

    it("Failed : Invalid DID - zero address", async () => {
      await expect(
        contract.register(testNames[0], zeroAddress, "0x00")
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    });

    it("Failed : Invalid Signature", async () => {
      const badSignature = await getRegisterSignature(testNames[0], dids[1]);

      await expect(
        contract.register(testNames[0], dids[0].address, badSignature)
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    describe("Name Length Test", () => {
      it("Failed on length 1 & 33", async () => {
        const did = Wallet.createRandom();
        const invalidnames = [
          "a.vda", // length 1
          "abcdefghijklmnopqrstuvwxyz0123456.vda", // length 33
        ];
        for (let i = 0; i < invalidnames.length; i++) {
          const name = invalidnames[i];
          const signature = await getRegisterSignature(name, did);
          await expect(
            contract.register(name, did.address, signature)
          ).to.be.revertedWithCustomError(contract, "InvalidName");
        }
      });

      it("Success on length 2 & 32", async () => {
        const names = [
          "ab.vda", // length 2
          "abcdefghijklmnopqrstuvwxyz012345.vda", // length 32
        ];
        for (let i = 0; i < names.length; i++) {
          const did = Wallet.createRandom();
          const name = names[i];
          const signature = await getRegisterSignature(name, did);
          await contract.register(name, did.address, signature);

          expect(await contract.findDID(name)).to.be.eq(did.address);
        }
      });
    });

    it("Register one username successfully", async () => {
      const signature = await getRegisterSignature(testNames[0], dids[0]);

      await contract.register(testNames[0], dids[0].address, signature);
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        1
      );
    });

    it("Failed : Name already registered", async () => {
      let signature = await getRegisterSignature(testNames[0], dids[0]);
      await expect(
        contract.register(testNames[0], dids[0].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidName");

      await expect(
        contract
          .connect(accountList[1])
          .register(testNames[0], dids[0].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidName");

      signature = await getRegisterSignature(testNames[0], dids[1]);
      await expect(
        contract.register(testNames[0], dids[1].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidName");

      await expect(
        contract
          .connect(accountList[1])
          .register(testNames[0], dids[1].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidName");
    });
  });

  describe("Max names per DID", () => {
    it("Add mutiple user names failed : MaxNaemsPerDID", async () => {
      expect((await contract.maxNamesPerDID()).toNumber()).to.be.eq(1);

      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        1
      );

      const signature = await getRegisterSignature(testNames[1], dids[0]);
      await expect(
        contract.register(testNames[1], dids[0].address, signature)
      ).to.be.revertedWithCustomError(contract, "LimitedNameCount");
    });

    it("Update MaxNamesPerDID failed : non-owner", async () => {
      await expect(
        contract.connect(accountList[1]).updateMaxNamesPerDID(5)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Update MaxNamesPerDID Success", async () => {
      await contract.updateMaxNamesPerDID(5);
      expect(await contract.maxNamesPerDID()).to.be.eq(5);
    });

    it("Add multiple user names successfully", async () => {
      expect(
        (await contract.maxNamesPerDID()).toNumber()
      ).to.be.greaterThanOrEqual(3);

      let signature = await getRegisterSignature(testNames[1], dids[0]);
      await contract.register(testNames[1], dids[0].address, signature);
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        2
      );

      signature = await getRegisterSignature(testNames[2], dids[0]);
      await contract.register(testNames[2], dids[0].address, signature);
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        3
      );
    });
  });

  describe("Find DID", () => {
    it("Failed : Unregistered name", async () => {
      await expect(
        contract.findDID(testNames[3])
      ).to.be.revertedWithCustomError(contract, "InvalidName");

      await expect(
        contract.connect(accountList[1]).findDID(testNames[3])
      ).to.be.revertedWithCustomError(contract, "InvalidName");
    });

    it("Successfully get DID", async () => {
      expect(await contract.findDID(testNames[0])).to.equal(dids[0].address);
      expect(await contract.findDID(testNames[1])).to.equal(dids[0].address);
      expect(await contract.findDID(testNames[2])).to.equal(dids[0].address);
    });
  });

  describe("getUserNameList", () => {
    it("Failed : No registered DID", async () => {
      // This happens when user unregister all user names.
      let signature = await getRegisterSignature(testNames[3], dids[1]);
      await contract
        .connect(accountList[1])
        .register(testNames[3], dids[1].address, signature);

      signature = await getRegisterSignature(testNames[3], dids[1]);
      await contract
        .connect(accountList[1])
        .unregister(testNames[3], dids[1].address, signature);

      await expect(
        contract.connect(accountList[1]).getUserNameList(dids[1].address)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    });

    it("Successfully get username list", async () => {
      const result = await contract.getUserNameList(dids[0].address);
      expect(result.length).to.be.eq(3);
    });
  });

  describe("Unregister", () => {
    it("Failed : Unregistered name", async () => {
      const signature = await getRegisterSignature(testNames[3], dids[0]);
      await expect(
        contract.unregister(testNames[3], dids[0].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidName");
    });

    it("Failed : Invalid DID", async () => {
      let signature = await getRegisterSignature(testNames[0], dids[1]);
      await expect(
        contract
          .connect(accountList[1])
          .unregister(testNames[0], dids[1].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");

      signature = await getRegisterSignature(testNames[0], dids[2]);
      await expect(
        contract
          .connect(accountList[1])
          .unregister(testNames[0], dids[2].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");

      signature = await getRegisterSignature(testNames[1], dids[2]);
      await expect(
        contract
          .connect(accountList[1])
          .unregister(testNames[1], dids[2].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    });

    it("Successfully unregistered", async () => {
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        3
      );

      let signature = await getRegisterSignature(testNames[0], dids[0]);
      await contract.unregister(testNames[0], dids[0].address, signature);
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        2
      );

      signature = await getRegisterSignature(testNames[1], dids[0]);
      await contract.unregister(testNames[1], dids[0].address, signature);
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        1
      );

      signature = await getRegisterSignature(testNames[2], dids[0]);
      await contract.unregister(testNames[2], dids[0].address, signature);
      await expect(
        contract.getUserNameList(dids[0].address)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    });
  });

  describe("Add suffix", () => {
    it("Failed : Not a owner", async () => {
      await expect(
        contract.connect(accountList[1]).addSufix(newSuffix)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Add sufix successfully", async () => {
      let signature = await getRegisterSignature(testNames[4], dids[0]);
      // Register names failed before adding suffix
      await expect(
        contract.register(testNames[4], dids[0].address, signature)
      ).to.be.revertedWithCustomError(contract, "InvalidSuffix");

      // Register new suffix
      await contract.addSufix(newSuffix);

      // Register naems success after adding suffix
      signature = await getRegisterSignature(testNames[4], dids[0]);
      await contract.register(testNames[4], dids[0].address, signature);

      signature = await getRegisterSignature(testNames[4], dids[0]);
      await contract.unregister(testNames[4], dids[0].address, signature);
    });
  });
});
