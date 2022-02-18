/* eslint-disable camelcase */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import hre, { ethers , upgrades } from "hardhat"

import { VeridaToken } from "../../VDA-ERC20/typechain/VeridaToken"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "@ethersproject/bignumber"
import { EmployeeLockUp } from "../typechain"

chai.use(solidity)
chai.use(chaiAsPromised)

let accountList : SignerWithAddress[];

let numberOfEmployee = 5;

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

  if (accountList.length < 5)
      numberOfEmployee = accountList.length;
})


describe("EmployeeLockUp Test", function () {
  let vda: VeridaToken;
  let lockUp : EmployeeLockUp;

  // Increase Node Time while testing
  const evmIncreaseTime = async(timeInSeconds : number) => {
    await hre.network.provider.send('evm_increaseTime', [timeInSeconds]);
    // await network.provider.send("evm_setNextBlockTimestamp", [1625097600])
    await hre.network.provider.send('evm_mine');
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

  const addEmployees = async (lockAmount: number) => {
    const curBlockTime = await currentBlockTimeStamp();
    // Add Employees
    for (let i = 1; i <= numberOfEmployee; i++) {
      await lockUp.addEmployee(
        accountList[i].address,
        lockAmount,
        curBlockTime + t_day
      );
    }
  }

  let owner : SignerWithAddress,
      testAccount : SignerWithAddress;

  this.beforeAll(async function () {
    owner = accountList[0];
    testAccount = accountList[1];
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

    const lockFactory = await ethers.getContractFactory('EmployeeLockUp');
    lockUp = (await upgrades.deployProxy(
        lockFactory,
        [vda.address],
        {
            initializer: 'initialize'
        }
    )) as EmployeeLockUp;

    await lockUp.deployed();

    vda.addMinter(lockUp.address);

    // await currentBlockNumber();
  })

  describe ("Add Lock Type", async function() {
    it ("Rejected by 0 lock-up duration", async function() {
        await expect(lockUp.addLockType(0, 30 * t_day, 0)).to.be.rejectedWith('Invalid lock duration');
    })

    it ("Rejected by 0 release interval. Never released.", async function() {
        await expect(lockUp.addLockType(3 * t_year, 0, 0)).to.be.rejectedWith('Invalid release interval');
    })

    it ("Add lock type successfully", async function () {
        let currentLockTypeCount = await lockUp.lockTypeCount();
        await lockUp.addLockType(3 * t_year, 30 * t_day, 0);
        expect(await lockUp.lockTypeCount()).to.be.eq(currentLockTypeCount + 1);
        currentLockTypeCount++;

        await lockUp.addLockType(2 * t_year, 30 * t_day, 1 * t_year);
        expect(await lockUp.lockTypeCount()).to.be.eq(currentLockTypeCount+1);
    })
  })

  describe("Add Employee", async function () {
    it("Rejected for zero address", async function () {
        await expect(lockUp.addEmployee(
            '0x0000000000000000000000000000000000000000',
            100,
            0
        )).to.be.rejectedWith('Invalid zero address');            
    })

    it ("Rejected by 0 lock amount", async function() {
        await expect(lockUp.addEmployee(
            testAccount.address,
            0,
            0
        )).to.be.rejectedWith("Invalid lock amount");
    })
    
    it ("Rejected by total supply added lock amount overflowing max supply", async function () {
      const currentTime = await currentBlockTimeStamp();
      const maxSupply = await vda.MAX_SUPPLY();
      await expect(lockUp.addEmployee(
          testAccount.address, 
          maxSupply.add(1),
          currentTime + t_day
      )).to.be.rejectedWith("Max supply limit");
    })

    it ("Rejected by lockStart time before current block time", async function(){
        const currentBlockTime = await currentBlockTimeStamp();
        const typeCount = await lockUp.lockTypeCount();
        for (let i = 1; i <= typeCount; i++) {
          await expect(lockUp.addEmployee(
              testAccount.address,
              100,
              currentBlockTime - 100
          )).to.be.rejectedWith('Invalid lock start time');
        }
    })

    it("Add Employee correctly", async function () {
        const typeCount = await getTypeCount();
        
        // Checke current amount of each user
        for (let i = 1; i <= typeCount; i++) {
            const userInfo = await lockUp.employeeInfo(accountList[i].address);
            expect(userInfo.lockAmount).to.be.eq(0);
        }

        // Add 3 employee with different lock amount
        const currentTime = await currentBlockTimeStamp();
        const len = accountList.length > 3 ? 3 : accountList.length;
        for (let i = 1; i <= len; i++) {
          await lockUp.addEmployee(
            accountList[i].address,
            i * 100,
            currentTime + t_day
          );
        }
        
        // Check amount changed
        for (let i = 1; i <= typeCount; i++) {
            const userInfo = await lockUp.employeeInfo(accountList[i].address);
            expect(userInfo.lockAmount).to.be.eq(i * 100);
        }
    })
  })

  describe("Add Employee with lock type", async function () {
    it("Rejected by invalid lock type.", async function () {
        // LockType rejected
        const currentLockTypeCount = await lockUp.lockTypeCount();
        await expect(lockUp.addEmployeeWithLockType(testAccount.address, 0, 100, 0)).to.be.rejectedWith("Invalid lock type");
        await expect(lockUp.addEmployeeWithLockType(testAccount.address, currentLockTypeCount+1, 100, 0)).to.be.rejectedWith("Invalid lock type");
    })

    it("Add employee correctly with lock type", async function () {
      // Add new lock types
      await lockUp.addLockType(
        3 * t_year,
        30 * t_day,
        30 * t_day
      );

      await lockUp.addLockType(
        2 * t_year,
        60 * t_day,
        0
      );

      const typeCount = await lockUp.lockTypeCount();

      // Check types add correctly
      expect(typeCount).to.be.eq(3);

      // Checke current locked amount of each user
      for (let i = 1; i <= typeCount; i++) {
        const userInfo = await lockUp.employeeInfo(accountList[i].address);
        expect(userInfo.lockAmount).to.be.eq(0);
      }

      // Add employee per lock up types
      const lockAmount = 100;
      const currentTime = await currentBlockTimeStamp();
      for (let i = 1; i <= typeCount; i++) {
        await lockUp.addEmployeeWithLockType(
          accountList[i].address,
          lockAmount,
          currentTime + t_day,
          i
        );
      }

      // Check lock-amount changed
      for (let i = 1; i <= typeCount; i++) {
        const userInfo = await lockUp.employeeInfo(accountList[i].address);
        expect(userInfo.lockAmount).to.be.eq(lockAmount);
      }
    })
  })

  describe("Remove Employee", async function() {
    this.beforeEach(async function () {
        const lockAmount = 100;
        await addEmployees(lockAmount);
    })

    it("Rejected by invalid employee", async function () {
        await expect(lockUp.removeEmployee(accountList[0].address)).to.be.rejectedWith("Not an employee");
    }) 

    it ("Employee removed correctly after first release", async function(){
        const curBlockTime = await currentBlockTimeStamp();

        const lockAmount = 365 * 30;

        const testAccount = accountList[1];

        // re-register with test lock amount
        await lockUp.addEmployee(
            testAccount.address, 
            lockAmount,
            curBlockTime + t_day
        );

        // Check out locaked amount
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

        const userInfo = await lockUp.employeeInfo(testAccount.address);
        const lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

        const firstRelease = userInfo.lockStart.add(lockInfo.releaseDelay).add(lockInfo.releaseInterval);
        
        // Set block timestamp as first release
        await setBlockTimeStamp(firstRelease.toNumber());

        // Check out current balance of account
        expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);

        // Claim first release
        await lockUp.connect(testAccount).claim();

        // Check out remaining locked amount
        // console.log("Locked Amount after first release : ", await lockUp.connect(teamMember).lockedAmount());
        expect(await lockUp.connect(testAccount).lockedAmount()).to.not.eq(lockAmount);

        // Check out balance of token released
        expect(await vda.balanceOf(testAccount.address)).to.not.eq(0);

        // Remove holder after first release.
        await lockUp.removeEmployee(testAccount.address);

        // Check out remaining locked amount
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(0);

        // Balance remains after removed in lockUp
        expect(await vda.balanceOf(testAccount.address)).to.not.eq(0);
    })
  })

  describe("Claim", async function () {
    it ("claimable amount is zero before first release", async function () {
        await addEmployees(100);
        for (let i = 1; i <= numberOfEmployee; i++) {
            expect(await lockUp.connect(accountList[i]).claimableAmount()).to.be.eq(0);
        }
    })

    it("Claim - release  with delay", async function () {
        const lockAmount = 4 * 365 * 10;
        
        const lockStart = await currentBlockTimeStamp();

        await lockUp.addEmployee(
            testAccount.address,
            lockAmount,
            lockStart + t_day
        );

        const userInfo = await lockUp.employeeInfo(testAccount.address);
        const lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

        const releasePerInterval = lockInfo.releaseInterval.mul(userInfo.lockAmount).div(lockInfo.lockDuration).toNumber(); // releaseInterval * lockAmount / lockDuration

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
        await addEmployees(100);

        for (let i = 1; i <= numberOfEmployee; i++) {
            expect(await lockUp.connect(accountList[i]).lockedAmount()).to.be.eq(100);
        }
    })

    it("get locked amount correctly after release", async function () {
        const lockAmount = 4 * 365 * 10;

        const currentTime = await currentBlockTimeStamp();
        
        // Add holder
        await lockUp.addEmployee(
            testAccount.address,
            lockAmount,
            currentTime + t_day
        );

        // Check out balance & locked amount before release
        expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

        const userInfo = await lockUp.employeeInfo(testAccount.address);
        const lockInfo = await lockUp.lockTypeInfo(userInfo.lockType);

        const releasePerInterval = lockInfo.releaseInterval.mul(userInfo.lockAmount).div(lockInfo.lockDuration).toNumber(); // releaseInterval * lockAmount / lockDuration

        // Set time to first release
        const firstRelease = userInfo.lockStart.add(lockInfo.releaseDelay).add(lockInfo.releaseInterval);
        await setBlockTimeStamp(firstRelease.toNumber());

        // Claim first relase
        await lockUp.connect(testAccount).claim();

        // Check out balance & locked amount after first release
        expect(await vda.balanceOf(testAccount.address)).to.be.eq(releasePerInterval);
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount - releasePerInterval);
    })
  })



  
});
