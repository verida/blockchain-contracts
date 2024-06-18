/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, createStorageNodeInputStruct, getLockSignatures, getUnlockSignatures, getWithdrawSignatures } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, HDNodeWallet, Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import { MockToken, VDADataCentreFacet, VDAStorageNodeFacet, VDAStorageNodeManagementFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, VALID_NUMBER_SLOTS } from "./utils/constant";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const trustedSigner = Wallet.createRandom();
const user = Wallet.createRandom();
const storageNode = createStorageNodeInputStruct(
  ("node-" + user.address).toLowerCase(),
  user.address, 
  "https://1",
  "us",
  "north america",
  1,
  -90,
  -180,
  VALID_NUMBER_SLOTS,
  true
);

describe('StorageNode Lock/Unlock Test', async function () {
  let diamondAddress: string
  let tokenAddress: string
  
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];

  let verificationContract: VDAVerificationFacet;
  let datacentreContract: VDADataCentreFacet;
  let nodeContract: VDAStorageNodeFacet;
  let nodeManageContract: VDAStorageNodeManagementFacet;
  let tokenContract: MockToken;

  const datacentreIds : bigint[] = [];

  let requestor: SignerWithAddress;
  let snapShotNodeAdded: SnapshotRestorer;
  let snapShotTokenLocked: SnapshotRestorer;

  const unregisteredDID = Wallet.createRandom();

  const purpose = "purpose-1";
  const purposeList = [purpose, "purpose-2", "purpose-3"];
  const amount = 100;

  const slotTokenAmount = async (numberSlot: bigint) : Promise<bigint> => {
    const stakePerSlot = await nodeContract.getStakePerSlot();
    let tokenAmount = stakePerSlot * numberSlot;
    return tokenAmount;
  }

  const approveToken =async (numberSlot: bigint, from: SignerWithAddress, to: string, isMinting = false) => {
    const tokenAmount = await slotTokenAmount(numberSlot);
    if (isMinting) {
        await tokenContract.mint(from.address, tokenAmount.toString());
    }
    await tokenContract.connect(from).approve(to, tokenAmount.toString());
  }

  const checkLock = async (
    requestor: SignerWithAddress,
    didWallet: Wallet | HDNodeWallet,
    purpose: string,
    amount: BigNumberish,
    withDeposit: boolean,
    expectResult = true,
    isRevertedWithCustomError = true,
    errorName?: string
  ) => {
    const nonce = await nodeManageContract.nonce(didWallet.address);
    const {requestSignature, requestProof} = getLockSignatures(didWallet, purpose, amount, withDeposit, nonce);

    // Approve token
    if (withDeposit === true) {
      await tokenContract.connect(requestor).approve(diamondAddress, amount);
    }

    if (expectResult === true) {
      await expect(
        nodeContract.connect(requestor).lock(didWallet.address, purpose, amount, withDeposit, requestSignature, requestProof)
      ).to.emit(nodeContract, "Lock").withArgs(
        didWallet.address,
        purpose,
        amount
      );
    } else {
      if (isRevertedWithCustomError === true) {
        await expect(
          nodeContract.connect(requestor).lock(didWallet.address, purpose, amount, withDeposit, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(nodeContract, errorName!);
      } else {
        await expect(
          nodeContract.connect(requestor).lock(didWallet.address, purpose, amount, withDeposit, requestSignature, requestProof)
        ).to.be.rejectedWith(errorName!);
      }
    }
  }
  
  before(async () => {
    const accountlist = await ethers.getSigners();
    owner = accountlist[0];

    accounts = [
      accountlist[1],
      accountlist[2],
      accountlist[3],
      accountlist[4]
    ];

    ({
      diamondAddress,
      tokenAddress
    } = await deploy(undefined, ['VDAVerificationFacet', 'VDADataCentreFacet', 'VDAStorageNodeFacet', 'VDAStorageNodeManagementFacet']));

    verificationContract = await ethers.getContractAt("VDAVerificationFacet", diamondAddress);
    datacentreContract = await ethers.getContractAt("VDADataCentreFacet", diamondAddress)
    nodeContract = await ethers.getContractAt("VDAStorageNodeFacet", diamondAddress);
    nodeManageContract = await ethers.getContractAt("VDAStorageNodeManagementFacet", diamondAddress);
    
    tokenContract = await ethers.getContractAt("MockToken", tokenAddress);

    // Add datacentres
    for (let i = 0; i < DATA_CENTERS.length; i++) {
        const tx = await datacentreContract.addDataCentre(DATA_CENTERS[i])

        const transactionReceipt = await tx.wait();
        const events = await datacentreContract.queryFilter(
          datacentreContract.filters.AddDataCentre,
          transactionReceipt?.blockNumber,
          transactionReceipt?.blockNumber
        );
        if (events.length > 0) {
          datacentreIds.push(events[0].args[0]);
        }
    }
    
    // Add a node
    await verificationContract.addTrustedSigner(trustedSigner.address);
    await nodeContract.setStakingRequired(true);
    await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
    await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

    // Mint 10000 tokens to the requestor
    requestor = accounts[1];
    await tokenContract.mint(requestor.address, BigInt("10000000000000000000000"));
    const depositAmount = 100;
    // Approve token
    await tokenContract.connect(requestor).approve(diamondAddress, depositAmount);

    // Deposit
    await expect(
        nodeContract.connect(requestor).depositToken(user.address, depositAmount)
    ).to.emit(nodeContract, "TokenDeposited").withArgs(
        user.address,
        requestor.address,
        depositAmount
    );

    snapShotNodeAdded = await takeSnapshot();
  })

  describe("Lock", () => {
    describe("Failed for invalid input parameters", () => {
      it("Failed : Empty purpose name", async () => {
        await expect(
          nodeContract.lock(user.address, "", 0, true, '0x', '0x')
        ).to.be.revertedWithCustomError(nodeContract, "InvalidPurpose");
      })

      it("Failed : Invalid amount of 0", async () => {
        await expect(
          nodeContract.lock(user.address, "purpose-1", 0, true, '0x', '0x')
        ).to.be.revertedWithCustomError(nodeContract, "InvalidAmount");
      })

      it("Failed : Invalid request signature", async () => {
        // Empty signature
        await expect(
          nodeContract.lock(user.address, "purpose-1", 1, true, '0x', '0x')
        ).to.be.revertedWithCustomError(nodeContract, "InvalidSignature");
      })
    })

    describe("Lock with token transfer", () => {
      it("Failed : Token not approved from transaction sender", async () => {
        const requestor = accounts[2];
        expect(await tokenContract.balanceOf(requestor.address)).to.be.eq(0);

        // Failed for unregistered DID
        await checkLock(requestor, unregisteredDID, "purpose", 1, true, false, false, "ERC20InsufficientBalance");

        // Failed for registered DID
        await checkLock(requestor, user, "purpose", 1, true, false, false, "ERC20InsufficientBalance");
      })

      it("Success for unregistered DID", async () => {
        expect(await nodeManageContract.isRegisteredNodeAddress(unregisteredDID.address)).to.be.eq(false);
        
        await checkLock(requestor, unregisteredDID, purpose, amount, true, true);
        expect(await nodeContract.locked(unregisteredDID.address, purpose)).to.be.eq(amount);

      })

      it("Success for registered DID", async () => {
        await checkLock(requestor, user, purpose, amount, true, true);
        expect(await nodeContract.locked(user.address, purpose)).to.be.eq(amount);        
      })
    })

    describe("Lock without token transfer", () => {
      before(async () => {
        await snapShotNodeAdded.restore();
      })

      it("Failed : Not enough deposited token", async () => {
        // Unregistered DID
        expect(await nodeContract.excessTokenAmount(unregisteredDID.address)).to.be.eq(0);
        await checkLock(owner, unregisteredDID, "1", 1, false, false, true, "InvalidAmount");

        // Registered DID
        const excessAmount = await nodeContract.excessTokenAmount(user.address);
        await checkLock(owner, user, "1", excessAmount+1n, false, false, true, "InvalidAmount");
      })

      it("Success for unregistered DID with depositToken()", async () => {
        expect(await nodeContract.getBalance(unregisteredDID.address)).to.be.eq(0);

        expect(await tokenContract.balanceOf(requestor.address)).to.greaterThanOrEqual(amount);
        // Deposit token
        await tokenContract.connect(requestor).approve(diamondAddress, amount);
        await nodeContract.connect(requestor).depositToken(unregisteredDID.address, amount);

        // Lock
        await checkLock(owner, unregisteredDID, purpose, amount, false, true);
      })

      it("Success for registered DID", async () => {
        const excessAmount = await nodeContract.excessTokenAmount(user.address);
        expect(excessAmount).to.greaterThan(0);

        // Lock
        await checkLock(owner, user, purpose, excessAmount, false, true);

        // Check staked amount decreased
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

        snapShotTokenLocked = await takeSnapshot();
      })
    })
  })

  describe("Get Locked amount", () => {
    const unknownPurposeList = ["", "unknown"];

    it("Return 0 for unknown purposes and locked DIDs", async () => {
      for (let i = 0; i < unknownPurposeList.length; i++) {
        expect(await nodeContract.locked(unregisteredDID.address, unknownPurposeList[i])).to.be.eq(0);
        expect(await nodeContract.locked(user.address, unknownPurposeList[i])).to.be.eq(0);
      }
    })

    it("Return 0 for any purposes and non-locked DID", async () => {
      const noLockedDID = Wallet.createRandom();
      const purposeList = [...unknownPurposeList, purpose];
      for (let i = 0; i < purposeList.length; i++) {
        expect(await nodeContract.locked(noLockedDID.address, purposeList[i])).to.be.eq(0);
      }
    })

    it("Return locked amounts", async () => {
      expect(await nodeContract.locked(unregisteredDID.address, purpose)).to.be.eq(amount);

      expect(await nodeContract.locked(user.address, purpose)).to.greaterThan(0);
    })
  })

  describe("Get lock information list", () => {
    
    const amountList = [100, 200, 300];

    before(async () => {
      let totalAmount = amountList.reduce((acc, cur) => acc + cur);
      if ((await tokenContract.balanceOf(requestor.address)) < totalAmount) {
        await tokenContract.mint(requestor.address, totalAmount);
      }

      // Add more locks to the `unregisteredDID`
      for (let i = 0; i < purposeList.length; i++) {
        await checkLock(requestor, unregisteredDID, purposeList[i], amountList[i], true, true);
      }
    })

    it("Failed : Invalid page size", async () => {
      // Invalid page size of 0
      await expect(
        nodeContract.getLocks(unregisteredDID.address, 0, 1)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidPageSize");

      // Invalid page size. Out of range
      await expect(
        nodeContract.getLocks(unregisteredDID.address, 101, 1)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidPageSize");
    })

    it("Failed : Invalid page number - 0", async () => {
      await expect(
        nodeContract.getLocks(nodeContract, 1, 0)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidPageNumber");
    })

    it("Return empty array for any page of non-locked DIDs", async () => {
      const noLockedDID = Wallet.createRandom();

      expect(await nodeContract.getLocks(noLockedDID.address, 10, 1)).to.deep.equal([]);
      expect(await nodeContract.getLocks(noLockedDID.address, 10, 100)).to.deep.equal([]);
    })

    it("Return lock information list for valid page size and page number", async () => {
      // Return one element array for various page sizes because locked only one purpose
      expect((await nodeContract.getLocks(user.address, 1, 1)).length).to.be.eq(1);
      expect((await nodeContract.getLocks(user.address, 10, 1)).length).to.be.eq(1);
      expect((await nodeContract.getLocks(user.address, 100, 1)).length).to.be.eq(1);

      const pageSize = 2;
      // Return an array with elements of page size
      expect((await nodeContract.getLocks(unregisteredDID.address, pageSize, 1)).length).to.be.eq(pageSize);

      // Return an array with less elements than the page size
      expect((await nodeContract.getLocks(unregisteredDID.address, pageSize, 2)).length).to.be.lessThan(pageSize);
    })
  })

  describe("Unlock", () => {
    const checkUnlock = async (
      didWallet: Wallet | HDNodeWallet,
      purpose: string,
      expectedResult = true,
      revertError?: string
    ) => {
      const nonce = await nodeManageContract.nonce(didWallet.address);
      const {requestSignature, requestProof} = getUnlockSignatures(didWallet, purpose, nonce);
       if (expectedResult === true) {
        await expect(
          nodeContract.unlock(didWallet.address, purpose, requestSignature, requestProof)
        ).to.emit(nodeContract, "Unlock").withArgs(
          didWallet.address,
          purpose,
          anyValue
        )
       } else {
        await expect(
          nodeContract.unlock(didWallet.address, purpose, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(nodeContract, revertError!);
       }
    }

    let currentSnapShot: SnapshotRestorer;
    before(async () => {
      currentSnapShot = await takeSnapshot();
    })
    after(async () => {
      await currentSnapShot.restore();
    })

    it("Failed : Invalid request signature and proof", async () => {
      await expect(
        nodeContract.unlock(user.address, "", "0x", "0x")
      ).to.be.revertedWithCustomError(nodeContract, "InvalidSignature");
    })

    it("Failed : Invalid purpose", async () => {
      // Unknown purpose for locked DIDs
      const unknownPurposeList = ["", "unknown-1"];
      for (let i = 0; i < unknownPurposeList.length; i++) {
        await checkUnlock(unregisteredDID, unknownPurposeList[i], false, "InvalidPurpose");
        await checkUnlock(user, unknownPurposeList[i], false, "InvalidPurpose");
      }

      // Any purposes for non-locked DIDs
      const noLockedDID = Wallet.createRandom();
      await checkUnlock(noLockedDID, purpose, false, "InvalidPurpose");
      await checkUnlock(noLockedDID, unknownPurposeList[0], false, "InvalidPurpose");
    })

    it("Success : Unregistered DID", async () => {
      for (let i = 0; i < purposeList.length; i++) {
        const purposeLockAmount = await nodeContract.locked(unregisteredDID.address, purposeList[i]);
        expect(purposeLockAmount).to.be.greaterThan(0);

        const orgBalance = await nodeContract.getBalance(unregisteredDID.address);

        await checkUnlock(unregisteredDID, purposeList[i], true);

        expect(
          await nodeContract.getBalance(unregisteredDID.address)
        ).to.be.eq(orgBalance + purposeLockAmount);
      }
    })

    it("Success : registered DID", async () => {
      const orgBalance = await nodeContract.getBalance(user.address);
      const orgExcessAmount = await nodeContract.excessTokenAmount(user.address);

      // Ensure there is locked amount for the pupose
      expect(await nodeContract.locked(user.address,purpose)).to.be.greaterThan(0);

      // Unlock
      await checkUnlock(user, purpose, true);

      expect(
        await nodeContract.getBalance(user.address)
      ).to.be.greaterThan(orgBalance);
      expect(
        await nodeContract.excessTokenAmount(user.address)
      ).to.be.greaterThan(orgExcessAmount);
    })
  })

  describe("Unlock and withdraw", () => {
    const recipient = Wallet.createRandom();

    const checkUnlockAndWithdraw = async (
      didWallet: Wallet | HDNodeWallet,
      purpose: string,
      recipient: string,
      expectedResult = true,
      revertError?: string
    ) => {
      const nonce = await nodeManageContract.nonce(didWallet.address);
      const {requestSignature, requestProof} = getUnlockSignatures(didWallet, purpose, nonce, recipient);
       if (expectedResult === true) {
        await expect(
          nodeContract.unlockAndWithdraw(didWallet.address, purpose, recipient, requestSignature, requestProof)
        ).to.emit(nodeContract, "UnlockAndWithdraw").withArgs(
          didWallet.address,
          purpose,
          anyValue,
          recipient
        )
       } else {
        await expect(
          nodeContract.unlockAndWithdraw(didWallet.address, purpose, recipient, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(nodeContract, revertError!);
       }
    }
    
    it("Failed : Invalid request signature and proof", async () => {
      await expect(
        nodeContract.unlockAndWithdraw(user.address, "", recipient.address, "0x", "0x")
      ).to.be.revertedWithCustomError(nodeContract, "InvalidSignature");
    })

    it("Failed : Invalid purpose", async () => {
      // Unknown purpose for locked DIDs
      const unknownPurposeList = ["", "unknown-1"];
      for (let i = 0; i < unknownPurposeList.length; i++) {
        await checkUnlockAndWithdraw(unregisteredDID, unknownPurposeList[i], recipient.address, false, "InvalidPurpose");
        await checkUnlockAndWithdraw(user, unknownPurposeList[i], recipient.address, false, "InvalidPurpose");
      }

      // Any purposes for non-locked DIDs
      const noLockedDID = Wallet.createRandom();
      await checkUnlockAndWithdraw(noLockedDID, purpose, recipient.address, false, "InvalidPurpose");
      await checkUnlockAndWithdraw(noLockedDID, unknownPurposeList[0], recipient.address, false, "InvalidPurpose");
    })

    it("Success : Unregistered DID", async () => {
      // Original state of user in the `StorageNodeRegistry` contract
      const orgBalance = await nodeContract.getBalance(unregisteredDID.address);

      for (let i = 0; i < purposeList.length; i++) {
        // Original recipient token amount
        const recipientOrgAmount = await tokenContract.balanceOf(recipient.address);

        // Ensure there is locked amount for purpose
        const purposeLockAmount = await nodeContract.locked(unregisteredDID.address, purposeList[i]);
        expect(purposeLockAmount).to.be.greaterThan(0);

        // Unlock and withdraw
        await checkUnlockAndWithdraw(unregisteredDID, purposeList[i], recipient.address, true);

        // Verify balance not changed
        expect(
          await nodeContract.getBalance(unregisteredDID.address)
        ).to.be.eq(orgBalance);

        // Verify recipient balance increased
        expect(await tokenContract.balanceOf(recipient.address)).to.be.eq(recipientOrgAmount + purposeLockAmount);
      }
    })

    it("Success : registered DID", async () => {
      // Original recipient token amount
      const recipientOrgAmount = await tokenContract.balanceOf(recipient.address);

      // Original state of user in the `StorageNodeRegistry` contract
      const orgBalance = await nodeContract.getBalance(user.address);
      const orgExcessAmount = await nodeContract.excessTokenAmount(user.address);

      // Ensure there is locked amount for the pupose
      const lockedAmount = await nodeContract.locked(user.address,purpose);
      expect(lockedAmount).to.be.greaterThan(0);

      // Unlock
      await checkUnlockAndWithdraw(user, purpose, recipient.address, true);

      // Check recipient states
      expect(
        await nodeContract.getBalance(user.address)
      ).to.be.eq(orgBalance);
      expect(
        await nodeContract.excessTokenAmount(user.address)
      ).to.be.eq(orgExcessAmount);

      // Verify recipient token amount increased
      expect(await tokenContract.balanceOf(recipient.address)).to.be.eq(recipientOrgAmount + lockedAmount);
    })
  })

  
})
