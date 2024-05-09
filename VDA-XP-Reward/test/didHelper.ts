import { VeridaDIDRegistry } from "@verida/did-registry-contract/typechain-types"
import EncryptionUtils from "@verida/encryption-utils"
import { ethers } from "hardhat"

export const endPoints = [
    'https://A_1',
    'https://A_2',
    'https://A_3'
]

const createVeridaSign = async (didReg:VeridaDIDRegistry, rawMsg : any, privateKey: string, docDID: string) => {
    if (didReg === undefined)
        return ''

    const nonce = (await didReg.nonce(docDID)).toNumber()
    rawMsg = ethers.utils.solidityPack(
        ['bytes','uint256'],
        [rawMsg, nonce]
    )
    const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
    return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

export const getRegisterSignature = async(didReg:VeridaDIDRegistry, did : string, endpoints: string[], signKey: string) => {
    let rawMsg = ethers.utils.solidityPack(
      ['address', 'string'],
      [did, '/']
    );
  
    for (let i = 0; i < endpoints.length; i++) {
      rawMsg = ethers.utils.solidityPack(
        ['bytes', 'string', 'string'],
        [rawMsg, endpoints[i], '/']
      );
    }
    return await createVeridaSign(didReg, rawMsg, signKey, did);
}

