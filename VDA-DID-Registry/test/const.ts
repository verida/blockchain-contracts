// Common test data to test DIDRegistry
// Shared between library tests
import EncryptionUtils from '@verida/encryption-utils'
import { formatBytes32String } from 'ethers/lib/utils.js'
import * as base64 from '@ethersproject/base64'
import { Base58 } from '@ethersproject/basex'
import { ethers, Wallet } from 'ethers'

import { hexlify, isBytes } from '@ethersproject/bytes'
import { toUtf8Bytes } from '@ethersproject/strings'


const testAccounts = [
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
  Wallet.createRandom(),
]

export const badSigner = Wallet.createRandom()
export const zeroAddress = '0x0000000000000000000000000000000000000000'

export const getVeridaSign = (rawMsg : any, privateKey: string ) => {
  const privateKeyArray = new Uint8Array(Buffer.from(privateKey.slice(2), 'hex'))
  return EncryptionUtils.signData(rawMsg, privateKeyArray)
}

export type fnGetNonceType = () => Promise<number>
export const getVeridaSignWithNonce = (rawMsg : any, privateKey: string, nonce: number) => {
  rawMsg = ethers.utils.solidityPack(
    ['bytes', 'uint256'],
    [rawMsg, nonce]
  )
  return getVeridaSign(rawMsg, privateKey)
}

// Delegate Test Data
export const delegates = [
  {
    delegateType: formatBytes32String('veriKey'),
    delegate: testAccounts[0].address,
    validity: 86400
  },

  {
    delegateType: formatBytes32String('veriKey'),
    delegate: testAccounts[1].address,
    validity: 86400
  },

]

// Attribute Test Data
const keyAlgorithm = [
  'Secp256k1',
  'Rsa',
  'Ed25519'
]

const keyPurpose = [
  'sigAuth',
  'veriKey',
  'veriKey'
]

const encoding = [
  'hex',
  'base64',
  'base58'
]

const pubKeyList = [
  testAccounts[0].publicKey,
  base64.encode(testAccounts[0].publicKey),
  Base58.encode(testAccounts[0].publicKey)
]

const contextList = [
  testAccounts[1].publicKey,
  testAccounts[2].publicKey,
  testAccounts[3].publicKey
]

export const attributes = [
  {
    key: `did/pub/${keyAlgorithm[0]}/${keyPurpose[0]}/${encoding[0]}`,
    value: `${pubKeyList[0]}?context=${contextList[0]}`,
    validity: 86400
  }, 
  {
    key: `did/pub/${keyAlgorithm[1]}/${keyPurpose[1]}/${encoding[1]}`,
    value: `${pubKeyList[1]}?context=${contextList[1]}`,
    validity: 86400
  },
  {
    key: `did/pub/${keyAlgorithm[2]}/${keyPurpose[2]}/${encoding[2]}`,
    value: `${pubKeyList[2]}?context=${contextList[2]}`,
    validity: 86400
  },
]

// copy from vda-did
function decodeAttrValue(value: string, encoding: string | undefined) {
  const matchHexString = value.match(/^0x[0-9a-fA-F]*$/)
  if (encoding && !matchHexString) {
    if (encoding === 'base64') {
      return hexlify(base64.decode(value))
    }
    if (encoding === 'base58') {
      return hexlify(Base58.decode(value))
    }
  } else if (matchHexString) {
    return <string>value
  }

  return hexlify(toUtf8Bytes(value))
}

// copy from vda-did
export function attributeToHex(key: string, value: string | Uint8Array): string {
  if (value instanceof Uint8Array || isBytes(value)) {
    return hexlify(value)
  }
  const matchKeyWithEncoding = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
  const encoding = matchKeyWithEncoding?.[6]

  // const matchValueWithContext =
  //   matchKeyWithEncoding?.[1] === 'svc'
  //     ? (<string>value).match(/(.*)\?context=(.*)&type=(\w+)/)
  //     : (<string>value).match(/(.*)\?context=(.*)/)
  const matchValueWithContext = value.match(/(.*)(\?context=(.*))/)

  // console.log('attributeToHex value : ', value)
  // console.log('attributeToHex matched : ', matchValueWithContext)

  const attrVal = matchValueWithContext ? matchValueWithContext?.[1] : <string>value
  const attrContext = matchValueWithContext?.[2]

  let returnValue = decodeAttrValue(attrVal, encoding)

  if (attrContext) {
    const contextTag = Buffer.from(attrContext, 'utf-8').toString('hex')
    returnValue = `${returnValue}${contextTag}`
  }
  return returnValue
}

export function stringToBytes32(str: string): string {
  const buffStr = '0x' + Buffer.from(str).slice(0, 32).toString('hex')
  return buffStr + '0'.repeat(66 - buffStr.length)
}
