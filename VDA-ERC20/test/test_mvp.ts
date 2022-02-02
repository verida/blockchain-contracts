import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import { expect } from "chai"
import { ethers } from "hardhat"

import { upgrades } from "hardhat"
import { VeridaToken } from "../typechain/VeridaToken"
import { VeridaTokenV2 } from "../typechain/VeridaTokenV2"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "@ethersproject/bignumber"

import hre from "hardhat"
import { ERC20Upgradeable, IERC20Upgradeable, ITestUpgradeable } from "../typechain"

chai.use(solidity)
chai.use(chaiAsPromised)

let accountList : SignerWithAddress[];

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

    // Increase BlockNumber while testing
    const evmIncreaseBlock = async(blockNumber : number) => {
        while (blockNumber > 0) {
            blockNumber--;
            hre.network.provider.request({
                method: "evm_mine",
                params: [],
            })
        }
    }

    // Increase Node Time while testing
    const evmIncreaseTime = async(timeInSeconds : number) => {
        await hre.network.provider.send('evm_increaseTime', [timeInSeconds]);
        // await network.provider.send("evm_setNextBlockTimestamp", [1625097600])
        await hre.network.provider.send('evm_mine');
    }

    // Get current BlockNumber
    const currentBlockNumber = async() => {
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log("Current Block : ", blockNumber);
        return blockNumber;
    }

    this.beforeEach(async function() {
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

    describe("Lock Test", function() {
        let owner : SignerWithAddress,
            testAccount : SignerWithAddress,
            testMinter : SignerWithAddress;

        this.beforeAll(async function () {
            owner = accountList[0];
            testAccount = accountList[1];
            testMinter = accountList[2];
        })

        describe("Add LockHolder", async function () {

            it("Rejected by invalid lock type.", async function () {
                // LockType rejected
                await expect(vda.addLockHolder(testAccount.address, 0, 100)).to.be.rejectedWith("Invalid lock type");
                await expect(vda.addLockHolder(testAccount.address, 5, 100)).to.be.rejectedWith("Invalid lock type");    
            })
            
            it ("Rejected by invalid lock amount", async function () {
                //0 lock amount
                await expect(vda.addLockHolder(
                    testAccount.address,
                    1, 
                    0
                )).to.be.rejectedWith("Invalid lock amount");
                //Over Max supply limit
                await expect(vda.addLockHolder(
                    testAccount.address, 
                    1, 
                    BigNumber.from('1000000000000000000000000001')
                )).to.be.rejectedWith("Max supply limit");
            })

            it("Add holder correctly", async function () {
                expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);
                await vda.addLockHolder(testAccount.address, 1, 100);
                expect(await vda.balanceOf(testAccount.address)).to.be.eq(100);
            })

            // After this test, block timeStamp will increased and addLockHolder() will not work anymore.
            /*it ("Rejected by locking date after release start", async function () {
                await hre.network.provider.send("evm_setNextBlockTimestamp", [1672531400]);
                await hre.network.provider.send("evm_mine");
                await expect(vda.addLockHolder(
                    testAccount.address,
                    1, 
                    100
                )).to.be.rejectedWith("Release started");
            })*/
        })

        describe("Remove LockHolder", async function() {
            it("Rejected by invalid lock type", async function () {
                await expect(vda.removeLockHolder(testAccount.address)).to.be.rejectedWith("Not a lock holder");
            }) 

            it("Rejected after release start", async function() {
                
            })

            it ("Remove holder", async function(){
                await vda.addLockHolder(testAccount.address, 1, 100);

                await vda.removeLockHolder(testAccount.address);
            })
        })

        describe("getLockType", async function () {
            it("lock types returned correctly", async function () {
                await vda.addLockHolder(testAccount.address, 1, 100);

                expect(await vda.getLockType(testAccount.address)).to.be.eq(1);
            })            
        })

        describe("lockedAmount", async function () {
            it("get locked amount correctly", async function () {
                for (let i = 1; i < 5; i++) {
                    await vda.addLockHolder(accountList[i].address, i, i * 100);
                }

                for (let i = 1; i < 5; i++) {
                    expect(await vda.connect(accountList[i]).lockedAmount()).to.be.eq(i * 100);
                }
            })
        })
    })
})