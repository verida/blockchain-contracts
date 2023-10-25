import { ethers } from "hardhat";
import { IStorageNodeRegistry } from "../typechain-types";
import { BigNumberish, Wallet } from "ethers";
import { Keyring } from "@verida/keyring";
import EncryptionUtils from "@verida/encryption-utils";

const CONTRACT_DECIMAL = 8;

export function createDatacenterStruct(
    name: string,
    countryCode: string,
    regionCode: string,
    lat: number,
    long: number) : IStorageNodeRegistry.DatacenterStruct {
    return {
        name,
        countryCode,
        regionCode,
        lat: ethers.utils.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.utils.parseUnits(long.toString(), CONTRACT_DECIMAL),
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
    numberSlots: number) : IStorageNodeRegistry.StorageNodeInputStruct {
    
    return {
        didAddress: address,
        endpointUri,
        countryCode,
        regionCode,
        datacenterId,
        lat: ethers.utils.parseUnits(lat.toString(), CONTRACT_DECIMAL),
        long: ethers.utils.parseUnits(long.toString(), CONTRACT_DECIMAL),
        numberSlots: numberSlots
    }
}

export interface RequestSignature {
    requestSignature: string,
    requestProof: string,
    authSignature: string
}

export function getAddNodeSignatures(
    node: IStorageNodeRegistry.StorageNodeInputStruct,
    nonce: BigNumberish,
    user : Wallet,
    signer : Wallet
) : RequestSignature {
    const rawmsg = ethers.utils.solidityPack(
        ["address", "string", "uint", "int", "int", "uint", "uint"],
        [node.didAddress, `${node.endpointUri}${node.countryCode}${node.regionCode}`, node.datacenterId, node.lat, node.long, node.numberSlots, nonce]
    );

    const privateKeyBuffer = new Uint8Array(Buffer.from(user.privateKey.slice(2), 'hex'));
    const requestSignature = EncryptionUtils.signData(rawmsg, privateKeyBuffer);

    const proofString = `${user.address}${user.address}`.toLowerCase();
    const requestProof = EncryptionUtils.signData(proofString, privateKeyBuffer);

    const authMsg = ethers.utils.solidityPack(
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
    user: Wallet,
    unregisterTime : BigNumberish,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.utils.solidityPack(
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
    user: Wallet,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.utils.solidityPack(
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
    user: Wallet,
    amount: BigNumberish,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.utils.solidityPack(
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
    logger: Wallet,
    nodeDID: string,
    reasonCode: BigNumberish,
    nonce: BigNumberish
) : RemoveSignature {
    const rawMsg = ethers.utils.solidityPack(
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