/* global describe it before ethers */

import { deploy } from "../scripts/libraries/deployment";
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { checkAddNode, createStorageNodeInputStruct, getLogNodeIssueSignatures } from './utils/helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, HDNodeWallet, Wallet } from 'ethers'
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { IStorageNode, MockToken, VDADataCenterFacet, VDAStorageNodeFacet, VDAStorageNodeManagementFacet, VDAVerificationFacet } from "../typechain-types";
import { DATA_CENTERS, VALID_NUMBER_SLOTS } from "./utils/constant";
import { hours } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

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

describe('SorageNode Log Related Test', async function () {
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
  let maxDataCenterID : bigint;

  let snapShotWithNodeAdded : SnapshotRestorer;

  const node = user;
  let requestor : SignerWithAddress;

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
  
  const checkLogNodeIssue = async (
    requestor: SignerWithAddress,
    logger: Wallet | HDNodeWallet,
    nodeDID: string,
    reasonCode: BigNumberish,
    needMintToRequestor: boolean = false,
    expectResult: boolean = true,
    revertError: string | null = null
  ) => {
    // Mint token to requestor
    if (needMintToRequestor === true)  {
      const nodeIssueFee = await nodeContract.getNodeIssueFee();
      // Mint tokens to the requestor
      await tokenContract.mint(requestor.address, nodeIssueFee);
      // Make requestor approve tokens to the contract
      await tokenContract.connect(requestor).approve(diamondAddress, nodeIssueFee);
    }

    const nonce = await nodeManageContract.nonce(logger.address);
    const { requestSignature, requestProof } = getLogNodeIssueSignatures(logger, nodeDID, reasonCode, nonce);

    if (expectResult === true) {
      const tx = await nodeContract.connect(requestor).logNodeIssue(logger.address, nodeDID, reasonCode, requestSignature, requestProof);

      await expect(tx).to.emit(nodeContract, "LoggedNodeIssue").withArgs(
          logger.address,
          nodeDID,
          reasonCode
      );
    } else {
      await expect(
        nodeContract.connect(requestor).logNodeIssue(logger.address, nodeDID, reasonCode, requestSignature, requestProof)
      ).to.be.revertedWithCustomError(nodeContract, revertError!);
    }
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
      tokenAddress,
    } = await deploy(undefined, [
      'VDAVerificationFacet', 'VDADataCenterFacet', 'VDAStorageNodeFacet', 'VDAStorageNodeManagementFacet'
    ]));

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
    maxDataCenterID = datacenterIds[datacenterIds.length -1];

    // Add nodes
    await verificationContract.addTrustedSigner(trustedSigner.address);
    await nodeContract.setStakingRequired(true);
    await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
    await checkAddNode(nodeManageContract, storageNode, user, trustedSigner, true);
    snapShotWithNodeAdded = await takeSnapshot();

    requestor = accounts[1];
  })

  describe("Update node issue fee", () => {
    it("Failed : non-owner",async () => {
      await expect(
          nodeContract.connect(accounts[0]).updateNodeIssueFee(1)
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner")
    })

    it("Failed : 0 is not allowed",async () => {
      await expect(
        nodeContract.updateNodeIssueFee(0)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Failed : Update to current value",async () => {
      const currentNodeIssueFee = await nodeContract.getNodeIssueFee();

      await expect(
        nodeContract.updateNodeIssueFee(currentNodeIssueFee)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Success",async () => {
      const fee = 6n; // 5 VDA token
      const tokenDecimal = await tokenContract.decimals();

      const feeValue = (10n ^ tokenDecimal) * fee;

      const curFee = await nodeContract.getNodeIssueFee();

      expect(feeValue).not.to.eq(curFee);

      await expect(
        nodeContract.updateNodeIssueFee(feeValue)
      ).to.emit(nodeContract, "UpdateNodeIssueFee").withArgs(
        curFee, 
        feeValue
      );
    })
  })

  describe("Update log duration for same node", () => {
    it("Failed : non-owner",async () => {
      await expect(
        nodeContract.connect(accounts[0]).updateSameNodeLogDuration(hours(1))
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner")
    })

    it("Failed : 0 is not allowed",async () => {
      await expect(
        nodeContract.updateSameNodeLogDuration(0)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Failed : Update to current value",async () => {
      const currentSameNodeLogDuration = await nodeContract.getSameNodeLogDuration();

      await expect(
        nodeContract.updateSameNodeLogDuration(currentSameNodeLogDuration)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Success",async () => {
      const curDuration = await nodeContract.getSameNodeLogDuration();
      const duration = hours(2);
      await expect(
        nodeContract.updateSameNodeLogDuration(duration)
      ).to.emit(nodeContract, "UpdateSameNodeLogDuration").withArgs(
        curDuration,
        duration
      );
    })
  })

  describe("Update log limit per day", () => {
    it("Failed : non-owner",async () => {
      await expect(
        nodeContract.connect(accounts[0]).updateLogLimitPerDay(hours(1))
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner")
    })

    it("Failed : 0 is not allowed",async () => {
      await expect(
        nodeContract.updateLogLimitPerDay(0)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Failed : Update to current value",async () => {
      const currentLogLimitPerday = await nodeContract.getLogLimitPerDay();

      await expect(
        nodeContract.updateLogLimitPerDay(currentLogLimitPerday)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidValue");
    })

    it("Success",async () => {
      const curLogLimitPerDay = await nodeContract.getLogLimitPerDay();
      await expect(
        nodeContract.updateLogLimitPerDay(curLogLimitPerDay+1n)
      ).to.emit(nodeContract, "UpdateLogLimitPerDay").withArgs(
          curLogLimitPerDay,
          curLogLimitPerDay+1n
      );
    })
  })

  describe("Issue ReasonCode", () => {
    before(async () => {
      await snapShotWithNodeAdded.restore();
    })

    describe("Add reason code", () => {
      it("Failed : non-owner",async () => {
        await expect(
          nodeContract.connect(accounts[0]).addReasonCode(11, "Any description")
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
      })

      it("Failed : existing code",async () => {
        const codeList = await nodeContract.getReasonCodeList();
        expect(codeList.length).to.be.gt(0);

        await expect(
          nodeContract.addReasonCode(10, "Any description")
        ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");
      })

      it("Success",async () => {
        const code = 111;
        const description = "New code";
        await expect(
          nodeContract.addReasonCode(code, description)
        ).to.be.emit(nodeContract, "AddReasonCode").withArgs(
          code,
          description
        );
      })
    })

    describe("Get reason code list", () => {
      it("Success",async () => {
        const codeList = await nodeContract.getReasonCodeList();
        expect(codeList.length).to.be.gt(0);
      })
    })

    describe("Get reason code description", () => {
      let codeList: IStorageNode.LogReasonCodeOutputStructOutput[]
      before(async () => {
        codeList = await nodeContract.getReasonCodeList();
        expect(codeList.length).to.be.gt(0);
      })

      it("Failed : Invalid reason code",async () => {
        const unregistedCode = 1919n;
        expect(codeList.findIndex(item => item.reasonCode === unregistedCode)).to.be.eq(-1);

        await expect(
          nodeContract.getReasonCodeDescription(unregistedCode)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");
      })

      it("Success",async () => {
        expect(
          await nodeContract.getReasonCodeDescription(codeList[0].reasonCode)
        ).to.be.eq(codeList[0].description);
      })

      it("Success - disabled code",async () => {
        const currentSnapshot = await takeSnapshot();

        // Disaable a reason code
        await expect(
          nodeContract.disableReasonCode(codeList[0].reasonCode)
        ).to.be.emit(nodeContract, "DisableReasonCode");

        expect(
          await nodeContract.getReasonCodeDescription(codeList[0].reasonCode)
        ).to.be.eq(codeList[0].description);

        await currentSnapshot.restore();
      })

    })

    describe("Update reason code description", () => {
      let codeList: IStorageNode.LogReasonCodeOutputStructOutput[]
      before(async () => {
        codeList = await nodeContract.getReasonCodeList();
        expect(codeList.length).to.be.gt(0);
      })

      it("Failed : non-owner",async () => {
        await expect(
          nodeContract.connect(accounts[0]).updateReasonCodeDescription(codeList[0].reasonCode, "New description")
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
      })

      it("Failed : Invalid reason code - not exist",async () => {
        const unregistedCode = 1919n;
        expect(codeList.findIndex(item => item.reasonCode === unregistedCode)).to.be.eq(-1);

        await expect(
          nodeContract.updateReasonCodeDescription(unregistedCode, "Any description")
        ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");
      })

      it("Failed : Invalid reason code - disabled",async () => {
        const currentSnapshot = await takeSnapshot();

        // Disaable a reason code
        await expect(
          nodeContract.disableReasonCode(codeList[0].reasonCode)
        ).to.be.emit(nodeContract, "DisableReasonCode");

        await expect(
          nodeContract.updateReasonCodeDescription(codeList[0].reasonCode, "New Description")
        ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");

        await currentSnapshot.restore();
      })

      it("Success",async () => {
        const orgDesc = codeList[0].description;
        const newDesc = "New description"
        await expect(
          nodeContract.updateReasonCodeDescription(codeList[0].reasonCode, newDesc)
        ).to.be.emit(nodeContract, "UpdateReasonCodeDescription").withArgs(
          codeList[0].reasonCode,
          orgDesc,
          newDesc
        );

        expect(await nodeContract.getReasonCodeDescription(codeList[0].reasonCode)).to.be.eq(newDesc);
      })
    })

    describe("Disable reason code", () => {
      let codeList: IStorageNode.LogReasonCodeOutputStructOutput[]
      before(async () => {
        codeList = await nodeContract.getReasonCodeList();
        expect(codeList.length).to.be.gt(0);
      })

      it ("Failed : non-owner",async () => {
        const anyCode = 10n;
        await expect(
          nodeContract.connect(accounts[0]).disableReasonCode(anyCode)
        ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
      })

      it("Failed : Invalid reason code - not exist",async () => {
        const unregisteredCode = 11n;

        expect(codeList.findIndex(item => item.reasonCode === unregisteredCode)).to.be.eq(-1);

        await expect(
          nodeContract.disableReasonCode(unregisteredCode)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");
      })

      it("Success",async () => {
        await expect(
          nodeContract.disableReasonCode(codeList[0].reasonCode)
        ).to.be.emit(nodeContract, "DisableReasonCode").withArgs(
          codeList[0].reasonCode
        );
      })

      it("Failed : Invalid reason code - disabled",async () => {
        await expect(
          nodeContract.disableReasonCode(codeList[0].reasonCode)
        ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");
      })
    })
  })

  describe("Log node issue", () => {
    const logger = Wallet.createRandom();

    before(async () => {
      await snapShotWithNodeAdded.restore();
    })

    describe("Log an issue", () => {
      it("Failed : Invalid node DID",async () => {
        const randomNodeDID = Wallet.createRandom().address;
        await checkLogNodeIssue(requestor, logger, randomNodeDID, 10, false, false, "InvalidDIDAddress");
      })

      it("Failed : DID equals to node address",async () => {
        await checkLogNodeIssue(requestor, logger, logger.address, 10, false, false, "InvalidDIDAddress");
      })

      it("Failed : Token not approved or insufficient",async () => {
        const nonce = await nodeManageContract.nonce(logger.address);
        const { requestSignature, requestProof } = getLogNodeIssueSignatures(logger, node.address, 10, nonce);
        await expect(
          nodeContract.connect(requestor).logNodeIssue(logger.address, node.address, 10, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
      })

      it("Success",async () => {
        await checkLogNodeIssue(requestor, logger, node.address, 10, true);
      })
    })

    describe("Log limit test for same node", () => {
      it("1 hour log limit for same node DID",async () => {
        let curBlockTime = await time.latest();

        // Failed in an hour
        await checkLogNodeIssue(requestor, logger, node.address, 10, true, false, "InvalidSameNodeTime");

        // Success after 1 hour
        curBlockTime = curBlockTime + hours(1);
        time.increaseTo(curBlockTime);
        await checkLogNodeIssue(requestor, logger, node.address, 10, true);
      })
    })

    describe("Log limit test per day", () => {
      let curLogLimitPerday: bigint;
      const nodes: HDNodeWallet[] = [];
      let logLimitedPerDayState : SnapshotRestorer;

      before(async () => {
        await snapShotWithNodeAdded.restore();

        curLogLimitPerday = await nodeContract.getLogLimitPerDay();

        for (let i = 0; i <= curLogLimitPerday; i++) {
          nodes.push(Wallet.createRandom());
        }

        // Add different nodes for test
        for (let i = 0; i < nodes.length; i++) {
          const storageNode = createStorageNodeInputStruct(
            `name-${i+1}`,
            nodes[i].address, 
            "https://1" + i,
            "us",
            "north america",
            1,
            -90,
            -180,
            VALID_NUMBER_SLOTS,
            true
          );
          // Approve Token
          await approveToken(BigInt(storageNode.slotCount), owner, diamondAddress, true);
          // Add node
          await checkAddNode(nodeManageContract, storageNode, nodes[i], trustedSigner, true);
        }

        // Add logs till current limit per day
        for (let i = 0; i < curLogLimitPerday; i++) {
          const reasonCode = 20;
          await checkLogNodeIssue(requestor, logger, nodes[i].address, reasonCode, true);
        }

        logLimitedPerDayState = await takeSnapshot();
      })

      it("Test for current log limit per day",async () => {                       
        const curBlockTime = await time.latest();

        // Failed for log limit per day
        await checkLogNodeIssue(requestor, logger, nodes[Number(curLogLimitPerday)].address, 20, true, false, "TimeNotElapsed");

        // Success after 24 hours condition
        await time.increaseTo(curBlockTime + hours(24));
        await checkLogNodeIssue(requestor, logger, nodes[Number(curLogLimitPerday)].address, 20, true);
      })

      it("Test for updating log limit per day",async () => {
        // Restore limited state
        await logLimitedPerDayState.restore();

        // Failed for log limit per day
        await checkLogNodeIssue(requestor, logger, nodes[Number(curLogLimitPerday)].address, 20, true, false, "TimeNotElapsed");

        // Increase log limit per day
        await nodeContract.updateLogLimitPerDay(Number(curLogLimitPerday)+1);

        // Success after limit increased
        await checkLogNodeIssue(requestor, logger, nodes[Number(curLogLimitPerday)].address, 20, true);
      })
    })
  })

  describe("Slash", () => {
    const REASON_CODE = 10;
    const INVALID_REASON_CODE = 11;

    const moreInfoURL = "https://slash"
    
    let requestors : SignerWithAddress[] = [];
    const loggers = [Wallet.createRandom(), Wallet.createRandom()];

    before(async () => {
      await snapShotWithNodeAdded.restore();

      // Add requestors. Requestors can be the same
      for (let i = 0; i < loggers.length; i++) {
        requestors.push(accounts[i]);
      }
    })

    it("Failed : non-owner",async () => {
      await expect(
        nodeContract.connect(accounts[0]).slash(node.address, REASON_CODE, 10, moreInfoURL)
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
    })

    it("Failed : Amount can not be 0",async () => {
      await expect(
        nodeContract.slash(node.address, REASON_CODE, 0, moreInfoURL)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidAmount");
    })

    it("Failed : Amount can not be bigger than the node's staked amount", async () => {
      const currentAmount = await nodeContract.getBalance(node.address);
      await expect(
        nodeContract.slash(node.address, REASON_CODE, currentAmount+1n, moreInfoURL)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidAmount");
    })

    it("Failed : Invalid reason code",async () => {
      const currentAmount = await nodeContract.getBalance(node.address);
      await expect(
        nodeContract.slash(node.address, INVALID_REASON_CODE, currentAmount, moreInfoURL)
      ).to.be.revertedWithCustomError(nodeContract, "InvalidReasonCode");
    })

    it("Success : same portion for 2 loggers",async () => {
      const currentSnapshot = await takeSnapshot();

      // Log issues for same node & reason code with same node fee
      for (let i = 0; i < loggers.length; i++) {
        await checkLogNodeIssue(requestors[i], loggers[i], node.address, REASON_CODE, true);
      }

      const loggerOrgBalances : bigint[] = [];
      for (let i = 0; i < loggers.length; i++) {
          loggerOrgBalances.push(await nodeContract.getBalance(loggers[i].address));
      }

      // Slash 200 token
      const slashAmount = (10n ^ (await tokenContract.decimals())) * 200n;
      await expect(
        nodeContract.slash(node.address, REASON_CODE, slashAmount, moreInfoURL)
      ).to.emit(nodeContract, "Slash").withArgs(
        node.address,
        REASON_CODE,
        anyValue,
        anyValue,
        moreInfoURL
      );

      // Check the loggers's balance updated
      for (let i = 0; i < loggers.length; i++) {
        const curBalance = await nodeContract.getBalance(loggers[i].address);
        expect(curBalance).to.be.eq(loggerOrgBalances[i] + (slashAmount / 2n));
      }                   

      await currentSnapshot.restore();
    })

    it("Success : different portion by `NodeIssueFee` updated",async () => {
      const currentSnapshot = await takeSnapshot();

      const orgNodeIssueFee = await nodeContract.getNodeIssueFee();

      // Log issue with original fee
      await checkLogNodeIssue(requestors[0], loggers[0], node.address, REASON_CODE, true);

      // Update issue fee 3 times of original value.
      const updatedNodeIssueFee = orgNodeIssueFee * 3n;
      await nodeContract.updateNodeIssueFee(updatedNodeIssueFee);

      // Log issue with updated fee
      await checkLogNodeIssue(requestors[1], loggers[1], node.address, REASON_CODE, true);

      // Save original balances of loggers
      const loggerOrgBalances : bigint[] = [];
      for (let i = 0; i < loggers.length; i++) {
          loggerOrgBalances.push(await nodeContract.getBalance(loggers[i].address));
      }

      // Slash 200 token
      const slashAmount = (10n^ (await tokenContract.decimals())) * 200n;
      await expect(
        nodeContract.slash(node.address, REASON_CODE, slashAmount, moreInfoURL)
      ).to.emit(nodeContract, "Slash").withArgs(
        node.address,
        REASON_CODE,
        anyValue,
        anyValue,
        moreInfoURL
      );

      // Check the loggers's balance updated
      const loggerUpdatedBalances : bigint[] = [];
      for (let i = 0; i < loggers.length; i++) {
        loggerUpdatedBalances.push(await nodeContract.getBalance(loggers[i].address));
      }

      // Confirm that 2nd logger get 3 times of slashed tokens than first logger
      expect(loggerUpdatedBalances[1] - loggerOrgBalances[1]).to.be.eq(
          (loggerUpdatedBalances[0]- loggerOrgBalances[0]) * 3n
      );

      await currentSnapshot.restore();
    })

    it("Success : Different portion by multiple logs from one account",async () => {
      // Log issues for same node & reason code with same node fee
      for (let i = 0; i < loggers.length; i++) {
       await checkLogNodeIssue(requestors[i], loggers[i], node.address, REASON_CODE, true);
      }

      // Log 2 more times for second logger
      for (let i = 0; i < 2; i++) {
        const curTime = await time.latest();
        await time.increaseTo(curTime + hours(1));
        await checkLogNodeIssue(owner, loggers[1], node.address, REASON_CODE, true);
      }

      const loggerOrgBalances : bigint[] = [];
      for (let i = 0; i < loggers.length; i++) {
        loggerOrgBalances.push(await nodeContract.getBalance(loggers[i].address));
      }

      // Slash 200 token
      const slashAmount = (10n ^ (await tokenContract.decimals())) * 200n;
      await expect(
        nodeContract.slash(node.address, REASON_CODE, slashAmount, moreInfoURL)
      ).to.emit(nodeContract, "Slash").withArgs(
        node.address,
        REASON_CODE,
        anyValue,
        anyValue,
        moreInfoURL
      );

      // Get updated balances
      const loggerUpdatedBalances : bigint[] = [];
      for (let i = 0; i < loggers.length; i++) {
        loggerUpdatedBalances.push(await nodeContract.getBalance(loggers[i].address));
      }

      // Confirm that 2nd logger get 3 times of slashed tokens than first logger
      expect(loggerUpdatedBalances[1] - loggerOrgBalances[1]).to.be.eq(
        (loggerUpdatedBalances[0]- loggerOrgBalances[0]) * 3n
      );
    })
  })

  describe("Withdraw issue fee", () => {
    const receiver = Wallet.createRandom();
    const logger = Wallet.createRandom();

    before(async () => {
      await snapShotWithNodeAdded.restore();
    })

    it("Failed : non-owner",async () => {
      await expect(
          nodeContract.connect(accounts[0]).withdrawIssueFee(receiver.address, 100)
      ).to.be.revertedWithCustomError(nodeContract, "NotContractOwner");
    })

    it("Success",async () => {
      // No fees before logging an issue
      expect(await nodeContract.getTotalIssueFee()).to.be.eq(0);

      // Log a issue
      const curIssueFee = await nodeContract.getNodeIssueFee();
      await checkLogNodeIssue(requestor, logger, node.address, 10, true);

      expect(await nodeContract.getTotalIssueFee()).to.be.eq(curIssueFee);

      // Withdraw to the receiver
      expect(await tokenContract.balanceOf(receiver.address)).to.be.eq(0);

      await expect(
        nodeContract.withdrawIssueFee(receiver.address, curIssueFee)
      ).to.emit(nodeContract, "WithdrawIssueFee").withArgs(
          receiver.address,
          curIssueFee
      );

      // Confirm receiver received tokens
      expect(await tokenContract.balanceOf(receiver.address)).to.be.eq(curIssueFee);
    })
  })
})
