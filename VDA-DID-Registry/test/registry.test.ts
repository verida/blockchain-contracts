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

  before(async () => {
    const Registry = await ethers.getContractFactory("VeridaDIDRegistry");
    didReg = await Registry.deploy();
    await didReg.deployed();
    [identity, identity2, delegate, delegate2, delegate3, badBoy] =
      await ethers.getSigners();

    const accountList = await ethers.getSigners();
    for (const item of accountList) {
      console.log(item.address);
    }
  });

  const testSignature = arrayify(
    "0x67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c"
  );

  const badSignature = arrayify(
    "0xf157fd349172fa8bb84710d871724091947289182373198723918cabcc888ef888ff8876956050565d5757a57d868b8676876e7678687686f95419238191488923"
  );

  describe("identityOwner()", () => {
    describe("default owner", () => {
      it("should return the identity address itself", async () => {
        const owner = await didReg.identityOwner(identity2.address);
        expect(owner).to.equal(identity2.address);
      });
    });

    describe("changed owner", () => {
      before(async () => {
        await didReg
          .connect(identity2)
          .changeOwner(identity2.address, delegate.address, testSignature);
      });
      it("should return the delegate address", async () => {
        const owner = await didReg.identityOwner(identity2.address);
        expect(owner).to.equal(delegate.address);
      });
    });
  });

  describe("changeOwner()", () => {
    describe("as current owner", () => {
      let tx: ContractTransaction;
      before(async () => {
        tx = await didReg
          .connect(identity)
          .changeOwner(identity.address, delegate.address, testSignature);
      });
      it("should change owner mapping", async () => {
        const owner = await didReg.owners(identity.address);
        expect(owner).to.equal(delegate.address);
      });
      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(identity.address);
        expect(latest).to.equal(tx.blockNumber);
      });
      it("should create DIDDelegateChanged event", async () => {
        const event = (await tx.wait()).events?.[0] as DIDOwnerChangedEvent;
        expect(event.event).to.equal("DIDOwnerChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(event.args.owner).to.equal(delegate.address);
        expect(event.args.previousChange.toNumber()).to.equal(0);
      });
    });

    describe("as new owner", () => {
      let tx: ContractTransaction;
      let previousChange: number;
      before(async () => {
        previousChange = (await didReg.changed(identity.address)).toNumber();
        tx = await didReg
          .connect(delegate)
          .changeOwner(identity.address, delegate2.address, testSignature);
      });
      it("should change owner mapping", async () => {
        const owner = await didReg.owners(identity.address);
        expect(owner).to.equal(delegate2.address);
      });
      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(identity.address);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });
      it("should create DIDOwnerChanged event", async () => {
        const event = (await tx.wait()).events?.[0] as DIDOwnerChangedEvent;
        expect(event.event).to.equal("DIDOwnerChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(event.args.owner).to.equal(delegate2.address);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);
      });
    });
  });

  describe("addDelegate()", () => {
    it("validDelegate should be false", async () => {
      const valid = await didReg.validDelegate(
        identity.address,
        formatBytes32String("attestor"),
        delegate3.address
      );
      expect(valid).to.equal(false); // we have not yet assigned delegate correctly
    });

    describe("Correct Signature", () => {
      let tx: ContractTransaction;
      let block: Block;
      let previousChange: number;
      before(async () => {
        previousChange = (await didReg.changed(identity.address)).toNumber();
        tx = await didReg
          .connect(delegate2)
          .addDelegate(
            identity.address,
            formatBytes32String("attestor"),
            delegate3.address,
            86400,
            testSignature
          );
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
        const event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor"
        );
        expect(event.args.delegate).to.equal(delegate3.address);
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);
      });
    });

    describe("Bad Signature - as original owner", () => {
      it("should fail", async () => {
        const currentOwnerAddress = await didReg.owners(identity.address);
        expect(currentOwnerAddress).not.to.equal(identity.address);
        await expect(
          didReg
            .connect(identity)
            .addDelegate(
              identity.address,
              formatBytes32String("attestor"),
              badBoy.address,
              86400,
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });

    describe("Bad Signature - as attacker", () => {
      it("should fail", async () => {
        await expect(
          didReg
            .connect(badBoy)
            .addDelegate(
              identity.address,
              formatBytes32String("attestor"),
              badBoy.address,
              86400,
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });
  });

  describe("revokeDelegate()", () => {
    it("validDelegate should be true", async () => {
      const valid = await didReg.validDelegate(
        identity.address,
        formatBytes32String("attestor"),
        delegate3.address
      );
      expect(valid).to.equal(true); // not yet revoked
    });

    describe("Correct Signature", () => {
      let tx: ContractTransaction;
      let previousChange: number;
      before(async () => {
        previousChange = (await didReg.changed(identity.address)).toNumber();
        tx = await didReg
          .connect(delegate2)
          .revokeDelegate(
            identity.address,
            formatBytes32String("attestor"),
            delegate3.address,
            testSignature
          );
      });
      it("validDelegate should be false", async () => {
        const valid = await didReg.validDelegate(
          identity.address,
          formatBytes32String("attestor"),
          delegate3.address
        );
        expect(valid).to.equal(false); // revoked correctly
      });
      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(identity.address);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });
      it("should create DIDDelegateChanged event", async () => {
        const event = (await tx.wait())
          .events?.[0] as DIDDelegateChangedEvent;
        expect(event.event).to.equal("DIDDelegateChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.delegateType)).to.equal(
          "attestor"
        );
        expect(event.args.delegate).to.equal(delegate3.address);
        expect(event.args.validTo.toNumber()).to.be.lessThanOrEqual(
          (await ethers.provider.getBlock(tx.blockNumber)).timestamp
        );
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);
      });
    });

    describe("Bad Signature - as original owner", () => {
      it("should fail", async () => {
        const currentOwnerAddress = await didReg.owners(identity.address);
        expect(currentOwnerAddress).not.to.equal(identity.address);
        await expect(
          didReg
            .connect(identity)
            .revokeDelegate(
              identity.address,
              formatBytes32String("attestor"),
              badBoy.address,
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });

    describe("Bad Signature - as attacker", () => {
      it("should fail", async () => {
        await expect(
          didReg
            .connect(badBoy)
            .revokeDelegate(
              identity.address,
              formatBytes32String("attestor"),
              badBoy.address,
              badSignature
            )
        ).to.be.revertedWith("bad_actor");
      });
    });
  });

  describe("setAttribute()", () => {
    describe("Correct Signature", () => {
      let tx: ContractTransaction;
      let block: Block;
      let previousChange: number;
      before(async () => {
        previousChange = (await didReg.changed(identity.address)).toNumber();
        const currentOwnerAddress = await didReg.owners(identity.address);
        const signer = (await ethers.getSigners()).find(
          (signer: SignerWithAddress) => signer.address === currentOwnerAddress
        );
        tx = await didReg
          .connect(signer)
          .setAttribute(
            identity.address,
            formatBytes32String("encryptionKey"),
            toUtf8Bytes("mykey"),
            86400,
            testSignature
          );
        block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      });
      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(identity.address);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });
      it("should create DIDAttributeChanged event", async () => {
        const event = (await tx.wait()).events?.[0] as DIDAttributeChangedEvent;
        expect(event.event).to.equal("DIDAttributeChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
        expect(event.args.value).to.equal("0x6d796b6579"); // the hex encoding of the string "mykey"
        expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);
      });
    });

    describe("Bad Signature - as original owner", () => {
      it("should fail", async () => {
        const currentOwnerAddress = await didReg.owners(identity.address);
        expect(currentOwnerAddress).not.to.equal(identity.address);
        await expect(
          didReg
            .connect(identity)
            .setAttribute(
              identity.address,
              formatBytes32String("encryptionKey"),
              toUtf8Bytes("mykey"),
              86400,
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });

    describe("Bad Signature - as attacker", () => {
      it("should fail", async () => {
        await expect(
          didReg
            .connect(badBoy)
            .setAttribute(
              identity.address,
              formatBytes32String("encryptionKey"),
              toUtf8Bytes("mykey"),
              86400,
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });
  });

  describe("revokeAttribute()", () => {
    describe("Correct Signature", () => {
      let tx: ContractTransaction;
      let previousChange: number;
      before(async () => {
        previousChange = (await didReg.changed(identity.address)).toNumber();
        const currentOwnerAddress = await didReg.owners(identity.address);
        const signer = (await ethers.getSigners()).find(
          (signer: SignerWithAddress) => signer.address === currentOwnerAddress
        );
        tx = await didReg
          .connect(signer)
          .revokeAttribute(
            identity.address,
            formatBytes32String("encryptionKey"),
            toUtf8Bytes("mykey"),
            testSignature
          );
      });
      it("should sets changed to transaction block", async () => {
        const latest = await didReg.changed(identity.address);
        expect(latest).to.equal((await tx.wait()).blockNumber);
      });
      it("should create DIDAttributeChanged event", async () => {
        const event = (await tx.wait()).events?.[0] as DIDAttributeChangedEvent;
        expect(event.event).to.equal("DIDAttributeChanged");
        expect(event.args.identity).to.equal(identity.address);
        expect(parseBytes32String(event.args.name)).to.equal("encryptionKey");
        expect(event.args.value).to.equal("0x6d796b6579"); // hex encoding of the string "mykey"
        expect(event.args.validTo.toNumber()).to.equal(0);
        expect(event.args.previousChange.toNumber()).to.equal(previousChange);
      });
    });

    describe("Bad Signature - as original owner", () => {
      it("should fail", async () => {
        const currentOwnerAddress = await didReg.owners(identity.address);
        expect(currentOwnerAddress).not.to.equal(identity.address);
        await expect(
          didReg
            .connect(identity)
            .revokeAttribute(
              identity.address,
              formatBytes32String("encryptionKey"),
              toUtf8Bytes("mykey"),
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });

    describe("Bad Signature - as attacker", () => {
      it("should fail", async () => {
        await expect(
          didReg
            .connect(badBoy)
            .revokeAttribute(
              identity.address,
              formatBytes32String("encryptionKey"),
              toUtf8Bytes("mykey"),
              badSignature
            )
        ).to.be.rejectedWith(/bad_actor/);
      });
    });
  });

  describe("Events", () => {
    it("can create list", async () => {
      const history = [];
      let prevChange: number = (
        await didReg.changed(identity.address)
      ).toNumber();
      while (prevChange) {
        const logs: Log[] = await ethers.provider.getLogs({
          topics: [null, hexZeroPad(identity.address, 32)],
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
        "DIDOwnerChanged",
        "DIDOwnerChanged",
        "DIDDelegateChanged",
        "DIDDelegateChanged",
        "DIDAttributeChanged",
        "DIDAttributeChanged",
      ]);
    });
  });
});
