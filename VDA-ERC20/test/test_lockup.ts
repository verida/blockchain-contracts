/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
/* eslint-disable node/no-extraneous-import */
/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import hre, { ethers , upgrades } from "hardhat"

import { VeridaToken } from "../typechain/VeridaToken"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "@ethersproject/bignumber"

import { VDALock } from "../typechain"

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
describe("Lock-Up", async function () {
    let vda: VeridaToken;
    let lockUp : VDALock;

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
        let typeCount = await lockUp.lockTypeCount();
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
            const lockType = await lockUp.lockTypeInfo(i);
            if (lockType.isValidFromTGE) {
                await lockUp.addLockHolder(
                    accountList[i].address,
                    i,
                    lockAmount,
                    0
                );
            } else {
                await lockUp.addLockHolder(
                    accountList[i].address,
                    i,
                    lockAmount,
                    currentBlockTime + t_day
                )
            }
        }
    }

    let owner : SignerWithAddress,
        testAccount : SignerWithAddress,
        testMinter : SignerWithAddress;

    const teamLockType = 3;

    this.beforeAll(async function () {
        owner = accountList[0];
        testAccount = accountList[1];
        testMinter = accountList[2];
    })

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

        const lockFactory = await ethers.getContractFactory('VDALock');
        lockUp = (await upgrades.deployProxy(
            lockFactory,
            [vda.address],
            {
                initializer: 'initialize'
            }
        )) as VDALock;

        await lockUp.deployed();

        vda.addMinter(lockUp.address);

        // await currentBlockNumber();
    })

    describe ("Add Lock Type", async function() {
        it ("Rejected by 0 lock-up duration", async function() {
            await expect(lockUp.addLockType(0, 30 * t_day, 0, true)).to.be.rejectedWith('Invalid lock duration');
        })

        it ("Rejected by 0 release interval. Never released.", async function() {
            await expect(lockUp.addLockType(3 * t_year, 0, 0, true)).to.be.rejectedWith('Invalid release interval');
        })

        it ("Add lock type successfully", async function () {
            let currentLockTypeCount = await lockUp.lockTypeCount();
            await lockUp.addLockType(3 * t_year, 30 * t_day, 0, true);
            expect(await lockUp.lockTypeCount()).to.be.eq(currentLockTypeCount + 1);
            currentLockTypeCount++;

            await lockUp.addLockType(2 * t_year, 30 * t_day, 1 * t_year, false);
            expect(await lockUp.lockTypeCount()).to.be.eq(currentLockTypeCount+1);
        })
    })

    describe("Add LockHolder", async function () {
        it("Rejected for zero address", async function () {
            await expect(lockUp.addLockHolder(
                '0x0000000000000000000000000000000000000000',
                1,
                100,
                0
            )).to.be.rejectedWith('Invalid zero address');            
        })

        it("Rejected by invalid lock type.", async function () {
            // LockType rejected
            const currentLockTypeCount = await lockUp.lockTypeCount();
            await expect(lockUp.addLockHolder(testAccount.address, 0, 100, 0)).to.be.rejectedWith("Invalid lock type");
            await expect(lockUp.addLockHolder(testAccount.address, currentLockTypeCount+1, 100, 0)).to.be.rejectedWith("Invalid lock type");
        })

        it ("Rejected by 0 lock amount", async function() {
            await expect(lockUp.addLockHolder(
                testAccount.address,
                1, 
                0,
                0
            )).to.be.rejectedWith("Invalid lock amount");
        })
        
        it ("Rejected by total supply added lock amount overflowing max supply", async function () {
            const maxSupply = await vda.MAX_SUPPLY();
            await expect(lockUp.addLockHolder(
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
            const typeCount = await lockUp.lockTypeCount();
            for (let i = 1; i <= typeCount; i++) {
                const lockType = await lockUp.lockTypeInfo(i);
                if (lockType.isValidFromTGE) {
                    await expect(lockUp.addLockHolder(
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
            const typeCount = await lockUp.lockTypeCount();
            for (let i = 1; i <= typeCount; i++) {
                const lockType = await lockUp.lockTypeInfo(i);
                if (!lockType.isValidFromTGE) {
                    await expect(lockUp.addLockHolder(
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

            const userInfo = await lockUp.userLockInfo(accountList[teamLockType].address);

            const typeCount = await getTypeCount();
            
            // Checke current amount of each user
            for (let i = 1; i <= typeCount; i++) {
                const userInfo = await lockUp.userLockInfo(accountList[teamLockType].address);
                expect(userInfo.lockAmount).to.be.eq(0);
            }

            await addLockHolders(typeCount, lockAmount);
            
            // Check amount changed
            for (let i = 1; i <= typeCount; i++) {
                const userInfo = await lockUp.userLockInfo(accountList[teamLockType].address);
                expect(userInfo.lockAmount).to.be.eq(lockAmount);
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
            await expect(lockUp.removeLockHolder(accountList[0].address)).to.be.rejectedWith("Not a lock holder");
        }) 

        it("Rejected after TGE except team members", async function() {
            const publishTime = (await vda.tokenPublishTime()).toNumber();

            await setBlockTimeStamp(publishTime + 1);

            const typeCount = await getTypeCount();

            // Remove lock-holders will be failed
            for (let i = 1; i <= typeCount; i++) {
                const lockType = await lockUp.lockTypeInfo(i);
                if (lockType.isValidFromTGE)
                    await expect(lockUp.removeLockHolder(accountList[i].address)).to.be.rejectedWith("Token published");
            }                
        })

        it ("Everybody removed correctly before TGE", async function(){
            const typeCount = await getTypeCount();

            for (let i = 1; i <= typeCount; i++) {                   
                await lockUp.removeLockHolder(accountList[i].address);
            }
        })

        it ("Team-members removed correctly after TGE", async function(){
            const publishTime = (await vda.tokenPublishTime()).toNumber();

            await setBlockTimeStamp(publishTime + 100);

            expect(await lockUp.connect(accountList[teamLockType]).lockedAmount()).to.be.eq(testLockAmount);

            await lockUp.removeLockHolder(accountList[teamLockType].address);

            expect(await lockUp.connect(accountList[teamLockType]).lockedAmount()).to.be.eq(0);
        })

        it ("Team-members removed correctly after first release", async function(){
            const curBlockTime = await currentBlockTimeStamp();

            const lockAmount = 365 * 30;

            const teamMember = accountList[teamLockType];

            // re-register team-member
            await lockUp.addLockHolder(
                teamMember.address, 
                teamLockType,
                lockAmount,
                curBlockTime + t_day
            );

            // console.log("Locked Amount : ", await lockUp.connect(teamMember).lockedAmount());

            // Check out locaked amount
            expect(await lockUp.connect(teamMember).lockedAmount()).to.be.eq(lockAmount);

            const userInfo = await lockUp.userLockInfo(teamMember.address);
            const lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

            const firstRelease = userInfo.lockStart.add(lockInfo.releaseDelay).add(lockInfo.releaseInterval);
            
            // Set block timestamp as first release
            await setBlockTimeStamp(firstRelease.toNumber());

            // Check out current balance of account
            expect(await vda.balanceOf(teamMember.address)).to.be.eq(0);

            // Claim first release
            await lockUp.connect(teamMember).claim();

            // Check out remaining locked amount
            // console.log("Locked Amount after first release : ", await lockUp.connect(teamMember).lockedAmount());
            expect(await lockUp.connect(teamMember).lockedAmount()).to.not.eq(lockAmount);

            // Check out balance of token released
            expect(await vda.balanceOf(teamMember.address)).to.not.eq(0);

            // Remove holder after first release.
            await lockUp.removeLockHolder(teamMember.address);

            // Check out remaining locked amount
            expect(await lockUp.connect(teamMember).lockedAmount()).to.be.eq(0);

            // Balance remains after removed in lockUp
            expect(await vda.balanceOf(teamMember.address)).to.not.eq(0);
        })
    })

    describe("Claim", async function () {
        it ("claimable amount is zero before first release", async function () {
            const typeCount = await getTypeCount();

            await addLockHolders(typeCount, 100);
            for (let i = 1; i <= typeCount; i++) {
                expect(await lockUp.connect(accountList[i]).claimableAmount()).to.be.eq(0);
            }
        })

        describe("Claim for investor - release without any delay", async function () {
            const lockAmount = 365 * 2 * 10;
            const releasePerInterval = 30 * 10; // releaseInterval * lockAmount / lockDuration

            let userInfo: [number, BigNumber, BigNumber, BigNumber] & {
                lockType: number;
                lockAmount: BigNumber;
                lockStart: BigNumber;
                released: BigNumber;
            }

            let lockInfo: [BigNumber, BigNumber, BigNumber, boolean] & {
                lockDuration: BigNumber;
                releaseInterval: BigNumber;
                releaseDelay: BigNumber;
                isValidFromTGE: boolean;
            }

            let firstRelease : BigNumber;
            let intervalCount : number;

            this.beforeEach(async function () {
                await lockUp.addLockHolder(
                    testAccount.address,
                    1,
                    lockAmount,
                    0
                );

                userInfo = await lockUp.userLockInfo(testAccount.address);
                lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

                firstRelease = (await vda.tokenPublishTime()).add(lockInfo.releaseInterval).add(lockInfo.releaseDelay);
                intervalCount = lockInfo.lockDuration.div(lockInfo.releaseInterval).toNumber();
    
            })

            it("Claim on each release interval for investor", async function(){
                // Claimable amount is zero before first release
                expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

                // Set time to first release
                await setBlockTimeStamp(firstRelease.toNumber());
    
                for  (let  i = 1; i <= intervalCount; i++) {
                    expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(releasePerInterval);
                    await lockUp.connect(testAccount).claim();
                    expect(await vda.balanceOf(testAccount.address)).to.be.eq(releasePerInterval * i)
                    await evmIncreaseTime(lockInfo.releaseInterval.toNumber());
                }
    
                // Release last remaining locked-up amount
                await lockUp.connect(testAccount).claim();
                // Last release check
                expect(await vda.balanceOf(testAccount.address)).to.be.eq(lockAmount);

                // Claim once more to check whether release again after all payment released.
                await lockUp.connect(testAccount).claim();
                // Last release check
                expect(await vda.balanceOf(testAccount.address)).to.be.eq(lockAmount);
            })

            it ("Claimed with batch release for investor - release without any delay", async function () {
                // Claimable amount is zero before first release
                expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

                // Set time to second release
                await setBlockTimeStamp(firstRelease.add(lockInfo.releaseInterval).toNumber());

                // release every 2 release interval
                for  (let  i = 2; i <= intervalCount; i+=2) {
                    expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(releasePerInterval * 2);
                    await lockUp.connect(testAccount).claim();
                    expect(await vda.balanceOf(testAccount.address)).to.be.eq(releasePerInterval * i)
                    await evmIncreaseTime(lockInfo.releaseInterval.toNumber() * 2);
                }
    
                // Release last remaining locked-up amount
                await lockUp.connect(testAccount).claim();
                // Last release check
                expect(await vda.balanceOf(testAccount.address)).to.be.eq(lockAmount);

                // Claim once more to check whether release again after all payment released.
                await lockUp.connect(testAccount).claim();
                // Last release check
                expect(await vda.balanceOf(testAccount.address)).to.be.eq(lockAmount);
            })
        })

        it("Claim for team member - release  with delay", async function () {
            const lockAmount = 4 * 365 * 10;
            
            const lockStart = await currentBlockTimeStamp();

            await lockUp.addLockHolder(
                testAccount.address,
                teamLockType,
                lockAmount,
                lockStart + t_day
            );

            const userInfo = await lockUp.userLockInfo(testAccount.address);
            const lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

            const releasePerInterval = lockInfo.releaseInterval.mul(userInfo.lockAmount).div(lockInfo.lockDuration).toNumber(); // releaseInterval * lockAmount / lockDuration

            const firstRelease = userInfo.lockStart.add(lockInfo.releaseInterval).add(lockInfo.releaseDelay);
            const intervalCount = lockInfo.lockDuration.div(lockInfo.releaseInterval).toNumber();

            // Check locked amount before lock start time
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

            // Check at lock start time
            await setBlockTimeStamp(userInfo.lockStart.toNumber());
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

            // Check after 30 days(first relase interval) from lock start time.
            await setBlockTimeStamp(userInfo.lockStart.add(lockInfo.releaseInterval).toNumber());
            // Claimable amount is 0.
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

            // Check after 11 months from lock start time
            await setBlockTimeStamp(userInfo.lockStart.add(lockInfo.releaseInterval.mul(11)).toNumber());
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

            // Check after 365 days(release delay) from lock start time.
            // Still zero because of release interval
            await setBlockTimeStamp(userInfo.lockStart.add(lockInfo.releaseDelay).toNumber());
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);

            // Check at first release time. 
            // After 365 days(release delay) + 30 days(release interval) from lock start time
            await setBlockTimeStamp(userInfo.lockStart.add(lockInfo.releaseDelay).add(lockInfo.releaseInterval).toNumber());
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(releasePerInterval);
            expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);

            // claim first relase
            await lockUp.connect(testAccount).claim();
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - releasePerInterval);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);
            expect(await vda.balanceOf(testAccount.address)).to.be.eq(releasePerInterval);

            // Check after another one month
            await evmIncreaseTime(lockInfo.releaseInterval.toNumber());
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - releasePerInterval);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(releasePerInterval);
            expect(await vda.balanceOf(testAccount.address)).to.be.eq(releasePerInterval);

            // claim second release
            await lockUp.connect(testAccount).claim();
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - 2 * releasePerInterval);
            expect(await lockUp.connect(testAccount).claimableAmount()).to.be.eq(0);
            expect(await vda.balanceOf(testAccount.address)).to.be.eq(2 * releasePerInterval);
        }) 
    })

    describe("lockedAmount", async function () {
        it("get locked amount correctly before any release", async function () {
            const typeCount = await getTypeCount();

            await addLockHolders(typeCount, 100);

            for (let i = 1; i <= typeCount; i++) {
                expect(await lockUp.connect(accountList[i]).lockedAmount()).to.be.eq(100);
            }
        })

        it("get locked amount correctly after release", async function () {
            const lockAmount = 365 * 2 * 10;
            const releasePerInterval = 30 * 10; // releaseInterval * lockAmount / lockDuration
            
            // Add holder
            await lockUp.addLockHolder(
                testAccount.address,
                1,
                lockAmount,
                0
            );

            // Check out balance & locked amount before release
            expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

            const userInfo = await lockUp.userLockInfo(testAccount.address);
            const lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

            // Set time to first release
            const firstRelease = (await vda.tokenPublishTime()).add(lockInfo.releaseInterval).add(lockInfo.releaseDelay);
            await setBlockTimeStamp(firstRelease.toNumber());

            // Claim first relase
            await lockUp.connect(testAccount).claim();

            // Check out balance & locked amount after first release
            expect(await vda.balanceOf(testAccount.address)).to.be.eq(releasePerInterval);
            expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - releasePerInterval);            
        })
    })
})