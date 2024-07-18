import EncryptionUtils from "@verida/encryption-utils"
import { getVeridaSign } from "@verida/vda-common"
import { Wallet } from "ethers"
import { ethers } from "hardhat"
import { NameRegistry, NameRegistryV2 } from "../typechain-types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"

export const ZeroAddress: string = "0x0000000000000000000000000000000000000000";

export interface IAppMetaData {
    key: string
    value: string
}

export const appDataNoDomain: IAppMetaData[] = [
    {
        key: "name",
        value: "message"
    }   
];

export const appDataWithDomain: IAppMetaData[] = [
    ...appDataNoDomain,
    {
        key: "domain",
        value: "verida_io"
    }
];

export const appDataWithUsers: IAppMetaData[] = [
    ...appDataWithDomain,
    {
        key: "users",
        value: "1000"
    }
];

/**
 * Return the {requestSignature, requestProof} for `register()` function
 * @param contract `NameRegistry` contract instance
 * @param name Name to be registered
 * @param did Wallet 
 * @returns Object {requestSignature, requestProof}
 */
export const getRegisterSignature = async (contract:NameRegistry, name: string, did: Wallet) => {
    const nonce = await contract.nonce(did.address);
    const rawMsg = ethers.utils.solidityPack(
      ["string", "address", "uint"],
      [name, did.address, nonce]
    );
    return getVeridaSign(rawMsg, did.privateKey);
  };
  

/**
 * Return the `requestSignature` and `requestProof` for the `registerApp()` function
 * @param did Wallet 
 * @param ownerName String
 * @param appName String
 * @param metaData Array of app metadata
 * @param nonce Nonce of the `did` in the `NameRegistry` contract
 * @param signer Signer of the message, If not set, sign with `did`
 */
export const getRegisterAppSignature = async (
    contract: NameRegistryV2,
    did: Wallet,
    ownerName: string,
    appName: string,
    metaData: IAppMetaData[],
    signer?: Wallet
) => {
    const privateKey = signer?.privateKey ?? did.privateKey;

    const nonce = await contract.nonce(did.address);

    let rawMsg = ethers.utils.solidityPack(
        ['address', 'string', 'string'],
        [did.address, ownerName, appName]
    );

    for (let i = 0; i < metaData.length; i++) {
        rawMsg = ethers.utils.solidityPack(
            ['bytes', 'string', 'string'],
            [rawMsg, metaData[i].key, metaData[i].value]
        );
    }

    rawMsg = ethers.utils.solidityPack(
        ['bytes', 'uint'],
        [rawMsg, nonce]
    );

    const requestSignature = getVeridaSign(rawMsg, privateKey);

    const proofMsg = `${did.address}${did.address}`.toLowerCase();
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'));
    const requestProof = EncryptionUtils.signData(proofMsg, privateKeyArray);

    return {requestSignature, requestProof};
}

/**
     * Check `registerApp()` function
     * @dev To succeed the registering app, the `txSender` should approve tokens before calling the `registerApp()` function
     * @param contract `NameRegistryV2` contract to be checked
     * @param txSender Transaction sender that pays gas fee
     * @param did DID
     * @param ownerName String
     * @param appName String
     * @param metaData Array of app meta data
     * @param expectedResult true if test aims success
     * @param failedWithCustomError Optional. Only specified in the failure case
     */
export const checkRegisterApp = async (
    contract: NameRegistryV2,
    txSender: SignerWithAddress,
    did: Wallet,
    ownerName: string,
    appName: string,
    metaData: IAppMetaData[],
    expectedResult: boolean = true,
    failedWithCustomError?: string
) => {
    const { requestSignature, requestProof}  = await getRegisterAppSignature(contract, did, ownerName, appName, metaData);

    if (expectedResult) {
        await expect(
            contract.connect(txSender).registerApp(did.address, ownerName, appName, metaData, requestSignature, requestProof)
        ).to.emit(contract, "RegisterApp").withArgs(
            did.address, ownerName, appName, anyValue
        );
    } else {
        await expect(
            contract.connect(txSender).registerApp(did.address, ownerName, appName, metaData, requestSignature, requestProof)
        ).to.be.revertedWithCustomError(contract, failedWithCustomError!)
    }
}