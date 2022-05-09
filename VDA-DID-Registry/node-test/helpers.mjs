import { hexlify, hexValue, isBytes } from '@ethersproject/bytes'
import * as base64 from '@ethersproject/base64'
import { Base58 } from '@ethersproject/basex'
import { toUtf8Bytes } from '@ethersproject/strings'

export function stringToBytes32(str) {
  const buffStr = '0x' + Buffer.from(str).slice(0, 32).toString('hex')
  return buffStr + '0'.repeat(66 - buffStr.length)
}

export function attributeToHex(key, value) {
  if (value instanceof Uint8Array || isBytes(value)) {
    return hexlify(value)
  }
  const matchKeyWithEncoding = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)

  // Added for service name. Need to be updated for supporting UTF-8, later
  // if (matchKeyWithEncoding?.[1] === 'svc') {
  //   console.log('ethr-did: attributeToHex : ', <string>value)
  //   return <string>value
  // }

  const encoding = matchKeyWithEncoding?.[6]
  const matchHexString = value.match(/^0x[0-9a-fA-F]*$/)
  if (encoding && !matchHexString) {
    if (encoding === 'base64') {
      return hexlify(base64.decode(value))
    }
    if (encoding === 'base58') {
      return hexlify(Base58.decode(value))
    }
  } else if (matchHexString) {
    return value
  }

  return hexlify(toUtf8Bytes(value))
}
