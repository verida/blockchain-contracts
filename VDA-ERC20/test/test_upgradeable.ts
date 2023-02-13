/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import hre, { ethers , upgrades } from "hardhat"

import { VeridaToken } from "../typechain/VeridaToken"
import { VeridaTokenV2 } from "../typechain/VeridaTokenV2"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

chai.use(solidity)
chai.use(chaiAsPromised)

let accountList : SignerWithAddress[];

before(async function () {
  await hre.network.provider.send("hardhat_reset");

  accountList = await ethers.getSigners();
  // for (let i = 0; i < accountList.length; i++)
  //     console.log("## ", accountList[i].address);
})

describe("Upgradeable Test", async function () {
  let deployedProxyAddress : string

  this.beforeAll(async function () {
    await hre.network.provider.send("hardhat_reset");
  })

  describe("Deploy Verida Token 1.0", async function () {
    this.beforeAll(async function () {
      const vdaFactory = await ethers.getContractFactory('VeridaToken');
      const vda = await upgrades.deployProxy(
        vdaFactory,
        {initializer: 'initialize'}
      ) as VeridaToken;
      await vda.deployed()
      deployedProxyAddress = vda.address;
    })
    
    it("Check version returns 1.0", async function () {
      const tokenFactory = await ethers.getContractFactory('VeridaToken');
      const token = tokenFactory.attach(deployedProxyAddress);
      expect(await token.getVersion()).to.equal("1.0");
    })
  });

  describe("Upgrade Verida Token to 2.0", async function () {
    this.beforeAll(async function () {
      const vdaV2Factory = await ethers.getContractFactory('VeridaTokenV2');
      const vda2 = await upgrades.upgradeProxy(
        deployedProxyAddress,
        vdaV2Factory
      ) as VeridaTokenV2;
      await vda2.deployed();
    }) 

    it("Check version returns 2.0", async function () {
      const tokenFactory = await ethers.getContractFactory('VeridaTokenV2');
      const token = tokenFactory.attach(deployedProxyAddress);
      expect(await token.getVersion()).to.equal("2.0");
    })
  })

  // it ("Check Version of Deployed Address", async function () {
  //   const tokenFactory = await ethers.getContractFactory('VeridaTokenV2');
  //   const token = await tokenFactory.attach(deployedProxyAddress);
  //   console.log("Attached:", await token.getVersion());
  //   // console.log("Version : ", await token.getVersion());
  //   // expect(await token.getVersion()).to.be.eq('2.0');
  // })
})