// noinspection DuplicatedCode

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { VeridaDIDRegistry } from "../typechain-types";

import EncryptionUtils from '@verida/encryption-utils'

import hre, { ethers , upgrades } from "hardhat"
import { Wallet } from 'ethers'

chai.use(chaiAsPromised);

let didReg: VeridaDIDRegistry;
let accounts: SignerWithAddress[]
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

const endPoints_Empty : string[] = []

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
    ['address', 'string'],
    [did, '/']
  );

  for (let i = 0; i < endpoints.length; i++) {
    rawMsg = ethers.utils.solidityPack(
      ['bytes', 'string', 'string'],
      [rawMsg, endpoints[i], '/']
    );
  }
  return await createVeridaSign(rawMsg, signKey, did);
}

const getControllerSignature = async(did: string, controller: string, signKey: string) => {
  const rawMsg = ethers.utils.solidityPack(
    ['address', 'string', 'address', 'string'],
    [did, '/setController/', controller, "/"]
  )
  return await createVeridaSign(rawMsg, signKey, did);
}

const getRevokeSignature = async(did: string, signKey: string) => {
  const rawMsg = ethers.utils.solidityPack(
    ['address', 'string'],
    [did, '/revoke/']
  )
  return  await createVeridaSign(rawMsg, signKey, did);
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

    accounts = await hre.ethers.getSigners()

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
 
  describe("Register", () => {
    it("Should reject for invalid signature", async () => {
      const signature = await getRegisterSignature(did, endPoints_A, badSigner.privateKey)
      await expect(didReg.register(did, endPoints_A, signature)).to.be.rejectedWith("Invalid signature");
    })

    it("Success", async () => {
      const signature = await getRegisterSignature(did, endPoints_A, identity.privateKey)
      await expect(didReg.register(did, endPoints_A, signature)).to.emit(didReg, "Register");
    })

    it("Should update for already registered DID address", async () => {
      expect((await didReg.lookup(did))[1]).to.deep.equal(endPoints_A);

      const signature = await getRegisterSignature(did, endPoints_B, identity.privateKey)
      await expect(didReg.register(did, endPoints_B, signature)).to.emit(didReg, "Register");

      expect((await didReg.lookup(did))[1]).to.deep.equal(endPoints_B);
    })

    it("Should reject for revoked DID address", async () => {
      const tempDID = Wallet.createRandom();

      // Register
      let signature = await getRegisterSignature(tempDID.address, endPoints_A, tempDID.privateKey);
      await expect(didReg.register(tempDID.address, endPoints_A, signature)).to.emit(didReg, "Register");
      
      // Revoke
      signature = await getRevokeSignature(tempDID.address, tempDID.privateKey);
      await expect(didReg.revoke(tempDID.address, signature)).to.emit(didReg, "Revoke");

      signature = await getRegisterSignature(tempDID.address, endPoints_B, tempDID.privateKey);
      await expect(didReg.register(
        tempDID.address,
        endPoints_B,
        signature
      )).to.be.rejectedWith("Revoked DID address");
    })
  })

  describe("Active DIDs", () => {
    const testDIDs = [
      Wallet.createRandom(),
      Wallet.createRandom(),
    ]

    const testEndPoints = [
      'https://C_1',
      'https://C_2'
    ]

    it("Should increase active dids' count on Register success", async () => {
      for (let i = 0; i < testDIDs.length; i++) {
        const orgCount = (await didReg.activeDIDCount()).toNumber();

        const signature = await getRegisterSignature(testDIDs[i].address, testEndPoints, testDIDs[i].privateKey)
        await expect(didReg.register(testDIDs[i].address, testEndPoints, signature)).to.emit(didReg, "Register");

        const newCount = (await didReg.activeDIDCount()).toNumber();
        expect(newCount).equal(orgCount+1)
      }
    })

    it("Get active DIDs",async () => {
      // Get active DIDs successfully
      expect(await didReg.getDIDs(0,1)).deep.equal([did])
      expect(await didReg.getDIDs(1,2)).deep.equal([
        testDIDs[0].address,
        testDIDs[1].address
      ])

      // Should reject for non contract owners
      await expect(didReg.connect(accounts[1]).getDIDs(0,1)).to.be.rejectedWith("Ownable: caller is not the owner")

      // Should reject for invalid ranges
      await expect(didReg.getDIDs(0,0)).to.be.rejectedWith("Out of range")
      await expect(didReg.getDIDs(0,4)).to.be.rejectedWith("Out of range")
      await expect(didReg.getDIDs(2,2)).to.be.rejectedWith("Out of range")
      await expect(didReg.getDIDs(3,1)).to.be.rejectedWith("Out of range")
    })

    it("Should not updated on duplicate Register", async () => {
      const orgCount = (await didReg.activeDIDCount()).toNumber();

      const signature = await getRegisterSignature(testDIDs[0].address, testEndPoints, testDIDs[0].privateKey)
      await expect(didReg.register(testDIDs[0].address, testEndPoints, signature)).to.emit(didReg, "Register");

      // DIDs' count not updated
      const newCount = (await didReg.activeDIDCount()).toNumber();
      expect(newCount).equal(orgCount)

      // DIDs not updated
      expect(await didReg.getDIDs(0,3)).deep.equal([
        did,
        testDIDs[0].address,
        testDIDs[1].address
      ])
    })

    it("Should not updated on Register failed", async () => {
      const orgCount = (await didReg.activeDIDCount()).toNumber();

      const signature = await getRegisterSignature(testDIDs[0].address, testEndPoints, badSigner.privateKey)
      await expect(didReg.register(testDIDs[0].address, testEndPoints, signature)).to.be.rejectedWith("Invalid signature");

      const newCount = (await didReg.activeDIDCount()).toNumber();
      expect(newCount).equal(orgCount)
    })

    it("Should decrease on Revoke success", async () => {
      for (let i = 0; i < testDIDs.length; i++) {
        const orgCount = (await didReg.activeDIDCount()).toNumber();

        const signature = await getRevokeSignature(testDIDs[i].address, testDIDs[i].privateKey);
        await expect(didReg.revoke(testDIDs[i].address, signature)).to
          .emit(didReg, "Revoke")
          .withArgs(testDIDs[i].address);

        const newCount = (await didReg.activeDIDCount()).toNumber();
        expect(newCount).equal(orgCount-1)
      }

      // DIDs updated
      expect(await didReg.getDIDs(0,1)).deep.equal([did])
    })
  })

  describe("Lookup", () => {
    it("Get endopints registered", async () => {
      const list = (await didReg.lookup(did))[1];
      expect(list).to.deep.equal(endPoints_B);
    })

    it("Should reject for unregistered DIDs", async () => {
      const testDID = Wallet.createRandom();
      await expect(didReg.lookup(testDID.address)).to.be.rejectedWith("Unregistered address");
    })

    it("Should return empty array for empty endpoints", async () => {
      const testDID = Wallet.createRandom();
      const signature = await getRegisterSignature(testDID.address, endPoints_Empty, testDID.privateKey)
      await expect(didReg.register(testDID.address, endPoints_Empty, signature)).to.emit(didReg, "Register");

      expect((await didReg.lookup(testDID.address))[1]).to.deep.equal(endPoints_Empty);
    })

    it("Should reject for revoked DID", async () => {
      const testDID = Wallet.createRandom()

      // Register
      let signature = await getRegisterSignature(testDID.address, endPoints_A, testDID.privateKey);
      await didReg.register(testDID.address, endPoints_A, signature);
      expect((await didReg.lookup(testDID.address))[1]).to.deep.equal(endPoints_A);

      expect(await didReg.getController(testDID.address)).to.equal(testDID.address);
      // Revoke
      signature = await getRevokeSignature(testDID.address, testDID.privateKey);
      await didReg.revoke(testDID.address, signature);

      // // Reject for reovked one
      await expect(didReg.lookup(testDID.address)).to.be.rejectedWith("Unregistered address");
    })
  })
  
  describe("Set controller", () => {
    
    it("Should reject for unregistered address", async () => {
      const testDID = Wallet.createRandom()
      const controller = Wallet.createRandom()
      const signature = await getControllerSignature(testDID.address, controller.address, testDID.privateKey)

      await expect(didReg.setController(
        testDID.address, 
        controller.address, 
        signature)
      ).to.be.rejectedWith("Unregistered address");
    })

    it("Should reject for invalid signature", async () => {
      const controller = Wallet.createRandom()
      const signature = await getControllerSignature(did, controller.address, badSigner.privateKey)
      // Signed by invalid signer.
      await expect(didReg.setController(
        did, 
        controller.address, 
        signature)
      ).to.be.rejectedWith("Invalid signature")
    })

    it("Change controller for registered one", async () => {
      expect(await didReg.getController(did)).to.be.equal(did);

      const controller = Wallet.createRandom()
      let signature = await getControllerSignature(did, controller.address, identity.privateKey)
      await expect(didReg.setController(
        did, 
        controller.address, 
        signature)
      ).to.emit(didReg, 'SetController').withArgs(did, controller.address);

      expect(await didReg.getController(did)).to.be.equal(controller.address);

      // Restore controller for later tests
      signature = await getControllerSignature(did, did, controller.privateKey)
      await expect(didReg.setController(
        did, 
        did, 
        signature)
      ).to.emit(didReg, 'SetController').withArgs(did, did);
    })
  })

  describe("Get controller", () => {
    it("Should return did itself for unchanged DID", async () => {
      expect(await didReg.getController(did)).to.equal(did);
    })

    it("Should return did itself for unregistered DID", async () => {
      const testDID = Wallet.createRandom()
      expect(await didReg.getController(testDID.address)).to.equal(testDID.address);
    })

    it("Should return updated one for controller changed DID", async () => {
      const controller = Wallet.createRandom()
      let signature = await getControllerSignature(did, controller.address, identity.privateKey)
      await didReg.setController(did, controller.address, signature)

      expect(await didReg.getController(did)).to.be.equal(controller.address);

      // Restore controller for later tests
      signature = await getControllerSignature(did, did, controller.privateKey)
      await didReg.setController(did, did, signature)
    })
  })

  describe("Revoke", () => {
    const controller = Wallet.createRandom()

    before(async () => {
      // Update controller for test purpose
      const signature = await getControllerSignature(did, controller.address, identity.privateKey)
      await didReg.setController(did, controller.address, signature);

      expect(await didReg.getController(did)).to.equal(controller.address);
    })

    it("Should reject for unregistered DID", async () => {
      const testDID = Wallet.createRandom()
      const signature = await getRevokeSignature(testDID.address, testDID.privateKey);
      await expect(didReg.revoke(testDID.address, signature)).to.be.rejectedWith("Unregistered address");
    })

    it("Should return for invalid signature - bad signer",async () => {
      const signature = await getRevokeSignature(did, badSigner.privateKey);
      await expect(didReg.revoke(did, signature)).to.be.rejectedWith("Invalid signature");
    })

    it("Should return for invalid signature - not a controller",async () => {
      const signature = await getRevokeSignature(did, identity.privateKey);
      await expect(didReg.revoke(did, signature)).to.be.rejectedWith("Invalid signature");
    })

    it("Revoked successfully", async () => {
      const signature = await getRevokeSignature(did, controller.privateKey);
      await expect(didReg.revoke(did, signature)).to
        .emit(didReg, "Revoke")
        .withArgs(did);
    })

    it("Should reject for revoked DID", async () => {
      const signature = await getRevokeSignature(did, controller.privateKey);
      await expect(didReg.revoke(did, signature)).to.be.rejectedWith("Unregistered address");
    })
  })
});
