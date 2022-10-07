import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import hre, { ethers, upgrades } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { NameRegistry } from "../typechain";

import { formatBytes32String } from "ethers/lib/utils";

import EncryptionUtils from "@verida/encryption-utils";
import { Wallet } from "ethers";

chai.use(solidity);
chai.use(chaiAsPromised);

let contract: NameRegistry;

const dids = [
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
];

const paramSigner = Wallet.createRandom();
const badSigner = Wallet.createRandom();

const createVeridaSign = async (
  rawMsg: any,
  privateKey: string,
  docDID: string
) => {
  if (contract === undefined) return "";

  const nonce = (await contract.getNonce(docDID)).toNumber();
  rawMsg = ethers.utils.solidityPack(["bytes", "uint256"], [rawMsg, nonce]);
  const privateKeyArray = new Uint8Array(
    Buffer.from(privateKey.slice(2), "hex")
  );
  return EncryptionUtils.signData(rawMsg, privateKeyArray);
};

const createProofSign = async (rawMsg: any, privateKey: String) => {
  const privateKeyArray = new Uint8Array(
    Buffer.from(privateKey.slice(2), "hex")
  );
  return EncryptionUtils.signData(rawMsg, privateKeyArray);
};

const getSignatureData = async (name: string, did: Wallet, signer: Wallet) => {
  const rawMsg = ethers.utils.solidityPack(
    ["string", "address"],
    [name, did.address]
  );
  const signature = await createVeridaSign(
    rawMsg,
    signer.privateKey,
    did.address
  );

  const rawProof = ethers.utils.solidityPack(
    ["address", "address"],
    [did.address, signer.address]
  );
  const proof = await createProofSign(rawProof, did.privateKey);

  return { signature, proof };
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
  });

  describe("Register", async () => {
    it("Failed : Invalid zero address", async () => {
      await expect(
        contract.register(
          testNames[0],
          zeroAddress,
          formatBytes32String("Correct signature not working"),
          formatBytes32String("Correct proof not working")
        )
      ).to.be.rejectedWith("Invalid zero address");
    });

    it("Failed : Invalid suffix", async () => {
      const { signature, proof } = await getSignatureData(
        testNames[4],
        dids[0],
        paramSigner
      );

      await expect(
        contract.register(testNames[4], dids[0].address, signature, proof)
      ).to.be.rejectedWith("Invalid suffix");
    });

    it("Failed : Invalid signature", async () => {
      await expect(
        contract.register(
          testNames[0],
          zeroAddress,
          "Invalid signature",
          "Invalid proof"
        )
      ).to.be.rejectedWith("Invalid signature");
    });

    it("Failed : Invalid Proof", async () => {
      const { signature } = await getSignatureData(
        testNames[0],
        dids[0],
        paramSigner
      );

      const rawProof = ethers.utils.solidityPack(
        ["address", "address"],
        [dids[0].address, badSigner.address]
      );
      const proof = await createProofSign(rawProof, dids[0].privateKey);

      await expect(
        contract.register(testNames[0], dids[0].address, signature, proof)
      ).to.be.rejectedWith("Invalid proof");
    });

    it("Register one username successfully", async () => {
      const { signature, proof } = await getSignatureData(
        testNames[0],
        dids[0],
        paramSigner
      );

      await contract.register(testNames[0], dids[0].address, signature, proof);
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        1
      );
    });

    it("Failed: Name already registered", async () => {
      let signs = await getSignatureData(testNames[0], dids[0], paramSigner);
      await expect(
        contract.register(
          testNames[0],
          dids[0].address,
          signs.signature,
          signs.proof
        )
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract
          .connect(accountList[1])
          .register(testNames[0], dids[0].address, signs.signature, signs.proof)
      ).to.be.rejectedWith("Name already registered");

      signs = await getSignatureData(testNames[0], dids[1], paramSigner);
      await expect(
        contract.register(
          testNames[0],
          dids[1].address,
          signs.signature,
          signs.proof
        )
      ).to.be.rejectedWith("Name already registered");

      await expect(
        contract
          .connect(accountList[1])
          .register(testNames[0], dids[1].address, signs.signature, signs.proof)
      ).to.be.rejectedWith("Name already registered");
    });

    it("Add multiple user names successfully", async () => {
      let signs = await getSignatureData(testNames[1], dids[0], paramSigner);

      await contract.register(
        testNames[1],
        dids[0].address,
        signs.signature,
        signs.proof
      );
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        2
      );

      signs = await getSignatureData(testNames[2], dids[0], paramSigner);
      await contract.register(
        testNames[2],
        dids[0].address,
        signs.signature,
        signs.proof
      );
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        3
      );
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
      expect(await contract.findDid(testNames[0])).to.equal(dids[0].address);
      expect(await contract.findDid(testNames[1])).to.equal(dids[0].address);
      expect(await contract.findDid(testNames[2])).to.equal(dids[0].address);
    });
  });

  describe("getUserNameList", async () => {
    it("Failed: No registered DID", async () => {
      // This happens when user unregister all user names.
      let signs = await getSignatureData(testNames[3], dids[1], paramSigner);
      await contract
        .connect(accountList[1])
        .register(testNames[3], dids[1].address, signs.signature, signs.proof);

      signs = await getSignatureData(testNames[3], dids[1], paramSigner);
      await contract
        .connect(accountList[1])
        .unregister(
          testNames[3],
          dids[1].address,
          signs.signature,
          signs.proof
        );

      await expect(
        contract.connect(accountList[1]).getUserNameList(dids[1].address)
      ).to.be.rejectedWith("No registered DID");
    });

    it("Successfully get username list", async () => {
      const result = await contract.getUserNameList(dids[0].address);
      expect(result.length).to.be.eq(3);

      console.log("Returned usernames: ", result);
    });
  });

  describe("Unregister", async () => {
    it("Failed: Unregistered name", async () => {
      const { signature, proof } = await getSignatureData(
        testNames[3],
        dids[0],
        paramSigner
      );
      await expect(
        contract.unregister(testNames[3], dids[0].address, signature, proof)
      ).to.be.rejectedWith("Unregistered name");
    });

    it("Failed: Invalid DID", async () => {
      let signs = await getSignatureData(testNames[0], dids[1], paramSigner);
      await expect(
        contract
          .connect(accountList[1])
          .unregister(
            testNames[0],
            dids[1].address,
            signs.signature,
            signs.proof
          )
      ).to.be.rejectedWith("Invalid DID");

      signs = await getSignatureData(testNames[0], dids[2], paramSigner);
      await expect(
        contract
          .connect(accountList[1])
          .unregister(
            testNames[0],
            dids[2].address,
            signs.signature,
            signs.proof
          )
      ).to.be.rejectedWith("Invalid DID");

      signs = await getSignatureData(testNames[1], dids[2], paramSigner);
      await expect(
        contract
          .connect(accountList[1])
          .unregister(
            testNames[1],
            dids[2].address,
            signs.signature,
            signs.proof
          )
      ).to.be.rejectedWith("Invalid DID");
    });

    it("Successfully unregistered", async () => {
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        3
      );

      let signs = await getSignatureData(testNames[0], dids[0], paramSigner);
      await contract.unregister(
        testNames[0],
        dids[0].address,
        signs.signature,
        signs.proof
      );
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        2
      );

      signs = await getSignatureData(testNames[1], dids[0], paramSigner);
      await contract.unregister(
        testNames[1],
        dids[0].address,
        signs.signature,
        signs.proof
      );
      expect((await contract.getUserNameList(dids[0].address)).length).to.be.eq(
        1
      );

      signs = await getSignatureData(testNames[2], dids[0], paramSigner);
      await contract.unregister(
        testNames[2],
        dids[0].address,
        signs.signature,
        signs.proof
      );
      await expect(
        contract.getUserNameList(dids[0].address)
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
      let signs = await getSignatureData(testNames[4], dids[0], paramSigner);
      // Register names failed before adding suffix
      await expect(
        contract.register(
          testNames[4],
          dids[0].address,
          signs.signature,
          signs.proof
        )
      ).to.be.rejectedWith("Invalid suffix");

      // Register new suffix
      await contract.addSufix(newSuffix);

      // Register naems success after adding suffix
      signs = await getSignatureData(testNames[4], dids[0], paramSigner);
      await contract.register(
        testNames[4],
        dids[0].address,
        signs.signature,
        signs.proof
      );

      signs = await getSignatureData(testNames[4], dids[0], paramSigner);
      await contract.unregister(
        testNames[4],
        dids[0].address,
        signs.signature,
        signs.proof
      );
    });
  });
});
