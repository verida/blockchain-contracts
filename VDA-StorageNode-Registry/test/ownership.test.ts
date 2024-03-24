/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { OwnershipFacet } from "../typechain-types";
import { SnapshotRestorer, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";

describe('Ownership Test', async function () {
  let diamondAddress: string
  
  let owner: SignerWithAddress;
  let newOwner: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let contract: OwnershipFacet;

  let transferStartedState : SnapshotRestorer

  before(async function () {
    const accountlist = await ethers.getSigners();
    owner = accountlist[0];
    newOwner = accountlist[1];

    accounts = [
      accountlist[2],
      accountlist[3],
      accountlist[4]
    ];

    ({
      diamondAddress
    } = await deploy());

    contract = await ethers.getContractAt("OwnershipFacet", diamondAddress)
  })

  describe("Transfer ownership start", () => {
    before(async () => {
      expect(await contract.owner()).to.be.eq(owner.address);
    })

    it("Failed: from non-owner", async () => {
      await expect(
        contract.connect(accounts[0]).transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(contract, "NotContractOwner");
    })

    it("Failed: To zero address", async () => {
      await expect(
        contract.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    })

    it("Failed: To current owner", async () => {
      await expect(
        contract.transferOwnership(owner.address)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    })

    it("Success", async () => {
      await expect(
        contract.transferOwnership(newOwner.address)
      ).to.emit(contract, "OwnershipTransferStarted").withArgs(owner.address, newOwner.address);

      transferStartedState = await takeSnapshot();
    })

    it("Failed: To pending owner", async () => {
      await expect(
        contract.transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(contract, "InvalidAddress");
    })
  })

  describe("Transfer owenrship cancel", () => {
    it("Failed: from non-owner", async () => {
      await expect(
        contract.connect(accounts[0]).cancelTransferOwnership()
      ).to.be.revertedWithCustomError(contract, "NotContractOwner");
    })

    it("Scuccess", async () => {
      await expect(
        contract.cancelTransferOwnership()
      ).to.emit(contract, "OwnershipTransferCancelled").withArgs(
        owner.address,
        newOwner.address
      )

    })

    it("Failed: No pending trnasfer", async () => {
      await expect(
        contract.cancelTransferOwnership()
      ).to.be.revertedWithCustomError(contract, "NoPendingTrnasferOwnership");
    })
  })

  describe("Accept ownership", ()=> {
    before(async () => {
      await transferStartedState.restore();
    })

    it("Failed: From not specified address", async () => {
      // From original owenr
      await expect(
        contract.acceptOwnership()
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");

      // From invalid account
      await expect(
        contract.connect(accounts[0]).acceptOwnership()
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    })

    it("Scuccess", async () => {
      expect(await contract.owner()).to.be.eq(owner.address);
      expect(await contract.pendingOwner()).to.be.eq(newOwner.address);

      await expect(
        contract.connect(newOwner).acceptOwnership()
      ).to.emit(contract, "OwnershipTransferred").withArgs(
        owner.address,
        newOwner.address
      );

      expect(await contract.owner()).to.be.eq(newOwner.address);
      expect(await contract.pendingOwner()).to.be.eq(ethers.ZeroAddress);
    })
  })
})
