import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import { expect } from "chai"
import { ethers } from "hardhat"

import { upgrades } from "hardhat"
import { VeridaToken } from "../typechain/VeridaToken"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "@ethersproject/bignumber"

import hre from "hardhat"
import { ERC20Upgradeable, IERC20Upgradeable, ITestUpgradeable } from "../typechain"

chai.use(solidity)
chai.use(chaiAsPromised)

let accountList : SignerWithAddress[];

const t_day = 60 * 60 * 24;
const t_year = 365 * t_day;

before(async function () {
    await hre.network.provider.send("hardhat_reset");

    await hre.network.provider.request(
        {
            method: "hardhat_reset",
            params: []
        }
    );
    
    accountList = await ethers.getSigners();
    // for (let i = 0; i < accountList.length; i++)
    //     console.log("## ", accountList[i].address);
})
describe("MVP-Verida Test", async function () {
    let vda: VeridaToken;  
    
    this.beforeEach(async function() {
        // reset chain before every test
        await hre.network.provider.send("hardhat_reset");

        const vdaFactory = await ethers.getContractFactory('VeridaToken');
        vda = (await upgrades.deployProxy(
            vdaFactory,
            {
            initializer: 'initialize'
            }
        )) as VeridaToken;

        await vda.deployed();

        // await currentBlockNumber();
    })

})