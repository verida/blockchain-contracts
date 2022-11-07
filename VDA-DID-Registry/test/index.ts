// noinspection DuplicatedCode

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ContractTransaction } from "ethers";
import { Block, Log } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { VeridaDIDRegistry } from "../typechain";

import EncryptionUtils from '@verida/encryption-utils'

import hre, { ethers , upgrades } from "hardhat"
import { Wallet } from 'ethers'

chai.use(chaiAsPromised);

let didReg: VeridaDIDRegistry;
const identity = Wallet.createRandom()
const badSigner = Wallet.createRandom()

const did = identity.address

const endPoints_A = [
  'https://A_1',
  'https://A_2',
  'https://A_3'
]

const endPoints_B = [
  'https://B_1',
  'https://B_2'
]

const createVeridaSign = async (rawMsg : any, privateKey: string, docDID: string = did) => {
  if (didReg === undefined)
    return ''

  const nonce = (await didReg.nonce(docDID)).toNumber()
  rawMsg = ethers.utils.solidityPack(
    ['bytes','uint256'],
    [rawMsg, nonce]
  )
  const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
  return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

const getRegisterSignature = async(did : string, endpoints: string[], signKey: string) => {
  let rawMsg = ethers.utils.solidityPack(
    ['address'],
    [did]
  );

  for (let i = 0; i < endpoints.length; i++) {
    rawMsg = ethers.utils.solidityPack(
      ['bytes', 'string'],
      [rawMsg, endpoints[i]]
    );
  }

  return await createVeridaSign(rawMsg, signKey, did)

}

describe("Verida DIDRegistry", () => {
  
  before(async () => {

    await hre.network.provider.send("hardhat_reset");

    await hre.network.provider.request(
      {
          method: "hardhat_reset",
          params: []
      }
    );

    /*
    ///// Need to link library if library contains public functions
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
    */

    // Deploy Contract
    const DIDRegistryFactory = await ethers.getContractFactory("VeridaDIDRegistry");
    didReg = (await upgrades.deployProxy(
      DIDRegistryFactory,
      {
        initializer: 'initialize'
      }
    )) as VeridaDIDRegistry
    await didReg.deployed();
  });
 
  /*
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
        const signature = await createVeridaSign(rawMsg, orgOwner.privateKey, testDID)
        await didReg.changeOwner(testDID, newOwner.address, signature);
      });
      it("should return the chaged owner address", async () => {
        const owner = await didReg.identityOwner(testDID);
        expect(owner).to.equal(newOwner.address);
      });
    });
  });
  */

  describe("Register", () => {
    it("Failed : Invalid Signature", async () => {
      const signature = await getRegisterSignature(did, endPoints_A, badSigner.privateKey)
      await expect(didReg.register(did, endPoints_A, signature)).to.be.rejectedWith("Invalid Signature");
    })

    it("Success", async () => {
      const signature = await getRegisterSignature(did, endPoints_A, identity.privateKey)
      await expect(didReg.register(did, endPoints_A, signature)).to.emit(didReg, "Register");
    })
  })

  describe("Lookup", () => {
    it("Get endopints registered", async () => {
      const list = await didReg.lookup(did);
      expect(list).to.deep.equal(endPoints_A);
    })

    it("Empty array for unregistered DIDs", async () => {
      const testDID = Wallet.createRandom();
      expect (await didReg.lookup(testDID.address)).to.deep.equal([]);
    })
  })

  describe("Register : Update for already registered DID", async () => {
    it("Check endpoints", async () => {
      expect((await didReg.lookup(did)).length).to.greaterThan(0);
    })

    it("Update with another endpoints", async () => {
      const signature = await getRegisterSignature(did, endPoints_B, identity.privateKey)
      await expect(didReg.register(did, endPoints_B, signature)).to.emit(didReg, "Register");

      expect(await didReg.lookup(did)).to.deep.equal(endPoints_B);
    })
  })
});
