/* eslint-disable camelcase */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from 'ethereum-waffle'
import hre, { ethers , upgrades } from "hardhat"

import { VeridaToken } from "../../VDA-ERC20/typechain/VeridaToken"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "@ethersproject/bignumber"
import { RecipientLockUp } from "../typechain"

chai.use(solidity)
chai.use(chaiAsPromised)

let accountList : SignerWithAddress[];

let numberOfRecipient = 5;

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
      numberOfRecipient = accountList.length;
})


describe("RecipientLockUp Test", function () {
  let vda: VeridaToken;
  let lockUp : RecipientLockUp;

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

  const addRecipients = async (lockAmount: number) => {
    const curBlockTime = await currentBlockTimeStamp();

    // Send vda tokens to lockup contract
    vda.mint(lockUp.address, lockAmount * numberOfRecipient);

    // Add Recipients
    for (let i = 1; i <= numberOfRecipient; i++) {
      await lockUp.addRecipient(
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

    const lockFactory = await ethers.getContractFactory('RecipientLockUp');
    lockUp = (await upgrades.deployProxy(
        lockFactory,
        [vda.address],
        {
            initializer: 'initialize'
        }
    )) as RecipientLockUp;

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

  describe("Add Recipient", async function () {
    it("Rejected for zero address", async function () {
        await expect(lockUp.addRecipient(
            '0x0000000000000000000000000000000000000000',
            100,
            0
        )).to.be.rejectedWith('Invalid zero address');            
    })

    it ("Rejected by 0 lock amount", async function() {
        await expect(lockUp.addRecipient(
            testAccount.address,
            0,
            0
        )).to.be.rejectedWith("Invalid lock amount");
    })
    
    it ("Rejected by insufficient token amount inside contract", async function () {
      const currentTime = await currentBlockTimeStamp();
      await expect(lockUp.addRecipient(
          testAccount.address, 
          1,
          currentTime + t_day
      )).to.be.rejectedWith("Insufficient token amount");
    })

    it ("Rejected by lockStart time before current block time", async function(){
        const currentBlockTime = await currentBlockTimeStamp();
        const typeCount = await lockUp.lockTypeCount();
        for (let i = 1; i <= typeCount; i++) {
          await expect(lockUp.addRecipient(
              testAccount.address,
              100,
              currentBlockTime - 100
          )).to.be.rejectedWith('Invalid lock start time');
        }
    })

    it("Add Recipient correctly", async function () {
        const typeCount = await getTypeCount();
        
        // Checke current amount of each user
        for (let i = 1; i <= typeCount; i++) {
            const userInfo = await lockUp.recipientInfo(accountList[i].address);
            expect(userInfo.lockAmount).to.be.eq(0);
        }

        const len = accountList.length > 3 ? 3 : accountList.length;
        // Send tokens to lock up contract
        let needAmount = 0;
        for (let i = 1; i <= len; i++) {
          needAmount += i * 100;
        }
        await vda.mint(lockUp.address, needAmount);

        // Add 3 recipient with different lock amount
        const currentTime = await currentBlockTimeStamp();
        for (let i = 1; i <= len; i++) {
          await lockUp.addRecipient(
            accountList[i].address,
            i * 100,
            currentTime + t_day
          );
        }
        
        // Check amount changed
        for (let i = 1; i <= typeCount; i++) {
            const userInfo = await lockUp.recipientInfo(accountList[i].address);
            expect(userInfo.lockAmount).to.be.eq(i * 100);
        }
    })
  })

  describe("Add recipient with lock type", async function () {
    it("Rejected by invalid lock type.", async function () {
        // LockType rejected
        const currentLockTypeCount = await lockUp.lockTypeCount();
        await expect(lockUp.addRecipientWithLockType(testAccount.address, 0, 100, 0)).to.be.rejectedWith("Invalid lock type");
        await expect(lockUp.addRecipientWithLockType(testAccount.address, currentLockTypeCount+1, 100, 0)).to.be.rejectedWith("Invalid lock type");
    })

    it ("Change lock setting by add again", async function () {
      const testAccount = accountList[1];

      // Add recipient per lock up types
      const totalAmount = 500
      // Send tokens to lockUp contract
      await vda.mint(lockUp.address, totalAmount);

      // Check out balance of lockUp contract
      expect(await vda.balanceOf(lockUp.address)).to.be.eq(totalAmount);

      // Add recipient with lockAmount 100
      let lockAmount = 100;
      
      const currentTime = await currentBlockTimeStamp();
      await lockUp.addRecipient(
        testAccount.address,
        lockAmount,
        currentTime + t_day      
      );

      // Check out total lock amount of lockUp contract
      expect(await lockUp.totalLockedAmount()).to.be.eq(lockAmount);

      // Reregister testAcount with different lockAmount
      lockAmount = 300;

      // re-register
      await lockUp.addRecipient(
        testAccount.address,
        lockAmount,
        currentTime + t_day
      );

      // Check out total lock amount changed
      expect(await lockUp.totalLockedAmount()).to.be.eq(lockAmount);

      // Check whether lockedamount changed for this employee
      expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);
    })

    it("Add recipient correctly with lock type", async function () {
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
        const userInfo = await lockUp.recipientInfo(accountList[i].address);
        expect(userInfo.lockAmount).to.be.eq(0);
      }

      // Add recipient per lock up types
      const lockAmount = 100;
      // Send tokens to lockup contract before adding any recipients
      await vda.mint(lockUp.address, lockAmount * typeCount);

      const currentTime = await currentBlockTimeStamp();
      for (let i = 1; i <= typeCount; i++) {
        await lockUp.addRecipientWithLockType(
          accountList[i].address,
          lockAmount,
          currentTime + t_day,
          i
        );
      }

      // Check lock-amount changed
      for (let i = 1; i <= typeCount; i++) {
        const userInfo = await lockUp.recipientInfo(accountList[i].address);
        expect(userInfo.lockAmount).to.be.eq(lockAmount);
      }
    })
  })
  

  describe("Remove Recipient", async function() {
    it("Rejected by invalid recipient", async function () {
        const lockAmount = 100;
        await addRecipients(lockAmount);
        await expect(lockUp.removeRecipient(accountList[0].address)).to.be.rejectedWith("Not an recipient");
    }) 

    it ("Recipient removed correctly after first release", async function(){
        const curBlockTime = await currentBlockTimeStamp();

        const testAccount = accountList[1];
        const lockAmount = 365 * 30;

        const secondAccount = accountList[2];
        const secondLockAmount = 500;

        // Send tokens to contract
        await vda.mint(lockUp.address, lockAmount + secondLockAmount)

        // console.log('Locked amount before re-register', await lockUp.totalLockedAmount());

        // re-register with test lock amount
        await lockUp.addRecipient(
            testAccount.address, 
            lockAmount,
            curBlockTime + t_day
        );

        await lockUp.addRecipient(
          secondAccount.address, 
          secondLockAmount,
          curBlockTime + t_year
      );

        // console.log('Locked amount after re-register', await lockUp.totalLockedAmount());

        // Check out total locked amount
        expect(await lockUp.totalLockedAmount()).to.be.eq(lockAmount + secondLockAmount);

        // Check out locked amount of test account.
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

        const userInfo = await lockUp.recipientInfo(testAccount.address);
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
        await lockUp.removeRecipient(testAccount.address);

        // Check out remaining locked amount
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(0);

        // Balance remains after removed in lockUp
        expect(await vda.balanceOf(testAccount.address)).to.not.eq(0);

        // Check out total locked amount of lockUp contract
        const released = await vda.balanceOf(testAccount.address);
        expect(await lockUp.totalLockedAmount()).to.be.eq(secondLockAmount);
        expect(await vda.balanceOf(lockUp.address)).to.be.eq(BigNumber.from(lockAmount + secondLockAmount).sub(released));

    })
  })

  describe("Claim", async function () {
    it ("claimable amount is zero before first release", async function () {
        await addRecipients(100);
        for (let i = 1; i <= numberOfRecipient; i++) {
            expect(await lockUp.connect(accountList[i]).claimableAmount()).to.be.eq(0);
        }
    })

    it("Claim - release  with delay", async function () {
        const lockAmount = 4 * 365 * 10;
        
        const lockStart = await currentBlockTimeStamp();

        // Send token to lockUp contract
        await vda.mint(lockUp.address, lockAmount);

        await lockUp.addRecipient(
            testAccount.address,
            lockAmount,
            lockStart + t_day
        );

        const userInfo = await lockUp.recipientInfo(testAccount.address);
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
        await addRecipients(100);

        for (let i = 1; i <= numberOfRecipient; i++) {
            expect(await lockUp.connect(accountList[i]).lockedAmount()).to.be.eq(100);
        }
    })

    it("get locked amount correctly after release", async function () {
        const lockAmount = 4 * 365 * 10;

        const currentTime = await currentBlockTimeStamp();

        // Send tokens to lockUp contract
        await vda.mint(lockUp.address, lockAmount);
        
        // Add holder
        await lockUp.addRecipient(
            testAccount.address,
            lockAmount,
            currentTime + t_day
        );

        // Check out balance & locked amount before release
        expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);
        expect(await lockUp.connect(testAccount).lockedAmount()).to.be.eq(lockAmount);

        const userInfo = await lockUp.recipientInfo(testAccount.address);
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

  describe('Withdraw unlocked tokens', async function () {
    const totalAmount = 100000;
    const lockAmount = 1000;

    this.beforeEach(async function () {
      await vda.mint(lockUp.address, totalAmount);

      const currentTime = await currentBlockTimeStamp();
      // Add holder
      await lockUp.addRecipient(
        testAccount.address,
        lockAmount,
        currentTime + t_day
      );
    })

    it('Rejected because not a owner', async function () {
      // check whether recipient added with lockAmount
      expect(await lockUp.totalLockedAmount()).to.be.eq(lockAmount);

      const non_owner = accountList[2];
      
      await expect(lockUp.connect(non_owner).withdrawUnlockedTokens()).to.be.rejectedWith('Ownable: caller is not the owner');
    })

    it('Withdraw to owner', async function () {
      const owner = accountList[0];
      // Check locked amount inside lockup contract
      expect(await lockUp.totalLockedAmount()).to.be.eq(lockAmount);

      // Check owner balance for vda token
      expect(await vda.balanceOf(owner.address)).to.be.eq(0);

      // Withdraw unlocked amount
      await lockUp.withdrawUnlockedTokens();

      // Checked withdrawn amount
      expect(await vda.balanceOf(owner.address)).to.be.eq(totalAmount - lockAmount);
    })

    it('Withdraw to another address', async function () {
      const testAccount = accountList[3];

      // Check locked amount inside lockup contract
      expect(await lockUp.totalLockedAmount()).to.be.eq(lockAmount);

      // Check testAccount balance for vda token
      expect(await vda.balanceOf(testAccount.address)).to.be.eq(0);

      // Withdraw unlocked amount
      // const result = await lockUp.withdrawUnlockedTokensTo(testAccount.address);
      await expect(lockUp.withdrawUnlockedTokensTo(testAccount.address))
        .to.emit(lockUp, 'WtihdrawTokens')
        .withArgs(testAccount.address, totalAmount - lockAmount);

      // Checked withdrawn amount
      expect(await vda.balanceOf(testAccount.address)).to.be.eq(totalAmount - lockAmount);
    })
  })
});
