import { ethers } from "hardhat";
import { BigNumberish, BytesLike, HDNodeWallet, Wallet } from "ethers";
import EncryptionUtils from "@verida/encryption-utils";
import { IDataCenter, IStorageNode, IStorageNodeManagement, VDAStorageNodeFacet, VDAStorageNodeManagementFacet } from "../../typechain-types";
import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const CONTRACT_DECIMAL = 9;

export function createDatacenterStruct(
    name: string,
    countryCode: string,
    regionCode: string,
    lat: number,
    long: number) : IDataCenter.DatacenterInputStruct {
    return {
        name,
        countryCode,
        regionCode,
        lat: ethers.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.parseUnits(long.toString(), CONTRACT_DECIMAL),
    }
}

export function createStorageNodeInputStruct(
    name: string,
    address: string,
    endpointUri: string,
    countryCode: string,
    regionCode: string,
    datacenterId: BigNumberish,
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
        datacenterId,
        lat: ethers.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.parseUnits(long.toString(), CONTRACT_DECIMAL),
        slotCount: slotCount,
        acceptFallbackSlots
    }
}

export interface RequestSignature {
    requestSignature: string,
    requestProof: string,
    authSignature: string
}

export function getAddNodeSignatures(
    node: IStorageNodeManagement.StorageNodeInputStruct,
    nonce: BigNumberish,
    user : Wallet | HDNodeWallet,
    signer : Wallet | HDNodeWallet
) : RequestSignature {
    const rawmsg = ethers.solidityPacked(
        ["string", "address", "string", "uint", "int", "int", "uint", "bool", "uint"],
        [node.name, node.didAddress, `${node.endpointUri}${node.countryCode}${node.regionCode}`, node.datacenterId, node.lat, node.long, node.slotCount, node.acceptFallbackSlots, nonce]
    );

    const privateKeyBuffer = new Uint8Array(Buffer.from(user.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawmsg, privateKeyBuffer);

    const proofString = `${user.address}${user.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

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

export interface RemoveSignature {
    requestSignature: string,
    requestProof: string
}

export function getRemoveStartSignatures(
    user: Wallet | HDNodeWallet,
    unregisterTime : BigNumberish,
    fallbackInfo: IStorageNodeManagement.FallbackNodeInfoStruct,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "uint", "address", "uint", "uint", "bytes", "uint"],
        [user.address, unregisterTime, fallbackInfo.fallbackNodeAddress, fallbackInfo.availableSlots, fallbackInfo.fallbackProofTime, fallbackInfo.availableSlotsProof, nonce]
    );
    
    const privateKeyBuffer = new Uint8Array(Buffer.from(user.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawMsg, privateKeyBuffer);

    const proofString = `${user.address}${user.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

    return {
        requestSignature,
        requestProof
    }
}

export function getRemoveCompleteSignatures(
    user: Wallet | HDNodeWallet,
    fundReceiver: string,
    migrationProof: string,
    nonce: BigNumberish
) : RemoveSignature {

    const rawMsg = ethers.solidityPacked(
        ["address", "address", "bytes", "uint"],
        [user.address, fundReceiver, migrationProof, nonce]
    );

    const privateKeyBuffer = new Uint8Array(Buffer.from(user.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawMsg, privateKeyBuffer);

    const proofString = `${user.address}${user.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

    return {
        requestSignature,
        requestProof
    }
}

export function getWithdrawSignatures(
    user: Wallet | HDNodeWallet,
    recipient: string,
    amount: BigNumberish,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "address", "uint", "uint"],
        [user.address, recipient, amount, nonce]
    );

    const privateKeyBuffer = new Uint8Array(Buffer.from(user.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawMsg, privateKeyBuffer);

    const proofString = `${user.address}${user.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

    return {
        requestSignature,
        requestProof
    }
}

export function getLogNodeIssueSignatures(
    logger: Wallet | HDNodeWallet,
    nodeDID: string,
    reasonCode: BigNumberish,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "address", "uint", "uint"],
        [logger.address, nodeDID, reasonCode, nonce]
    );

    const privateKeyBuffer = new Uint8Array(Buffer.from(logger.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawMsg, privateKeyBuffer);

    const proofString = `${logger.address}${logger.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

    return {
        requestSignature,
        requestProof
    }
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
            storageNode.datacenterId,
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