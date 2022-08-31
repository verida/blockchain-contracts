import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumberish, ContractTransaction } from "ethers";
import { Block } from "@ethersproject/providers";
import {
  BytesLike,
  formatBytes32String,
  parseBytes32String,
  toUtf8Bytes,
} from "ethers/lib/utils";

import hre from "hardhat";

import {
  DIDAttributeChangedEvent,
  DIDDelegateChangedEvent,
  VeridaDIDRegistry,
} from "../typechain/VeridaDIDRegistry";

import { Wallet } from 'ethers'
import EncryptionUtils from '@verida/encryption-utils'

chai.use(chaiAsPromised);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ethers } = require("hardhat");

const identity = Wallet.createRandom()
const badSigner = Wallet.createRandom()

const did = identity.address

let didReg: VeridaDIDRegistry;

const createVeridaSign = async (rawMsg : any, privateKey: String ) => {
  const nonce = (await didReg.getNonce(did)).toNumber()
  rawMsg = ethers.utils.solidityPack(
    ['bytes','uint256'],
    [rawMsg, nonce]
  )

  const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
  return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

const createProofSign = async (rawMsg : any, privateKey: String ) => {
  const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
  return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("ERC1056", () => {
  
  // Test Datas
  const validity = 86400

  const delegates = [Wallet.createRandom().address, Wallet.createRandom().address]
  const delegateTypes = [
    formatBytes32String("attestor"),
    formatBytes32String("attestor-2")
  ]

  const attrNames = [formatBytes32String("encryptionKey")]
  const attrVals = [toUtf8Bytes("mykey")]
  
  before(async () => {
    await hre.network.provider.send("hardhat_reset");

    /*
    //// Deploy when library contains public functions
    // Deploy Library
    const verifyLibFactory = await ethers.getContractFactory("VeridaDataVerificationLib");
    const verifyLib = await verifyLibFactory.deploy();
    await verifyLib.deployed();

    // Deploy Contract
    const DIDRegistryFactory = await ethers.getContractFactory("VeridaDIDRegistry", {
      libraries: {
        VeridaDataVerificationLib: verifyLib.address
      }
    });
    */

    // Deploy Contract
    const DIDRegistryFactory = await ethers.getContractFactory("VeridaDIDRegistry");
    didReg = await DIDRegistryFactory.deploy();
    await didReg.deployed();
    
  });

  describe("bulkAdd()", () => {
    let tx: ContractTransaction;
    let block: Block;
    let previousChange: number;
    let rawMsg: any;

    const proofProvider = Wallet.createRandom()

    const delegateParams: {
      delegateType: BytesLike;
      delegate: string;
      validity: BigNumberish;
    }[] = [];
    const attributeParams: {
      name: BytesLike;
      value: BytesLike;
      validity: BigNumberish;
      proof: string;
    }[] = [];

    before(async () => {
      // Create input param
      const proofRawMsg = ethers.utils.solidityPack(
        ['address', 'address'],
        [did, proofProvider.address]
      )
      const proofSignature = await createProofSign(proofRawMsg, identity.privateKey)

      for (let i = 0; i < delegates.length; i++) {
        delegateParams.push({
          delegateType: delegateTypes[i],
          delegate: delegates[i],
          validity
        })
      }
      for (let i = 0; i < attrNames.length; i++) {
        attributeParams.push({
          name: attrNames[i],
          value: attrVals[i],
          validity: 86400,
          proof: proofSignature
        });
      }

      // Create raw message for input param
      rawMsg = ethers.utils.solidityPack(['address'], [did])
      delegateParams.forEach(item => {
        rawMsg = ethers.utils.solidityPack(
          ['bytes','bytes32','address','uint'],
          [rawMsg, item.delegateType, item.delegate, item.validity]
        )
      })

      attributeParams.forEach(item => {
        rawMsg = ethers.utils.solidityPack(
          ['bytes','bytes32','bytes','uint','bytes'],
          [rawMsg, item.name, item.value, item.validity, item.proof]
        )
      })
    });

    describe("Correct Signature", async () => {
      before(async () => {
        previousChange = (await didReg.changed(did)).toNumber();

        const veridaSignature = await createVeridaSign(rawMsg, identity.privateKey)

        tx = await didReg.bulkAdd(
          did,
          delegateParams,
          attributeParams,
          veridaSignature
        );
        block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      });

      it("validDelegate should be true", async () => {
        for (let i = 0; i < delegates.length; i++) {
          const valid = await didReg.validDelegate(
            did,
            delegateTypes[i],
            delegates[i]
          );
          expect(valid).to.equal(true); // assigned delegate correctly
        }
      });

      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(did);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });

      it("should create DIDDelegateChanged event", async () => {
        let event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(did);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor"
        );
        expect(event.args.delegate).to.equal(delegates[0]);
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);

        event = (await tx.wait()).events?.[1] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(did);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor-2"
        );
        expect(event.args.delegate).to.equal(delegates[1]);
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
      });

      it("should create DIDAttributeChanged event", async () => {
        const event = (await tx.wait()).events?.[2] as DIDAttributeChangedEvent;
        expect(event.event).to.equal("DIDAttributeChanged");
        expect(event.args.identity).to.equal(did);
        expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
        expect(event.args.value).to.equal("0x6d796b6579"); // the hex encoding of the string "mykey"
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
      });
    });

    describe("Should fail", async () => {
      it("Invalid Signature", async () => {
        const veridaSignature = await createVeridaSign(rawMsg, badSigner.privateKey)
        await expect(
          didReg.bulkAdd(
            did,
            delegateParams,
            attributeParams,
            veridaSignature
          )
        ).to.be.rejectedWith(/Invalid Signature/);
      });
    });
  });

  describe("bulkRevoke()", () => {
    let tx: ContractTransaction;
    let block: Block;
    let previousChange: number;
    let rawMsg: any;

    const revokeDelegateParams: {
      delegateType: BytesLike;
      delegate: string;
    }[] = [];
    const revokeAttributeParams: {
      name: BytesLike;
      value: BytesLike;
    }[] = [];

    before(async () => {
      // Create input param
      for (let i = 0; i < delegates.length; i++) {
        revokeDelegateParams.push({
          delegateType: delegateTypes[i],
          delegate: delegates[i]
        })
      }
      for (let i = 0; i < attrNames.length; i++) {
        revokeAttributeParams.push({
          name: attrNames[i],
          value: attrVals[i],
        });
      }

      // Create raw message for input param
      rawMsg = ethers.utils.solidityPack(['address'], [did])
      revokeDelegateParams.forEach(item => {
        rawMsg = ethers.utils.solidityPack(
          ['bytes','bytes32','address'],
          [rawMsg, item.delegateType, item.delegate]
        )
      })

      revokeAttributeParams.forEach(item => {
        rawMsg = ethers.utils.solidityPack(
          ['bytes','bytes32','bytes'],
          [rawMsg, item.name, item.value]
        )
      })
    });

    it("validDelegate should be true", async () => {
      for (let i = 0; i < delegates.length; i++) {
        const valid = await didReg.validDelegate(
          did,
          delegateTypes[i],
          delegates[i]
        );
        expect(valid).to.equal(true);
      }
    });

    describe("Should fail", async () => {
      it("Invalid Signature", async () => {
        const veridaSignature = await createVeridaSign(rawMsg, badSigner.privateKey)
        await expect(
          didReg.bulkRevoke(
            did,
            revokeDelegateParams,
            revokeAttributeParams,
            veridaSignature
          )
        ).to.be.rejectedWith(/Invalid Signature/);
      });
    });

    describe("Correct Signature", async () => {
      before(async () => {
        previousChange = (await didReg.changed(did)).toNumber();

        const veridaSignature = await createVeridaSign(rawMsg, identity.privateKey)

        tx = await didReg.bulkRevoke(
          did,
          revokeDelegateParams,
          revokeAttributeParams,
          veridaSignature
        );
        block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      });

      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(did);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });

      it("validDelegate should be false", async () => {
        for (let i = 0; i < delegates.length; i++) {
          const valid = await didReg.validDelegate(
            did,
            delegateTypes[i],
            delegates[i]
          );
          expect(valid).to.equal(false);
        }
      });

      it("should create DIDDelegateChanged event", async () => {
        let event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(did);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor"
        );
        expect(event.args.delegate).to.equal(delegates[0]);
        expect(event.args.validTo.toNumber()).to.be.lessThanOrEqual(
          (await ethers.provider.getBlock(tx.blockNumber)).timestamp
        );
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange);

        event = (await tx.wait()).events?.[1] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(did);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor-2"
        );
        expect(event.args.delegate).to.equal(delegates[1]);
        expect(event.args.validTo.toNumber()).to.be.lessThanOrEqual(
          (await ethers.provider.getBlock(tx.blockNumber)).timestamp
        );
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
      });

      it("should create DIDAttributeChanged event", async () => {
        const event = (await tx.wait()).events?.[2] as DIDAttributeChangedEvent;
        expect(event.event).to.equal("DIDAttributeChanged");
        expect(event.args.identity).to.equal(did);
        expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
        expect(event.args.value).to.equal("0x6d796b6579"); // the hex encoding of the string "mykey"
        expect(event.args.validTo.toNumber()).to.equal(0);
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
      });
    });

    
  });
});
