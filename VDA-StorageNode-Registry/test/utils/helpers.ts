import { ethers } from "hardhat";
import { BigNumberish, BytesLike, HDNodeWallet, Wallet } from "ethers";
import EncryptionUtils from "@verida/encryption-utils";
import { IDataCentre, IStorageNode, IStorageNodeManagement, VDAStorageNodeFacet, VDAStorageNodeManagementFacet } from "../../typechain-types";
import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const CONTRACT_DECIMAL = 9;

/**
 * Create an object of `DataCentreStruct` from individual element
 * @param name
 * @param countryCode
 * @param regionCode 
 * @param lat 
 * @param long 
 * @returns Object of `DataCentreStruct` type
 */
export function createDatacentreStruct(
    name: string,
    countryCode: string,
    regionCode: string,
    lat: number,
    long: number) : IDataCentre.DatacentreInputStruct {
    return {
        name,
        countryCode,
        regionCode,
        lat: ethers.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.parseUnits(long.toString(), CONTRACT_DECIMAL),
    }
}

/**
 * Create and return object of `StorageNodeInputStruct` type
 * @param name 
 * @param address 
 * @param endpointUri 
 * @param countryCode 
 * @param regionCode 
 * @param datacentreId 
 * @param lat 
 * @param long 
 * @param slotCount 
 * @param acceptFallbackSlots 
 * @returns Object of `StorageNodeInputStruct` type
 */
export function createStorageNodeInputStruct(
    name: string,
    address: string,
    endpointUri: string,
    countryCode: string,
    regionCode: string,
    datacentreId: BigNumberish,
    lat: number,
    long: number,
    slotCount: BigNumberish,
    acceptFallbackSlots: boolean) : IStorageNodeManagement.StorageNodeInputStruct {
    
    return {
        name,
        didAddress: address,
        endpointUri,
        countryCode,
        regionCode,
        datacentreId,
        lat: ethers.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.parseUnits(long.toString(), CONTRACT_DECIMAL),
        slotCount: slotCount,
        acceptFallbackSlots
    }
}

/**
 * Type for general request signature and proof
 */
export interface RequestSignature {
    requestSignature: string,
    requestProof: string,
}

/** Request signatures type for `AddNode()` function */
export interface AddNodeRequestSignature extends RequestSignature {
    authSignature: string
}

/**
 * Create and return `requestSignature` and `requestProof`
 * @param signer
 * @param rawMsg 
 * @returns Object of `requestSignature` and `requestProof`
 */
function generateRequestSignatures(
    signer: Wallet | HDNodeWallet,
    rawMsg: string
) : RequestSignature {
    const privateKeyBuffer = new Uint8Array(Buffer.from(signer.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawMsg, privateKeyBuffer);

    const proofString = `${signer.address}${signer.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

    return {requestSignature, requestProof};
}

/**
 * Return signatures for `addNode()` function
 * @param node - Node to be added
 * @param nonce - Nonce of the `user` in the contract
 * @param user - DID wallet that add the node
 * @param signer - Trusted signer that is registered in the contract
 * @returns 
 */
export function getAddNodeSignatures(
    node: IStorageNodeManagement.StorageNodeInputStruct,
    nonce: BigNumberish,
    user : Wallet | HDNodeWallet,
    signer : Wallet | HDNodeWallet
) : AddNodeRequestSignature {
    const rawMsg = ethers.solidityPacked(
        ["string", "address", "string", "uint", "int", "int", "uint", "bool", "uint"],
        [node.name, node.didAddress, `${node.endpointUri}${node.countryCode}${node.regionCode}`, node.datacentreId, node.lat, node.long, node.slotCount, node.acceptFallbackSlots, nonce]
    );

    const {requestSignature, requestProof} = generateRequestSignatures(user, rawMsg);
    
    const authMsg = ethers.solidityPacked(
        ['address'],
        [user.address]
    )
    const signerKeyBuffer = new Uint8Array(Buffer.from(signer.privateKey.slice(2), 'hex'));
    const authSignature = EncryptionUtils.signData(authMsg, signerKeyBuffer);

    return {
        requestSignature,
        requestProof,
        authSignature
    };
}

/**
 * Return request signature and proof for `removeNodeStart()` function
 * @param user - DID wallet that removes the node
 * @param unregisterTime - The unix timestamp in secods of when the storage node should no logner be available for selection.
 * @param fallbackInfo - FallbackNode inforamtion
 * @param nonce - Nonce of the DID in the contract
 * @returns Request signature and proof
 */
export function getRemoveStartSignatures(
    user: Wallet | HDNodeWallet,
    unregisterTime : BigNumberish,
    fallbackInfo: IStorageNodeManagement.FallbackNodeInfoStruct,
    nonce: BigNumberish
) : RequestSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "uint", "address", "uint", "uint", "bytes", "uint"],
        [user.address, unregisterTime, fallbackInfo.fallbackNodeAddress, fallbackInfo.availableSlots, fallbackInfo.fallbackProofTime, fallbackInfo.availableSlotsProof, nonce]
    );

    return generateRequestSignatures(user, rawMsg);
}

/**
 * Return request signature and proof for `removeNodeComplete()` function
 * @param user - DID wallet that completes the removing node
 * @param fundReceiver - Wallet address that retrives the token deposited
 * @param migrationProof - A message signed by the `fallbackNode` specified in the 
      original `removeNodeStart()` request confirming the migration of any remaining data has been completed.
 * @param nonce - Nonce of the `user` in the contract
 * @returns Request signature and proof
 */
export function getRemoveCompleteSignatures(
    user: Wallet | HDNodeWallet,
    fundReceiver: string,
    migrationProof: string,
    nonce: BigNumberish
) : RequestSignature {

    const rawMsg = ethers.solidityPacked(
        ["address", "address", "bytes", "uint"],
        [user.address, fundReceiver, migrationProof, nonce]
    );

    return generateRequestSignatures(user, rawMsg);
}

/**
 * Return request signature and proof for `withdraw()` function
 * @param user - DID wallet that completes the removing node
 * @param recipient - Recipient wallet address
 * @param amount - Amount to be withdrawl
 * @param nonce - Nonce of the `user`
 * @returns Request signature and proof
 */
export function getWithdrawSignatures(
    user: Wallet | HDNodeWallet,
    recipient: string,
    amount: BigNumberish,
    nonce: BigNumberish
) : RequestSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "address", "uint", "uint"],
        [user.address, recipient, amount, nonce]
    );

    return generateRequestSignatures(user, rawMsg);
}

/**
 * Return request signature and proof for `logNodeIssue()` function
 * @param logger - DID wallet that logs the issue
 * @param nodeDID - Address of the node that has an issue
 * @param reasonCode - Reason code of the issue
 * @param nonce - Nonce of the `logger`
 * @returns Request signature and proof
 */
export function getLogNodeIssueSignatures(
    logger: Wallet | HDNodeWallet,
    nodeDID: string,
    reasonCode: BigNumberish,
    nonce: BigNumberish
) : RequestSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "address", "uint", "uint"],
        [logger.address, nodeDID, reasonCode, nonce]
    );

    return generateRequestSignatures(logger, rawMsg);
}

/**
 * Return request signature and proof for `lock()` function
 * @param user - DID wallet that lock
 * @param purpose - Lock purpose
 * @param amount - Lock amount
 * @param withDeposit - `true` if the transaction involves token depositing, otherwise `false`
 * @param nonce Nonce of the contract
 * @returns Request signature and proof
 */
export function getLockSignatures(
    user: Wallet | HDNodeWallet,
    purpose: string,
    amount: BigNumberish,
    withDeposit: boolean,
    nonce: BigNumberish
) : RequestSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "string", "uint", "bool", "uint"],
        [user.address, purpose, amount, withDeposit, nonce]
    );

    return generateRequestSignatures(user, rawMsg);
}

/**
 * Return request signature and proof for `unlock()` and `unlockAndWithdraw()` functions
 * @param user - DID wallet that unlock
 * @param purpose - Lock purpose
 * @param nonce - Nonce of the `user`
 * @param withdrawWallet - Optional. If specified, return for `unlockAndWithdraw()` function, 
 *      otherwise return for `unlock()` function
 * @returns Request signature and proof
 */
export function getUnlockSignatures(
    user: Wallet | HDNodeWallet,
    purpose: string,
    nonce: BigNumberish,
    withdrawWallet?: string
) : RequestSignature {
    let rawMsg : string;
    if (!withdrawWallet) {
        rawMsg = ethers.solidityPacked(
            ["address", "string", "uint"],
            [user.address, purpose, nonce]
        );
    } else {
        rawMsg = ethers.solidityPacked(
            ["address", "string", "address", "uint"],
            [user.address, purpose, withdrawWallet!, nonce]
        );
    }

    return generateRequestSignatures(user, rawMsg);

}

export const checkAddNode = async (
    contract: VDAStorageNodeManagementFacet,
    storageNode: IStorageNodeManagement.StorageNodeInputStruct,
    user: HDNodeWallet,
    trustedSigner: HDNodeWallet,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);
    const { requestSignature, requestProof, authSignature } = getAddNodeSignatures(storageNode, nonce, user, trustedSigner);

    if (expectResult === true) {
        const tx = await contract.addNode(storageNode, requestSignature, requestProof, authSignature);

        await expect(tx).to.emit(contract, "AddNode").withArgs(
            storageNode.name,
            storageNode.didAddress,
            storageNode.endpointUri,
            storageNode.countryCode,
            storageNode.regionCode,
            storageNode.datacentreId,
            storageNode.lat,
            storageNode.long,
            storageNode.slotCount,
            storageNode.acceptFallbackSlots,
            anyValue
        );
    } else {
        await expect(
            contract.addNode(storageNode, requestSignature, requestProof, authSignature)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}

/**
 * Get fallback node information
 * @param user Fallback node owner
 * @param node fallback node
 * @param signer Signer that signs the message. This parameter is for testing invalid signature tests.
 * @returns fallback node information for `removeNodeStart()` function
 */
export const getFallbackNodeInfo = (
    user:Wallet | HDNodeWallet, 
    slotCount: BigNumberish, 
    signer: Wallet|HDNodeWallet|undefined = undefined
    ) : IStorageNodeManagement.FallbackNodeInfoStruct => {
    const timeInSec = Math.floor(Date.now() / 1000);

    const rawmsg = ethers.solidityPacked(
        ["address", "string", "uint", "string", "uint"],
        [user.address, "/", slotCount, "/", timeInSec]
    );
    if (signer === undefined) {
        signer = user;
    }

    const privateKeyBuffer = new Uint8Array(Buffer.from(signer.privateKey.slice(2), 'hex'));
    const signature = EncryptionUtils.signData(rawmsg, privateKeyBuffer);

    return {
        fallbackNodeAddress: user.address,
        availableSlots: slotCount,
        fallbackProofTime: timeInSec,
        availableSlotsProof: signature
    };
}

/**
 * Get migration proof for `removeNodeComplete()` function
 * @param nodeAddress Addres of node that will be removed
 * @param fallbackNodeAddress The address of fallback node
 * @param signer Signer of the message
 */
export const getFallbackMigrationProof = (nodeAddress: string, fallbackNodeAddress:string, signer: Wallet|HDNodeWallet) => {
    const rawmsg = ethers.solidityPacked(
        ["address", "string", "address", "string"],
        [nodeAddress, "/", fallbackNodeAddress, "-migrated"]
    );
    const privateKeyBuffer = new Uint8Array(Buffer.from(signer.privateKey.slice(2), 'hex'));
    return EncryptionUtils.signData(rawmsg, privateKeyBuffer);
}

export const checkRemoveNodeStart = async (
    contract: VDAStorageNodeManagementFacet,
    user: HDNodeWallet | Wallet,
    unregisterTime: number,
    fallbackInfo: IStorageNodeManagement.FallbackNodeInfoStruct,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);

    const { requestSignature, requestProof } = getRemoveStartSignatures(user, unregisterTime, fallbackInfo, nonce);

    if (expectResult === true) {
        await expect(
            contract.removeNodeStart(user.address, unregisterTime, fallbackInfo, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeStart").withArgs(
            user.address, 
            unregisterTime,
            fallbackInfo.fallbackNodeAddress
        );
    } else {
        await expect(
            contract.removeNodeStart(user.address, unregisterTime, fallbackInfo, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }    
}

export const checkRemoveNodeComplete = async (
    contract: VDAStorageNodeManagementFacet,
    user: HDNodeWallet,
    fallbackUser: HDNodeWallet,
    fundReceiver: string,
    requestor: SignerWithAddress,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);

    const migrationProof = getFallbackMigrationProof(user.address, fallbackUser.address, fallbackUser);
    const {requestSignature, requestProof} = getRemoveCompleteSignatures(user, fundReceiver, migrationProof, nonce);

    if (expectResult === true) {
        await expect(
            contract.connect(requestor).removeNodeComplete(user.address, fundReceiver, migrationProof, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeComplete").withArgs(user.address, fallbackUser.address, fundReceiver);
    } else {
        await expect(
            contract.connect(requestor).removeNodeComplete(user.address, fundReceiver, migrationProof, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}