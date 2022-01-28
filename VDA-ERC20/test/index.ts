import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import { expect } from "chai"
import { ethers } from "hardhat"

import { upgrades } from "hardhat"
import { VeridaToken } from "../typechain/VeridaToken"
import { VeridaTokenV2 } from "../typechain/VeridaTokenV2"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import hre from "hardhat"
import { ERC20Upgradeable, IERC20Upgradeable, ITestUpgradeable } from "../typechain"

chai.use(solidity)
chai.use(chaiAsPromised)

let accountList : SignerWithAddress[];

before(async function () {
  accountList = await ethers.getSigners();

  for (let i = 0; i < accountList.length; i++)
      console.log("## ", accountList[i].address);
})

describe("Upgradeable Test", async function () {
  let deployedProxyAddress : string

  it ("Deploy Verida Token 1.0", async function () {
    let vda : VeridaToken;

    const vdaFactory = await ethers.getContractFactory('VeridaToken');
    vda = await upgrades.deployProxy(
      vdaFactory,
      {initializer: 'initialize'}
    ) as VeridaToken;
    await vda.deployed()
    deployedProxyAddress = vda.address;

  });

  it("Upgrade to Version 2.0", async function() {
    let vda2 : VeridaTokenV2;

    const vdaV2Factory = await ethers.getContractFactory('VeridaTokenV2');
    vda2 = await upgrades.upgradeProxy(
      deployedProxyAddress,
      vdaV2Factory
    ) as VeridaTokenV2;
    await vda2.deployed();
  })

  it ("Name of Current", async function(){
    let token : ERC20Upgradeable;
    const tokenFactory = await ethers.getContractFactory('ERC20Upgradeable');
    token = tokenFactory.attach(deployedProxyAddress);

    console.log("TokenName : ", await token.name());
  })

})

// describe("Verida Token", function() {
//   let vda: VeridaToken;  
  
//   this.beforeEach(async function() {
//     const vdaFactory = await ethers.getContractFactory('VeridaToken');
//     vda = (await upgrades.deployProxy(
//       vdaFactory,
//       {
//         initializer: 'initialize'
//       }
//     )) as VeridaToken;

//     await vda.deployed();
//   })

//   describe("Minter Test", function() {
//     let owner : SignerWithAddress,
//       testAccount : SignerWithAddress,
//       testMinter : SignerWithAddress;
    
//     this.beforeAll(async function () {
//       owner = accountList[0];
//       testAccount = accountList[1];
//       testMinter = accountList[2];
//     })

    
//     it("addMinter", async function(){  
//       // Ownable Testexpect(await vda.getMinterCount()).to.be.eq(2);
//       await expect(vda.connect(testAccount).addMinter(testMinter.address)).to.be.rejectedWith('Ownable: caller is not the owner');
//       // Already granted
//       await expect(vda.addMinter(owner.address)).to.be.rejectedWith('Already granted');
  
//       await vda.addMinter(testMinter.address);
//       await expect(vda.addMinter(testMinter.address)).to.be.rejectedWith('Already granted');  
//     })

//     it("revokeMinter", async function() {
//       await vda.addMinter(testMinter.address);

//       await vda.revokeMinter(testMinter.address);
//       await expect(vda.revokeMinter(testMinter.address)).to.be.rejectedWith('No minter');
//     })

//     it("getMinterCount", async function () {
//       expect(await vda.getMinterCount()).to.be.eq(1);

//       await vda.addMinter(testAccount.address);
//       expect(await vda.getMinterCount()).to.be.eq(2);

//       await vda.addMinter(testMinter.address);
//       expect(await vda.getMinterCount()).to.be.eq(3);

//       await vda.revokeMinter(testAccount.address);
//       await vda.revokeMinter(testMinter.address);

//       expect(await vda.getMinterCount()).to.be.eq(1);
//     })

//     it("getMinterList", async function () {
//       console.log("Before : ", await vda.getMinterList());

//       await vda.addMinter(testMinter.address);
//       await vda.addMinter(testAccount.address);
//       console.log("After : ", await vda.getMinterList());
//     })
//   })
// })

