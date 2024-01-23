/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, createStorageNodeInputStruct, getWithdrawSignatures } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import { MockToken, VDADataCenterFacet, VDAStorageNodeFacet, VDAStorageNodeManagementFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, VALID_NUMBER_SLOTS } from "./utils/constant";

const { assert } = require('chai')

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

describe('StorageNode Deposit/Withdraw Test', async function () {
  let diamondAddress: string
  let tokenAddress: string
  
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];

  let verificationContract: VDAVerificationFacet;
  let datacenterContract: VDADataCenterFacet;
  let nodeContract: VDAStorageNodeFacet;
  let nodeManageContract: VDAStorageNodeManagementFacet;
  let tokenContract: MockToken;

  const datacenterIds : bigint[] = [];

  let snapShotWithDatacenters: SnapshotRestorer;

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

  const setNodeAddedStatus = async () => {
    await snapShotWithDatacenters.restore();
    await verificationContract.addTrustedSigner(trustedSigner.address);
    await nodeContract.setStakingRequired(true);
    await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
    await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
  }

  before(async function () {
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
    } = await deploy(undefined, ['VDAVerificationFacet', 'VDADataCenterFacet', 'VDAStorageNodeFacet', 'VDAStorageNodeManagementFacet']));

    verificationContract = await ethers.getContractAt("VDAVerificationFacet", diamondAddress);
    datacenterContract = await ethers.getContractAt("VDADataCenterFacet", diamondAddress)
    nodeContract = await ethers.getContractAt("VDAStorageNodeFacet", diamondAddress);
    nodeManageContract = await ethers.getContractAt("VDAStorageNodeManagementFacet", diamondAddress);
    
    tokenContract = await ethers.getContractAt("MockToken", tokenAddress);

    // Add datacenters
    for (let i = 0; i < DATA_CENTERS.length; i++) {
        const tx = await datacenterContract.addDataCenter(DATA_CENTERS[i])

        const transactionReceipt = await tx.wait();
        const events = await datacenterContract.queryFilter(
          datacenterContract.filters.AddDataCenter,
          transactionReceipt?.blockNumber,
          transactionReceipt?.blockNumber
        );
        if (events.length > 0) {
          datacenterIds.push(events[0].args[0]);
        }
    }
    snapShotWithDatacenters = await takeSnapshot();
  })

  describe("Decimal and token address test",async () => {
    it("Get contract denominator for latitude and longitude",async () => {
      expect(
        await nodeContract.DECIMAL()
      ).to.gt(0);
    })

    it("Get Verida token address",async () => {
      expect(
        await nodeContract.getVDATokenAddress()
      ).to.be.eq(tokenAddress);
    })
  })

  describe("Update STAKE_PER_SLOT", () => {
    const STAKE_PER_SLOT = (10n^18n) * 100n;
    it("Failed: Only contract owner allowed",async () => {
        await expect(
            nodeContract.connect(accounts[1]).updateStakePerSlot(STAKE_PER_SLOT)
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
    })

    it("Failed: 0 not available",async () => {
        await expect(
          nodeContract.updateStakePerSlot(0)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue")
    })

    it("Failed: Same value",async () => {
        const stakePerSlot = await nodeContract.getStakePerSlot();

        await expect(
          nodeContract.updateStakePerSlot(stakePerSlot)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue")
    })

    it("Success",async () => {
        await expect(
          nodeContract.updateStakePerSlot(STAKE_PER_SLOT)
        ).to.emit(nodeContract, "UpdateStakePerSlot").withArgs(STAKE_PER_SLOT);
    })
  })

  describe("Get balance", () => {
    before(async () => {
      await snapShotWithDatacenters.restore();
      await verificationContract.addTrustedSigner(trustedSigner.address);
    })

    it("0 for unregistered DID addresses",async () => {
      expect(await nodeContract.getBalance(Wallet.createRandom().address)).to.be.eq(0);
    })

    it("0 when Staking is not required",async () => {
      const currentSnapshot = await takeSnapshot();
      
      await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
      expect(await nodeContract.getBalance(user.address)).to.eq(0);

      await currentSnapshot.restore();
    })

    it("Success", async () => {
      // Set stakig as required
      await nodeContract.setStakingRequired(true);

      // Approve Token
      await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
      // Add node
      await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

      expect(await nodeContract.getBalance(user.address)).to.not.eq(0);
    })
    
  })

  describe("Deposit", () => {
    let requestor : SignerWithAddress;
    let currentSnapshot: SnapshotRestorer

    before(async () => {
      requestor = accounts[1];
      await setNodeAddedStatus();

      currentSnapshot = await takeSnapshot();
    })

    describe("Deposit from transaction sender", () => {
      before(async () => {
        // Mint 10000 tokens to the requestor
        await tokenContract.mint(requestor.address, BigInt("10000000000000000000000"));
      })

      it("Failed : unregistered DID", async () => {
        const randomDID = Wallet.createRandom().address;
        await expect(
          nodeContract.connect(requestor).depositToken(randomDID, 1)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
      })
  
      it("Failed : token not approved", async () => {
        await expect(
          nodeContract.connect(requestor).depositToken(user.address, 100)
        ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
      })
  
      it("Success", async () => {
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
      })
    })

    describe("Deposit from a provider", () => {
      let tokenProvider : SignerWithAddress

      before(async () => {
        await currentSnapshot.restore();

        tokenProvider = accounts[2];

        // Mint 10000 tokens to the tokenProvider
        await tokenContract.mint(tokenProvider.address, BigInt("10000000000000000000000"));
      })

      it("Failed : unregistered DID", async () => {
        const randomDID = Wallet.createRandom().address;
        await expect(
          nodeContract.connect(requestor).depositTokenFromProvider(randomDID, tokenProvider.address, 1)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidDIDAddress");
      })
  
      it("Failed : token not approved", async () => {
        await expect(
          nodeContract.connect(requestor).depositTokenFromProvider(user.address, tokenProvider.address, 100)
        ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
      })
  
      it("Success", async () => {
        const depositAmount = 100;
        // Approve token
        await tokenContract.connect(tokenProvider).approve(diamondAddress, depositAmount);
  
        // Deposit
        await expect(
            nodeContract.connect(requestor).depositTokenFromProvider(user.address, tokenProvider.address, depositAmount)
        ).to.emit(nodeContract, "TokenDeposited").withArgs(
            user.address,
            tokenProvider.address,
            depositAmount
        );
      })
    })
  })

  describe("StakingRequired", () => {
    before(async() => {
      await snapShotWithDatacenters.restore();

      expect(await nodeContract.isStakingRequired()).to.be.eq(false);
    })

    it("Failed: Only contract owner allowed",async () => {
      await expect(
          nodeContract.connect(accounts[1]).setStakingRequired(true)
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
    })

    it("setStakingRequired() & isStakingRequired()",async () => {
      await expect(
        nodeContract.setStakingRequired(true)
      ).to.emit(nodeContract, "UpdateStakingRequired").withArgs(true);

      expect(await nodeContract.isStakingRequired()).to.be.eq(true);
    })
  })

  describe("Slot count range", () => {
    let min : bigint
    let max : bigint
    before(async () => {
      [min, max] = await nodeContract.getSlotCountRange();
    })

    describe("Update mininum slot count", () => {
      it("Failed: Only contract owner allowed",async () => {
        await expect(
            nodeContract.connect(accounts[1]).updateMinSlotCount(min - 1n)
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
      })

      it("Failed : 0 is not available",async () => {
        await expect(
          nodeContract.updateMinSlotCount(0)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Current value is not available",async () => {
        await expect(
          nodeContract.updateMinSlotCount(min)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Value is bigger than maxSlots",async () => {
        await expect(
          nodeContract.updateMinSlotCount(max + 1n)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Success",async () => {
        await expect(
          nodeContract.updateMinSlotCount(min - 1n)
        ).to.emit(nodeContract, "UpdateMinSlotCount").withArgs(min- 1n);

        const [updateMin, updatedMax] = await nodeContract.getSlotCountRange();
        expect(updateMin).to.be.eq(min- 1n);
        expect(updatedMax).to.be.eq(max);

        // For maxSlots test
        min = updateMin;
      })
    })

    describe("Update maximum slot count", () => {
      it("Failed: Only contract owner allowed",async () => {
        await expect(
            nodeContract.connect(accounts[1]).updateMaxSlotCount(max + 1n)
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
      })

      it("Failed : 0 is not available",async () => {
        await expect(
            nodeContract.updateMaxSlotCount(0)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Current value is not available",async () => {
        await expect(
          nodeContract.updateMaxSlotCount(max)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Failed : Value is less than minSlots",async () => {
        await expect(
          nodeContract.updateMaxSlotCount(min - 1n)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
      })

      it("Success",async () => {
        await expect(
          nodeContract.updateMaxSlotCount(max + 1n)
        ).to.emit(nodeContract, "UpdateMaxSlotCount").withArgs(max + 1n);

        const [updateMin, updatedMax] = await nodeContract.getSlotCountRange();
        expect(updateMin).to.be.eq(min);
        expect(updatedMax).to.be.eq(max + 1n);
      })
    })
  })

  describe("Excess token amount", () => {
    let CUR_STAKE_PER_SLOT: bigint;

    before(async () => {
      CUR_STAKE_PER_SLOT = await nodeContract.getStakePerSlot();
    })

    describe("Test when staking not required", () => {
      before(async () => {
        await snapShotWithDatacenters.restore();
        await verificationContract.addTrustedSigner(trustedSigner.address);
        
        expect(await nodeContract.isStakingRequired()).to.be.eq(false);
        await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);

        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0); 
      })

      it("No changes by STAKE_PER_SLOT change",async () => {
        // Decrease STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT - 1n);
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

        // Increase STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT + 1n);
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);
      })

      it("Negative value by set staking required",async () => {
        await nodeContract.setStakingRequired(true);
        expect(await nodeContract.excessTokenAmount(user.address)).to.lessThan(0);  
      })
    })

    describe("Test when staking required", () => {
      before(async () => {
        await setNodeAddedStatus();
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0); 
      })

      it("Positive value by set staking not required",async () => {
        expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

        await nodeContract.setStakingRequired(false);
        expect(await nodeContract.excessTokenAmount(user.address)).to.greaterThan(0);

        // Restore staking required
        await nodeContract.setStakingRequired(true);
      })

      it("Positive value by decreasing STAKE_PER_SLOT",async () => {
        // Decrease STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT - 1n);
        expect(await nodeContract.excessTokenAmount(user.address)).to.greaterThan(0);
      })

      it("Negative value by increasing STAKE_PER_SLOT",async () => {
        // Increase STAKE_PER_SLOT
        await nodeContract.updateStakePerSlot(CUR_STAKE_PER_SLOT + 1n);

        expect(await nodeContract.excessTokenAmount(user.address)).to.lessThan(0);
      })
    })            
  })

  describe("Withdrawal Enable/Disable", () => {
    before(async () => {
      expect(await nodeContract.isWithdrawalEnabled()).to.be.eq(true);
    })

    it("Failed: Only contract owner allowed",async () => {
      await expect(
          nodeContract.connect(accounts[1]).setWithdrawalEnabled(false)
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
    })

    it("Failed : Same value",async () => {
      await expect(
        nodeContract.setWithdrawalEnabled(true)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Success",async () => {
      // Disable Withdrawal
      await expect(
        nodeContract.setWithdrawalEnabled(false)
      ).to.emit(nodeContract, "UpdateWithdrawalEnabled").withArgs(false);

      // Enable Withdrawal
      await expect(
        nodeContract.setWithdrawalEnabled(true)
      ).to.emit(nodeContract, "UpdateWithdrawalEnabled").withArgs(true);
    })
  })

  describe("Withdraw", () => {
    let requestor : SignerWithAddress;

    // let withdrawalAvailableState : SnapshotRestorer;

    const checkWithdrawal =async (
      expectResult: boolean,
      requestor: SignerWithAddress,
      customError?: string
    ) => {
      // Confirm current excess token amount is not zero
      const excessTokenAmount = await nodeContract.excessTokenAmount(user.address);
      expect(excessTokenAmount).to.not.eq(0);

      const recipient = Wallet.createRandom();
      const amount = excessTokenAmount;

      // Withdraw
      const nonce = await nodeManageContract.nonce(user.address);
      const {requestSignature, requestProof} = getWithdrawSignatures(user, recipient.address, amount, nonce);
      if (expectResult === true) {
        await expect(
          nodeContract.connect(requestor).withdraw(user.address, recipient.address, amount, requestSignature, requestProof)
        ).to.emit(nodeContract, "TokenWithdrawn").withArgs(
          user.address,
          recipient.address,
          excessTokenAmount);
        
        // Check excess tokens are released to recipient
        expect(
          await tokenContract.balanceOf(recipient.address)
        ).to.be.eq(excessTokenAmount);
      } else {
        await expect(
          nodeContract.connect(requestor).withdraw(user.address, recipient.address, amount, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(nodeContract, customError!);
      }
      
    }

    before(async () => {
        requestor = accounts[1];

        await setNodeAddedStatus();
    })

    it("Failed : No excess token",async () => {
      const nonce = await nodeManageContract.nonce(user.address);
      const amount = 10;
      const recipient = Wallet.createRandom();

      expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

      const {requestSignature, requestProof} = getWithdrawSignatures(user, recipient.address, amount, nonce);
      await expect(
        nodeContract.withdraw(user.address, recipient.address, amount, requestSignature, requestProof)
      ).to.be.revertedWithCustomError(nodeContract, "NoExcessTokenAmount");
    })

    it("Failed : Amount is bigger than excess token amount",async () => {
      const currentSnapshot = await takeSnapshot();

      // Confirm current excess token amount is zero
      expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

      let stakePerSlot = await nodeContract.getStakePerSlot();
      // Decrease STAKE_PER_SLOT
      stakePerSlot = stakePerSlot - 10n;
      await nodeContract.updateStakePerSlot(stakePerSlot);

      // Confirm current excess token amount is not zero
      const excessTokenAmount = await nodeContract.excessTokenAmount(user.address);
      expect(excessTokenAmount).to.not.eq(0);

      const amount = excessTokenAmount + 10n;
      const recipient = Wallet.createRandom();

      const nonce = await nodeManageContract.nonce(user.address);
      const {requestSignature, requestProof} = getWithdrawSignatures(user, recipient.address, amount, nonce);
      await expect(
        nodeContract.connect(requestor).withdraw(user.address, recipient.address, amount, requestSignature, requestProof)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidAmount");
      
      await currentSnapshot.restore();
    })

    it("Failed : Withdrawal disabled",async () => {
      // Confirm current excess token amount is zero
      expect(await nodeContract.excessTokenAmount(user.address)).to.be.eq(0);

      let stakePerSlot = await nodeContract.getStakePerSlot();
      // Decrease STAKE_PER_SLOT
      stakePerSlot = stakePerSlot - 10n;
      await nodeContract.updateStakePerSlot(stakePerSlot);

      // withdrawalAvailableState = await takeSnapshot();

      // Disable withdrawal
      await expect(nodeContract.setWithdrawalEnabled(false)).to.emit(nodeContract, "UpdateWithdrawalEnabled");

      await checkWithdrawal(false, requestor, "WithdrawalDisabled");
    })

    it("Success",async () => {
      // Enable withdrawal
      await expect(nodeContract.setWithdrawalEnabled(true)).to.emit(nodeContract, "UpdateWithdrawalEnabled");

      // Withdraw
      await checkWithdrawal(true, requestor);
    })
  });
})
