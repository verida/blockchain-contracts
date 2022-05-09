import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumberish, ContractTransaction } from "ethers";
import { Block, Log } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  arrayify,
  BytesLike,
  concat,
  formatBytes32String,
  hexConcat,
  hexlify,
  hexZeroPad,
  keccak256,
  parseBytes32String,
  SigningKey,
  toUtf8Bytes,
  zeroPad,
} from "ethers/lib/utils";

import hre from "hardhat";

import {
  DIDAttributeChangedEvent,
  DIDDelegateChangedEvent,
  DIDOwnerChangedEvent,
  VeridaDIDRegistry,
} from "../typechain/VeridaDIDRegistry";

chai.use(chaiAsPromised);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ethers } = require("hardhat");

describe("ERC1056", () => {
  let didReg: VeridaDIDRegistry;
  let identity: SignerWithAddress; // = accounts[0];
  let identity2: SignerWithAddress; // = accounts[1];
  let delegate: SignerWithAddress; // = accounts[2];
  let delegate2: SignerWithAddress; // = accounts[3];
  let delegate3: SignerWithAddress; // = accounts[4];
  let badBoy: SignerWithAddress; // = accounts[5];

  const testSignature = arrayify(
    "0x67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c"
  );

  const badSignature = arrayify(
    "0xf157fd349172fa8bb84710d871724091947289182373198723918cabcc888ef888ff8876956050565d5757a57d868b8676876e7678687686f95419238191488923"
  );

  before(async () => {
    await hre.network.provider.send("hardhat_reset");
    const Registry = await ethers.getContractFactory("VeridaDIDRegistry");
    didReg = await Registry.deploy();
    await didReg.deployed();
    [identity, identity2, delegate, delegate2, delegate3, badBoy] =
      await ethers.getSigners();
  });

  describe("bulkAdd()", () => {
    let tx: ContractTransaction;
    let block: Block;
    let previousChange: number;

    const delegateParams: {
      delegateType: BytesLike;
      delegate: string;
      validity: BigNumberish;
    }[] = [];
    const attributeParams: {
      name: BytesLike;
      value: BytesLike;
      validity: BigNumberish;
    }[] = [];

    before(async () => {
      delegateParams.push({
        delegateType: formatBytes32String("attestor"),
        delegate: delegate3.address,
        validity: 86400,
      });

      delegateParams.push({
        delegateType: formatBytes32String("attestor-2"),
        delegate: delegate2.address,
        validity: 86400,
      });

      attributeParams.push({
        name: formatBytes32String("encryptionKey"),
        value: toUtf8Bytes("mykey"),
        validity: 86400,
      });
    });

    describe("Correct Signature", async () => {
      before(async () => {
        previousChange = (await didReg.changed(identity.address)).toNumber();
        tx = await didReg
          .connect(identity)
          .bulkAdd(
            identity.address,
            delegateParams,
            attributeParams,
            testSignature
          );
        console.log("bulkAdd TX:", tx)
        block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      });

      it("validDelegate should be true", async () => {
        const valid = await didReg.validDelegate(
          identity.address,
          formatBytes32String("attestor"),
          delegate3.address
        );
        expect(valid).to.equal(true); // assigned delegate correctly
      });

      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(identity.address);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });

      it("should create DIDDelegateChanged event", async () => {
        let event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor"
        );
        expect(event.args.delegate).to.equal(delegate3.address);
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);

        event = (await tx.wait()).events?.[1] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor-2"
        );
        expect(event.args.delegate).to.equal(delegate2.address);
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
      });

      it("should create DIDAttributeChanged event", async () => {
        const event = (await tx.wait()).events?.[2] as DIDAttributeChangedEvent;
        expect(event.event).to.equal("DIDAttributeChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
        expect(event.args.value).to.equal("0x6d796b6579"); // the hex encoding of the string "mykey"
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
      });
    });

    describe("Bad Signature", async () => {
      it("Should fail", async () => {
        await expect(
          didReg
            .connect(identity)
            .bulkAdd(
              identity.address,
              delegateParams,
              attributeParams,
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });
  });
});
