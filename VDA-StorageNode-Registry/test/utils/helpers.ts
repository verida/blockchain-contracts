import { ethers } from "hardhat";
import { BigNumberish, HDNodeWallet, Wallet } from "ethers";
import EncryptionUtils from "@verida/encryption-utils";
import { IDataCenter, IStorageNode, VDAStorageNodeFacet } from "../../typechain-types";
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
    address: string,
    endpointUri: string,
    countryCode: string,
    regionCode: string,
    datacenterId: BigNumberish,
    lat: number,
    long: number,
    slotCount: number) : IStorageNode.StorageNodeInputStruct {
    
    return {
        didAddress: address,
        endpointUri,
        countryCode,
        regionCode,
        datacenterId,
        lat: ethers.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.parseUnits(long.toString(), CONTRACT_DECIMAL),
        slotCount: slotCount
    }
}

export interface RequestSignature {
    requestSignature: string,
    requestProof: string,
    authSignature: string
}

export function getAddNodeSignatures(
    node: IStorageNode.StorageNodeInputStruct,
    nonce: BigNumberish,
    user : Wallet | HDNodeWallet,
    signer : Wallet | HDNodeWallet
) : RequestSignature {
    const rawmsg = ethers.solidityPacked(
        ["address", "string", "uint", "int", "int", "uint", "uint"],
        [node.didAddress, `${node.endpointUri}${node.countryCode}${node.regionCode}`, node.datacenterId, node.lat, node.long, node.slotCount, nonce]
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
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "uint", "uint"],
        [user.address, unregisterTime, nonce]
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
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "uint"],
        [user.address, nonce]
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
    amount: BigNumberish,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.solidityPacked(
        ["address", "uint", "uint"],
        [user.address, amount, nonce]
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
    contract: VDAStorageNodeFacet,
    storageNode: IStorageNode.StorageNodeInputStruct,
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
            storageNode.didAddress,
            storageNode.endpointUri,
            storageNode.countryCode,
            storageNode.regionCode,
            storageNode.datacenterId,
            storageNode.lat,
            storageNode.long,
            storageNode.slotCount,
            anyValue
        );
    } else {
        await expect(
            contract.addNode(storageNode, requestSignature, requestProof, authSignature)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}

export const checkRemoveNodeStart = async (
    contract: VDAStorageNodeFacet,
    user: HDNodeWallet,
    unregisterTime: number,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);

    const { requestSignature, requestProof } = getRemoveStartSignatures(user, unregisterTime, nonce);

    if (expectResult === true) {
        await expect(
            contract.removeNodeStart(user.address, unregisterTime, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeStart").withArgs(user.address, unregisterTime);
    } else {
        await expect(
            contract.removeNodeStart(user.address, unregisterTime, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }    
}

export const checkRemoveNodeComplete = async (
    contract: VDAStorageNodeFacet,
    user: HDNodeWallet,
    requestor: SignerWithAddress,
    expectResult: boolean = true,
    revertError: string | null = null
) => {
    const nonce = await contract.nonce(user.address);
    const {requestSignature, requestProof} = getRemoveCompleteSignatures(user, nonce);

    if (expectResult === true) {
        await expect(
            contract.connect(requestor).removeNodeComplete(user.address, requestSignature, requestProof)
        ).to.emit(contract, "RemoveNodeComplete").withArgs(user.address);
    } else {
        await expect(
            contract.connect(requestor).removeNodeComplete(user.address, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, revertError!);
    }
}