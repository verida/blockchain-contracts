import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { NameRegistry, NameRegistryV2 } from "../typechain-types";

import { Wallet } from "ethers";
import { appDataWithDomain, checkRegisterApp, getRegisterSignature } from "./utils";

import { VeridaToken } from "@verida/erc20-contract/typechain-types";
import { abi as TokenABI, bytecode as TokenByteCode } from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json";

let contract: NameRegistry;

const newSuffix = "test";

const dids = [
  Wallet.createRandom(),
  Wallet.createRandom(),
];

const testNames = [
  "helloworld.vda",
  "hello----world--.test",
  "hello_world-dave.test",
];

const MAX_NAMES_PER_DID = 3;
const APP_REGISTER_FEE = 500;

describe("V1 to V2 migration test", function () {
  let owner: SignerWithAddress;
  let account: SignerWithAddress;

  let v1: NameRegistry;
  let v2: NameRegistryV2;
  let token: VeridaToken;

  this.beforeAll(async function () {
    
    [owner, account] = await ethers.getSigners();

    const contractFactory = await ethers.getContractFactory("NameRegistry");
    // contract = await contractFactory.deploy();
    contract = (await upgrades.deployProxy(contractFactory, {
      initializer: "initialize",
    })) as NameRegistry;
  });

  describe("Deploy V1", () => {
    before(async () => {
      const contractFactory = await ethers.getContractFactory("NameRegistry");
      v1 = (await upgrades.deployProxy(contractFactory, {
        initializer: "initialize"
      })) as NameRegistry;
    })

    it("Update max names per DID", async () => {
      await expect(
        v1.updateMaxNamesPerDID(MAX_NAMES_PER_DID)
      ).to.emit(v1, "UpdateMaxNamesPerDID");
    })

    it("Add suffix", async () => {
      await expect(
        v1.addSuffix(newSuffix)
      ).to.emit(v1, "AddSuffix")
    })

    it("Register names", async () => {
      const signature = await getRegisterSignature(v1, testNames[0], dids[0]);
      await v1.register(testNames[0], dids[0].address, signature);

      for (let i = 1; i < 3; i++) {
        const signature = await getRegisterSignature(v1, testNames[i], dids[1]);
        await v1.register(testNames[i], dids[1].address, signature);
      }
    })
  })

  describe("Upgrade to V2", () => {
    
    before(async () => {
      const contractFactory = await ethers.getContractFactory("NameRegistryV2");
      v2 = (await upgrades.upgradeProxy(v1.address, contractFactory)) as NameRegistryV2;

      // Deploy token
      const tokenFactory = await ethers.getContractFactory(TokenABI, TokenByteCode)
      token = await tokenFactory.deploy() as VeridaToken
      await token.deployed()
      await token.initialize();
      await token.enableTransfer();

      // Mint token
      await token.mint(owner.address, 10000);
    })

    it("Enable app register", async () => {
      await v2.updateAppRegisterFee(APP_REGISTER_FEE);
      await v2.setTokenAddress(token.address);

      await v2.setAppRegisterEnabled(true);
    })

    it("Register apps", async () => {
      // Register multiple apps to one owner
      const appCount = 3;
      await token.approve(v2.address, APP_REGISTER_FEE * appCount);
      for (let i = 0; i < appCount; i++) {
          await checkRegisterApp(v2, owner, dids[0], "owner1", `App ${i+1}`, appDataWithDomain, true);
      }

      // Register same app name to different owner
      await token.mint(account.address, APP_REGISTER_FEE);
      await token.connect(account).approve(v2.address, APP_REGISTER_FEE);

      await checkRegisterApp(v2, account, dids[1], "owner2", "App 1", appDataWithDomain, true);
    })
  })

  describe("Confirm V1 & V2 data exist", () => {
    it("Confirm V1 data exist", async () => {
      // Check max naems per did
      expect(await v2.maxNamesPerDID()).to.be.eq(MAX_NAMES_PER_DID);

      // Find DID
      expect(await v2.findDID(testNames[0])).to.equal(dids[0].address);
      for(let i = 1; i < 3; i++) {
        expect(await v2.findDID(testNames[i])).to.equal(dids[1].address);
      }
    })

    it("Confirm V2 data exist", async () => {
      // Get app fee
      expect(await v2.getAppRegisterFee()).to.be.eq(APP_REGISTER_FEE);

      // Token address
      expect(await v2.getTokenAddress()).to.equal(token.address);

      // Is register app enabled
      expect(await v2.isAppRegisterEnabled()).to.be.eq(true);

      // Get app
      // expect(await v2.getApp("owner1", "app1")).to.not.deep.equal([]);
      expect(await v2.getApp("owner1", "app 1")).to.length.gt(0);
    })
  })
});
