// noinspection DuplicatedCode

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ContractTransaction } from "ethers";
import { Block, Log } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  arrayify,
  formatBytes32String,
  hexZeroPad,
  parseBytes32String,
  toUtf8Bytes,
} from "ethers/lib/utils";

import {
  DIDAttributeChangedEvent,
  DIDDelegateChangedEvent,
  DIDOwnerChangedEvent
} from "../typechain/VeridaDIDRegistry";

import { VeridaDIDRegistry } from "../typechain";

import EncryptionUtils from '@verida/encryption-utils'

chai.use(chaiAsPromised);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ethers } = require("hardhat");

import { Wallet } from 'ethers'

const createVeridaSign = (rawMsg : any, privateKey: String ) => {
  const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
  return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

describe("ERC1056", () => {
  let didReg: VeridaDIDRegistry;
  const identity = Wallet.createRandom()
  const badSigner = Wallet.createRandom()

  const did = identity.address
  
  before(async () => {
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
    didReg = await DIDRegistryFactory.deploy();
    await didReg.deployed();
  });
 
  describe("identityOwner()", () => {
    const orgOwner = Wallet.createRandom()
    const newOwner = Wallet.createRandom()
    const testDID = orgOwner.address

    describe("default owner", () => {
      it("should return the identity address itself", async () => {
        const owner = await didReg.identityOwner(testDID);
        expect(owner).to.equal(orgOwner.address);
      });
    });

    describe("changed owner", () => {
      before(async () => {
        const rawMsg = ethers.utils.solidityPack(
          ['address', 'address'],
          [testDID, newOwner.address]
        )
        const signature = createVeridaSign(rawMsg, orgOwner.privateKey)
        await didReg.changeOwner(testDID, newOwner.address, signature);
      });
      it("should return the chaged owner address", async () => {
        const owner = await didReg.identityOwner(testDID);
        expect(owner).to.equal(newOwner.address);
      });
    });
  });

  describe("changeOwner()", () => {
    const identity1 = Wallet.createRandom();
    const identity2 = Wallet.createRandom();
    const identity3 = Wallet.createRandom();

    const did = identity1.address

    describe("as current owner", () => {
      let tx: ContractTransaction;

      before(async () => {
        const rawMsg = ethers.utils.solidityPack(
          ['address', 'address'],
          [did, identity2.address]
        )

        // Sign by identity1's privateKey
        const veridaSignature = createVeridaSign(rawMsg, identity1.privateKey)
    
        tx = await didReg
          .changeOwner(did, identity2.address, veridaSignature);
      });
      it("should change owner mapping", async () => {
        const owner = await didReg.owners(did);
        expect(owner).to.equal(identity2.address);
      });

      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(did);
        expect(latest).to.equal(tx.blockNumber);
      });
      it("should create DIDDelegateChanged event", async () => {
        const event = (await tx.wait()).events?.[0] as DIDOwnerChangedEvent;
        expect(event.event).to.equal("DIDOwnerChanged");
        expect(event.args.identity).to.equal(did);
        expect(event.args.owner).to.equal(identity2.address);
        expect(event.args.previousChange.toNumber()).to.equal(0);
      });
    });

    describe("as new owner", () => {
      let tx: ContractTransaction;
      let previousChange: number;
      before(async () => {
        previousChange = (await didReg.changed(identity1.address)).toNumber();

        const rawMsg = ethers.utils.solidityPack(
          ['address', 'address'],
          [did, identity3.address]
        )

        // Sign by Identity2's privatekey
        const veridaSignature = createVeridaSign(rawMsg, identity2.privateKey)

        tx = await didReg
          .changeOwner(did, identity3.address, veridaSignature);
      });
      it("should change owner mapping", async () => {
        const owner = await didReg.owners(did);
        expect(owner).to.equal(identity3.address);
      });
      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(did);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });
      it("should create DIDOwnerChanged event", async () => {
        const event = (await tx.wait()).events?.[0] as DIDOwnerChangedEvent;
        expect(event.event).to.equal("DIDOwnerChanged");
        expect(event.args.identity).to.equal(did);
        expect(event.args.owner).to.equal(identity3.address);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);
      });
    });
  });

  describe("Delegate Test", () => {
    const delegateType = formatBytes32String("attestor")
    const delegate = Wallet.createRandom().address
    const validity = 86400

    describe("addDelegate()", () => {

      it("validDelegate should be false", async () => {
        const valid = await didReg.validDelegate(
          did,
          delegateType,
          delegate
        );
        expect(valid).to.equal(false); // we have not yet assigned delegate correctly
      });

      describe("Correct Signature", () => {
        let tx: ContractTransaction;
        let block: Block;
        let previousChange: number;
        
        before(async () => {
          previousChange = (await didReg.changed(did)).toNumber();

          const rawMsg = ethers.utils.solidityPack(
            ['address', 'bytes32', 'address', 'uint'],
            [did, delegateType, delegate, validity]
          )

          const veridaSignature = createVeridaSign(rawMsg, identity.privateKey)

          tx = await didReg.addDelegate(
              did,
              delegateType,
              delegate,
              validity,
              veridaSignature
            );
          block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
        });
        it("validDelegate should be true", async () => {
          const valid = await didReg.validDelegate(
            did,
            delegateType,
            delegate
          );
          expect(valid).to.equal(true); // assigned delegate correctly
        });
        it("should sets changed to transaction block", async () => {
          const latest = await didReg.changed(did);
          expect(latest).to.equal((await tx.wait()).blockNumber);
        });
        it("should create DIDDelegateChanged event", async () => {
          const event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent;
          expect(event.event).to.equal("DIDDelegateChanged");
          expect(event.args.identity).to.equal(did);
          expect(parseBytes32String(event.args.delegateType)).to.equal(
            "attestor"
          );
          expect(event.args.delegate).to.equal(delegate);
          expect(event.args.validTo.toNumber()).to.equal(block.timestamp + validity);
          expect(event.args.previousChange.toNumber()).to.equal(previousChange);
        });
      });

      describe("Bad Signature", () => {
        it("should fail", async () => {
          const delegate2 = Wallet.createRandom()

          const rawMsg = ethers.utils.solidityPack(
            ['address', 'bytes32', 'address', 'uint'],
            [did, delegateType, delegate2.address, validity]
          )
          
          const veridaSignature = createVeridaSign(rawMsg, badSigner.privateKey)

          await expect(
            didReg
              .addDelegate(
                did,
                delegateType,
                delegate2.address,
                validity,
                veridaSignature
              )
          ).to.be.rejectedWith(/Invalid Signature/);
        });
      });
    });

    describe("revokeDelegate()", () => {

      const rawMsg = ethers.utils.solidityPack(
        ['address', 'bytes32', 'address'],
        [did, delegateType, delegate]
      )
      
      it("validDelegate should be true", async () => {
        const valid = await didReg.validDelegate(
          did,
          delegateType,
          delegate
        );
        expect(valid).to.equal(true); // not yet revoked
      });

      describe("Bad Signature", () => {
        it("should fail", async () => {

          const veridaSignature = createVeridaSign(rawMsg, badSigner.privateKey)
          
          await expect(
            didReg.revokeDelegate(
              did,
              delegateType,
              delegate,
              veridaSignature
            )
          ).to.be.rejectedWith(/Invalid Signature/);
        });
      });

      describe("Correct Signature", () => {
        let tx: ContractTransaction;
        let previousChange: number;
        before(async () => {
          previousChange = (await didReg.changed(did)).toNumber();

          // Sign by identity1's privateKey
          const veridaSignature = createVeridaSign(rawMsg, identity.privateKey)

          tx = await didReg
            .revokeDelegate(
              did,
              delegateType,
              delegate,
              veridaSignature
            );
        });
        it("validDelegate should be false", async () => {
          const valid = await didReg.validDelegate(
            did,
            delegateType,
            delegate
          );
          expect(valid).to.equal(false); // revoked correctly
        });
        it("should sets changed to transaction block", async () => {
          const latest = await didReg.changed(did);
          expect(latest).to.equal((await tx.wait()).blockNumber);
        });
        it("should create DIDDelegateChanged event", async () => {
          const event = (await tx.wait())
            .events?.[0] as DIDDelegateChangedEvent;
          expect(event.event).to.equal("DIDDelegateChanged");
          expect(event.args.identity).to.equal(did);
          expect(parseBytes32String(event.args.delegateType)).to.equal(
            "attestor"
          );
          expect(event.args.delegate).to.equal(delegate);
          expect(event.args.validTo.toNumber()).to.be.lessThanOrEqual(
            (await ethers.provider.getBlock(tx.blockNumber)).timestamp
          );
          expect(event.args.previousChange.toNumber()).to.equal(previousChange);
        });
      });
    });
  });

  describe("Attribute test", () => {
    const attrName = formatBytes32String("encryptionKey")
    const attrValue = toUtf8Bytes("mykey")
    const validity = 86400

    describe("setAttribute()", () => {
      
      const rawMsg = ethers.utils.solidityPack(
        ['address', 'bytes32', 'bytes', 'uint'],
        [did, attrName, attrValue, validity]
      )

      describe("Bad Signature", () => {
        it("should fail", async () => {
          
          const veridaSignature = createVeridaSign(rawMsg, badSigner.privateKey)

          await expect(
            didReg
              .setAttribute(
                did,
                attrName,
                attrValue,
                validity,
                veridaSignature
              )
          ).to.be.rejectedWith(/Invalid Signature/);
        });
      });

      describe("Correct Signature", () => {
        let tx: ContractTransaction;
        let block: Block;
        let previousChange: number;

        before(async () => {
          previousChange = (await didReg.changed(did)).toNumber();

          const veridaSignature = createVeridaSign(rawMsg, identity.privateKey)
          
          tx = await didReg.setAttribute(
              did,
              attrName,
              attrValue,
              validity,
              veridaSignature
            );
          block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
        });
        it("should sets changed to transaction block", async () => {
          const latest = await didReg.changed(did);
          expect(latest).to.equal((await tx.wait()).blockNumber);
        });
        it("should create DIDAttributeChanged event", async () => {
          const event = (await tx.wait()).events?.[0] as DIDAttributeChangedEvent;
          expect(event.event).to.equal("DIDAttributeChanged");
          expect(event.args.identity).to.equal(did);
          expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
          expect(event.args.value).to.equal("0x6d796b6579"); // the hex encoding of the string "mykey"
          expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
          expect(event.args.previousChange.toNumber()).to.equal(previousChange);
        });
      });
    });

    describe("revokeAttribute()", () => {

      const rawMsg = ethers.utils.solidityPack(
        ['address', 'bytes32', 'bytes'],
        [did, attrName, attrValue]
      )

      describe("Bad Signature", () => {
        it("should fail", async () => {

          const veridaSignature = createVeridaSign(rawMsg, badSigner.privateKey)

          await expect(didReg.revokeAttribute(
              did,
              attrName,
              attrValue,
              veridaSignature
            )
          ).to.be.rejectedWith(/Invalid Signature/);
        });
      });

      describe("Correct Signature", () => {
        let tx: ContractTransaction;
        let previousChange: number;
        before(async () => {
          previousChange = (await didReg.changed(did)).toNumber();

          const veridaSignature = createVeridaSign(rawMsg, identity.privateKey)
          
          tx = await didReg.revokeAttribute(
            did,
            attrName,
            attrValue,
            veridaSignature
          );
        });
        it("should sets changed to transaction block", async () => {
          const latest = await didReg.changed(did);
          expect(latest).to.equal((await tx.wait()).blockNumber);
        });
        it("should create DIDAttributeChanged event", async () => {
          const event = (await tx.wait()).events?.[0] as DIDAttributeChangedEvent;
          expect(event.event).to.equal("DIDAttributeChanged");
          expect(event.args.identity).to.equal(did);
          expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
          expect(event.args.value).to.equal("0x6d796b6579"); // hex encoding of the string "mykey"
          expect(event.args.validTo.toNumber()).to.equal(0);
          expect(event.args.previousChange.toNumber()).to.equal(previousChange);
        });
      });
    });
  })
  
  describe("Events", () => {
    it("can create list", async () => {
      const history = [];
      let prevChange: number = (
        await didReg.changed(did)
      ).toNumber();
      while (prevChange) {
        const logs: Log[] = await ethers.provider.getLogs({
          topics: [null, hexZeroPad(did, 32)],
          fromBlock: prevChange,
          toBlock: prevChange,
        });
        prevChange = 0;
        for (const log of logs) {
          const logDescription = didReg.interface.parseLog(log);
          history.unshift(logDescription.name);
          prevChange = logDescription.args.previousChange.toNumber();
        }
      }
      expect(history).to.deep.equal([
        // "DIDOwnerChanged", //Tested with another DID
        // "DIDOwnerChanged", //Tested with another DID
        "DIDDelegateChanged",
        "DIDDelegateChanged",
        "DIDAttributeChanged",
        "DIDAttributeChanged",
      ]);
    });
  });
});
