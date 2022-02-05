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
        // console.log("Current Block : ", blockNumber);
        return blockNumber;
    }

    // Get latest Block TimeStamp
    const currentBlockTimeStamp = async() => {
        const blockNumber = await ethers.provider.getBlockNumber();
        const timeStamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
        // console.log("Current Block Time : ", timeStamp);
        return timeStamp;
    }

    // Get min(typeCount, accountList.length - 1)
    const getTypeCount = async() => {
        let typeCount = await vda.lockTypeCount();
        if (accountList.length <= typeCount)
            typeCount = accountList.length - 1;
        return typeCount;
    }

    // Increase Block timestamp after TGE
    const setBlockTimeStamp = async(timeInSecond : number) => {
        await hre.network.provider.send("evm_setNextBlockTimestamp", [timeInSecond]);
        await hre.network.provider.send("evm_mine");
    }

    // Add Lock-Holders
    const addLockHolders = async(typeCount : number, lockAmount : number) => {
        const currentBlockTime = await currentBlockTimeStamp();
        // Add lock-holder per each lock type
        for (let i = 1; i <= typeCount; i++) {
            const lockType = await vda.lockTypeInfo(i);
            if (lockType.isValidFromTGE) {
                await vda.addLockHolder(
                    accountList[i].address,
                    i,
                    lockAmount,
                    0
                );
            } else {
                await vda.addLockHolder(
                    accountList[i].address,
                    i,
                    lockAmount,
                    currentBlockTime + t_day
                )
            }
        }
    }

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

    describe("Lock Test", function() {
        let owner : SignerWithAddress,
            testAccount : SignerWithAddress,
            testMinter : SignerWithAddress;

        const teamLockType = 3;

        this.beforeAll(async function () {
            owner = accountList[0];
            testAccount = accountList[1];
            testMinter = accountList[2];
        })

        describe ("Add Lock Type", async function() {
            it ("Rejected by 0 lock-up duration", async function() {
                await expect(vda.addLockType(0, 30 * t_day, 0, true)).to.be.rejectedWith('Invalid lock duration');
            })

            it ("Rejected by 0 release interval. Never released.", async function() {
                await expect(vda.addLockType(3 * t_year, 0, 0, true)).to.be.rejectedWith('Invalid release interval');
            })

            it ("Add lock type successfully", async function () {
                let currentLockTypeCount = await vda.lockTypeCount();
                await vda.addLockType(3 * t_year, 30 * t_day, 0, true);
                expect(await vda.lockTypeCount()).to.be.eq(currentLockTypeCount + 1);
                currentLockTypeCount++;

                await vda.addLockType(2 * t_year, 30 * t_day, 1 * t_year, false);
                expect(await vda.lockTypeCount()).to.be.eq(currentLockTypeCount+1);
            })

        })

        describe("Add LockHolder", async function () {

            it("Rejected by invalid lock type.", async function () {
                // LockType rejected
                const currentLockTypeCount = await vda.lockTypeCount();
                await expect(vda.addLockHolder(testAccount.address, 0, 100, 0)).to.be.rejectedWith("Invalid lock type");
                await expect(vda.addLockHolder(testAccount.address, currentLockTypeCount+1, 100, 0)).to.be.rejectedWith("Invalid lock type");
            })

            it ("Rejected by 0 lock amount", async function() {
                await expect(vda.addLockHolder(
                    testAccount.address,
                    1, 
                    0,
                    0
                )).to.be.rejectedWith("Invalid lock amount");
            })
            
            it ("Rejected by total supply added lock amount overflowing max supply", async function () {
                const maxSupply = await vda.MAX_SUPPLY();
                await expect(vda.addLockHolder(
                    testAccount.address, 
                    1, 
                    maxSupply.add(1),
                    0
                )).to.be.rejectedWith("Max supply limit");
            })

            it ("Rejected by adding after tokenPublishTime", async function(){
                const publishTime = (await vda.tokenPublishTime()).toNumber();
                await hre.network.provider.send("evm_setNextBlockTimestamp", [publishTime + 1]);
                await hre.network.provider.send("evm_mine");
                const typeCount = await vda.lockTypeCount();
                for (let i = 1; i <= typeCount; i++) {
                    const lockType = await vda.lockTypeInfo(i);
                    if (lockType.isValidFromTGE) {
                        await expect(vda.addLockHolder(
                            testAccount.address,
                            i,
                            100,
                            0
                        )).to.be.rejectedWith('Token published');
                    }
                }
            })

            it ("Rejected by lockStart time before current block time", async function(){
                const currentBlockTime = await currentBlockTimeStamp();
                const typeCount = await vda.lockTypeCount();
                for (let i = 1; i <= typeCount; i++) {
                    const lockType = await vda.lockTypeInfo(i);
                    if (!lockType.isValidFromTGE) {
                        await expect(vda.addLockHolder(
                            testAccount.address,
                            i,
                            100,
                            currentBlockTime - 100
                        )).to.be.rejectedWith('Invalid lock start time');
                    }
                }
            })

            it("Add holder correctly", async function () {
                const lockAmount = 100;

                const typeCount = await getTypeCount();
                
                // Checke current amount of each user
                for (let i = 1; i <= typeCount; i++) {
                    expect(await vda.balanceOf(accountList[i].address)).to.be.eq(0);
                }

                await addLockHolders(typeCount, lockAmount);
                
                // Check amount changed
                for (let i = 1; i <= typeCount; i++) {
                    expect(await vda.balanceOf(accountList[i].address)).to.be.eq(lockAmount);
                }
            })
        })

        describe("Remove LockHolder", async function() {
            const testLockAmount = 100;

            this.beforeEach(async function () {
                const typeCount = await getTypeCount()

                // Add lock-holders
                await addLockHolders(typeCount, testLockAmount);
            })

            it("Rejected by invalid lock holder", async function () {
                await expect(vda.removeLockHolder(accountList[0].address)).to.be.rejectedWith("Not a lock holder");
            }) 

            it("Rejected after TGE except team members", async function() {
                const publishTime = (await vda.tokenPublishTime()).toNumber();

                await setBlockTimeStamp(publishTime + 1);

                const typeCount = await getTypeCount();

                // Remove lock-holders will be failed
                for (let i = 1; i <= typeCount; i++) {
                    const lockType = await vda.lockTypeInfo(i);
                    if (lockType.isValidFromTGE)
                        await expect(vda.removeLockHolder(accountList[i].address)).to.be.rejectedWith("Token published");
                }                
            })

            it ("Everybody removed correctly before TGE", async function(){
                const typeCount = await getTypeCount();

                for (let i = 1; i <= typeCount; i++) {                   
                    await vda.removeLockHolder(accountList[i].address);
                }
            })

            it ("Team-members removed correctly after TGE", async function(){
                const publishTime = (await vda.tokenPublishTime()).toNumber();

                await setBlockTimeStamp(publishTime + 100);

                expect(await vda.connect(accountList[teamLockType]).lockedAmount()).to.be.eq(testLockAmount);

                await vda.removeLockHolder(accountList[teamLockType].address);

                expect(await vda.connect(accountList[teamLockType]).lockedAmount()).to.be.eq(0);
            })

            it ("Team-members removed correctly after first release", async function(){
                const curBlockTime = await currentBlockTimeStamp();

                const lockAmount = 365 * 30;

                //re-register team-member
                await vda.addLockHolder(
                    accountList[teamLockType].address, 
                    teamLockType,
                    lockAmount,
                    curBlockTime + t_day
                );

                // console.log("Locked Amount : ", await vda.connect(accountList[teamLockType]).lockedAmount());

                expect(await vda.connect(accountList[teamLockType]).lockedAmount()).to.be.eq(lockAmount);

                const userInfo = await vda.userLockInfo(accountList[teamLockType].address);
                const lockInfo = await vda.lockTypeInfo(userInfo.lockType);

                let firstRelease = userInfo.lockStart.add(lockInfo.releaseDelay).add(lockInfo.releaseInterval);
                                
                await setBlockTimeStamp(firstRelease.toNumber());

                // console.log("Locked Amount after first release : ", await vda.connect(accountList[teamLockType]).lockedAmount());
                expect(await vda.connect(accountList[teamLockType]).lockedAmount()).to.not.eq(lockAmount);

                // const publishTime = (await vda.tokenPublishTime()).toNumber();
                // await setBlockTimeStamp(publishTime + 100);
                // expect(await vda.connect(accountList[teamLockType]).lockedAmount()).to.be.eq(testLockAmount);

            })
        })

        describe("lockedAmount", async function () {
            it("get locked amount correctly before any release", async function () {
                const typeCount = await getTypeCount();

                await addLockHolders(typeCount, 100);

                for (let i = 1; i <= typeCount; i++) {
                    expect(await vda.connect(accountList[i]).lockedAmount()).to.be.eq(100);
                }
            })

            it("Release working correctly for Investors", async function(){
                const lockAmount = 365 * 2 * 10;
                const releasePerInterval = 30 * 10; //releaseInterval * lockAmount / lockDuration
                await vda.addLockHolder(
                    testAccount.address,
                    1,
                    lockAmount,
                    0
                );

                const userInfo = await vda.userLockInfo(testAccount.address);
                const lockInfo = await vda.lockTypeInfo(userInfo.lockType);

                const firstRelease = (await vda.tokenPublishTime()).add(lockInfo.releaseInterval).add(lockInfo.releaseDelay);

                expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

                const intervalCount = lockInfo.lockDuration.div(lockInfo.releaseInterval).toNumber();
                
                // First Release
                await setBlockTimeStamp(firstRelease.toNumber());

                for  (let  i = 1; i <= intervalCount; i++) {
                    expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - releasePerInterval * i);
                    await evmIncreaseTime(lockInfo.releaseInterval.toNumber());
                }

                // Last release check
                expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(0);
            })

            it("Release working correctly for Team-members with release delay", async function(){
                const lockAmount = 4 * 365 * 10;
                
                const lockStart = await currentBlockTimeStamp();

                await vda.addLockHolder(
                    testAccount.address,
                    teamLockType,
                    lockAmount,
                    lockStart + t_day
                );

                const userInfo = await vda.userLockInfo(testAccount.address);
                const lockInfo = await vda.lockTypeInfo(userInfo.lockType);

                const releasePerInterval = lockInfo.releaseInterval.mul(userInfo.lockAmount).div(lockInfo.lockDuration).toNumber(); //releaseInterval * lockAmount / lockDuration

                const firstRelease = userInfo.lockStart.add(lockInfo.releaseInterval).add(lockInfo.releaseDelay);
                const intervalCount = lockInfo.lockDuration.div(lockInfo.releaseInterval).toNumber();

                expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

                await setBlockTimeStamp(userInfo.lockStart.add(lockInfo.releaseInterval).toNumber());
                // Not released yet because of release delay
                expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

                // First Release
                await setBlockTimeStamp(firstRelease.toNumber());

                for  (let  i = 1; i <= intervalCount; i++) {
                    expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - releasePerInterval * i);
                    await evmIncreaseTime(lockInfo.releaseInterval.toNumber());
                }

                // Last release check
                expect(await vda.connect(testAccount).lockedAmount()).to.be.eq(0);
            })
        })

        describe("Transfer with locked-up feature", async function() {
            const investorType = 1;
            
            it ("Investor transfer failed until first release",async function() {
                const lockInfo = await vda.lockTypeInfo(investorType);
                const lockAmount = (lockInfo.lockDuration.mul(10));
                const releasePerInterval = lockInfo.releaseInterval.mul(lockAmount).div(lockInfo.lockDuration).toNumber();

                await vda.addLockHolder(testAccount.address, investorType, lockAmount, 0);

                await expect(vda.connect(testAccount).transfer(accountList[0].address, 1)).to.be.rejectedWith('Insufficient balance by lock');

                // TGE
                await setBlockTimeStamp((await vda.tokenPublishTime()).toNumber());
                await expect(vda.connect(testAccount).transfer(accountList[0].address, 1)).to.be.rejectedWith('Insufficient balance by lock');
            })

            it ("Investor transfer release successfully",async function() {
                const lockInfo = await vda.lockTypeInfo(investorType);
                const lockAmount = (lockInfo.lockDuration.mul(10));
                const releasePerInterval = lockInfo.releaseInterval.mul(lockAmount).div(lockInfo.lockDuration).toNumber();

                // console.log('release : ', releasePerInterval);

                await vda.addLockHolder(testAccount.address, investorType, lockAmount, 0);

                // console.log('locked : ', (await vda.connect(testAccount).lockedAmount()).toNumber());

                const firstRelease = (await vda.tokenPublishTime()).add(lockInfo.releaseInterval).add(lockInfo.releaseDelay);
                await setBlockTimeStamp(firstRelease.toNumber());

                // console.log('locked : ', (await vda.connect(testAccount).lockedAmount()).toNumber());

                const receiverAccount = accountList[2];

                const releaseCount = lockInfo.lockDuration.div(lockInfo.releaseInterval).toNumber();
                const releaseInterval = lockInfo.releaseInterval.toNumber();                
                
                for (let i = 0; i < releaseCount; i++) {
                    expect(await vda.balanceOf(receiverAccount.address)).to.be.eq(releasePerInterval * i);
                    // Transferr successfully
                    await vda.connect(testAccount).transfer(receiverAccount.address, releasePerInterval);

                    expect(await vda.balanceOf(receiverAccount.address)).to.be.eq(releasePerInterval * (i+1));

                    await evmIncreaseTime(releaseInterval);
                }

                const remainingAmount = await vda.balanceOf(testAccount.address);
                await vda.connect(testAccount).transfer(receiverAccount.address, remainingAmount);

                expect(await vda.balanceOf(receiverAccount.address)).to.be.eq(lockAmount);                
            })            
        })
    })
})