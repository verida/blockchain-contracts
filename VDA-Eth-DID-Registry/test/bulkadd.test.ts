import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { BigNumberish, ContractTransaction } from 'ethers'
import { Block, Log } from '@ethersproject/providers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  arrayify,
  BytesLike,
  concat,
  formatBytes32String,
  hexConcat,
  hexlify,
  hexZeroPad,
  keccak256,
  parseBytes32String,
  SigningKey,
  toUtf8Bytes,
  zeroPad,
} from 'ethers/lib/utils'

import hre from 'hardhat'

import {
  DIDAttributeChangedEvent,
  DIDDelegateChangedEvent,
  DIDOwnerChangedEvent,
  EthereumDIDRegistry,
} from '../typechain/EthereumDIDRegistry'

chai.use(chaiAsPromised)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ethers } = require('hardhat')

describe('ERC1056', () => {
  let didReg: EthereumDIDRegistry
  let identity: SignerWithAddress // = accounts[0];
  let identity2: SignerWithAddress // = accounts[1];
  let delegate: SignerWithAddress // = accounts[2];
  let delegate2: SignerWithAddress // = accounts[3];
  let delegate3: SignerWithAddress // = accounts[4];
  let badBoy: SignerWithAddress // = accounts[5];

  before(async () => {
    await hre.network.provider.send('hardhat_reset')
    const Registry = await ethers.getContractFactory('EthereumDIDRegistry')
    didReg = await Registry.deploy()
    await didReg.deployed()
    ;[identity, identity2, delegate, delegate2, delegate3, badBoy] = await ethers.getSigners()

    /*
    console.log('Identity: ', identity.address)
    console.log('Identity2: ', identity2.address)
    console.log('delegate: ', delegate.address)
    console.log('delegate2: ', delegate2.address)
    console.log('delegate3: ', delegate3.address)
    console.log('badBoy: ', badBoy.address)
    */
  })

  const privateKey = arrayify('0xa285ab66393c5fdda46d6fbad9e27fafd438254ab72ad5acb681a0e9f20f5d7b')
  const signerAddress = '0x2036C6CD85692F0Fb2C26E6c6B2ECed9e4478Dfd'

  const privateKey2 = arrayify('0xa285ab66393c5fdda46d6fbad9e27fafd438254ab72ad5acb681a0e9f20f5d7a')
  const signerAddress2 = '0xEA91e58E9Fa466786726F0a947e8583c7c5B3185'

  async function signData(
    identity: string,
    signerAddress: string,
    privateKeyBytes: Uint8Array,
    dataBytes: Uint8Array,
    nonce?: number
  ) {
    const _nonce = nonce || (await didReg.nonce(signerAddress))
    const paddedNonce = zeroPad(arrayify(_nonce), 32)
    const dataToSign = hexConcat(['0x1900', didReg.address, paddedNonce, identity, dataBytes])
    const hash = keccak256(dataToSign)
    return new SigningKey(privateKeyBytes).signDigest(hash)
  }

  /*
  describe('bulkAdd()', () => {
    let tx: ContractTransaction
    let block: Block
    let previousChange: number

    const delegateParams: { delegateType: BytesLike; delegate: string; validity: BigNumberish }[] = []
    const attributeParams: { name: BytesLike; value: BytesLike; validity: BigNumberish }[] = []
    const signedDelegateParams: {
      sigV: number
      sigR: BytesLike
      sigS: BytesLike
      delegateType: BytesLike
      delegate: string
      validity: BigNumberish
    }[] = []
    const signedAttributeParams: {
      sigV: number
      sigR: BytesLike
      sigS: BytesLike
      name: BytesLike
      value: BytesLike
      validity: BigNumberish
    }[] = []

    before(async () => {
      delegateParams.push({
        delegateType: formatBytes32String('attestor'),
        delegate: delegate3.address,
        validity: 86400,
      })

      delegateParams.push({
        delegateType: formatBytes32String('attestor-2'),
        delegate: delegate2.address,
        validity: 86400,
      })

      attributeParams.push({
        name: formatBytes32String('encryptionKey'),
        value: toUtf8Bytes('mykey'),
        validity: 86400,
      })

      previousChange = (await didReg.changed(identity.address)).toNumber()
      tx = await didReg
        .connect(identity)
        .bulkAdd(identity.address, delegateParams, attributeParams, signedDelegateParams, signedAttributeParams)
      // .addDelegate(identity.address, formatBytes32String('attestor'), delegate3.address, 86400)
      block = await ethers.provider.getBlock((await tx.wait()).blockNumber)
    })

    it('Signing data test', async () => {
      const concatData = concat([
        toUtf8Bytes('addDelegate'),
        formatBytes32String('attestor'),
        delegate.address,
        zeroPad(hexlify(86400), 32),
      ])
      console.log('SigningData = ', concatData)
    })

    it('validDelegate should be true', async () => {
      const valid = await didReg.validDelegate(identity.address, formatBytes32String('attestor'), delegate3.address)
      expect(valid).to.equal(true) // assigned delegate correctly
    })
    it('should sets changed to transaction block', async () => {
      const latest = await didReg.changed(identity.address)
      expect(latest).to.equal((await tx.wait()).blockNumber)
    })
    it('should create DIDDelegateChanged event', async () => {
      let event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent
      expect(event.event).to.equal('DIDDelegateChanged')
      expect(event.args.identity).to.equal(identity.address)
      expect(parseBytes32String(event.args.delegateType)).to.equal('attestor')
      expect(event.args.delegate).to.equal(delegate3.address)
      expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400)
      expect(event.args.previousChange.toNumber()).to.equal(previousChange)

      event = (await tx.wait()).events?.[1] as DIDDelegateChangedEvent
      expect(event.event).to.equal('DIDDelegateChanged')
      expect(event.args.identity).to.equal(identity.address)
      expect(parseBytes32String(event.args.delegateType)).to.equal('attestor-2')
      expect(event.args.delegate).to.equal(delegate2.address)
      expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400)
      // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
    })

    it('should create DIDAttributeChanged event', async () => {
      const event = (await tx.wait()).events?.[2] as DIDAttributeChangedEvent
      expect(event.event).to.equal('DIDAttributeChanged')
      expect(event.args.identity).to.equal(identity.address)
      expect(parseBytes32String(event.args.name)).to.equal('encryptionKey')
      expect(event.args.value).to.equal('0x6d796b6579') // the hex encoding of the string "mykey"
      expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400)
      // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
    })
  })
  */

  describe('Signed bulk transaction', () => {
    let tx: ContractTransaction
    let block: Block
    let previousChange: number

    const delegateParams: { delegateType: BytesLike; delegate: string; validity: BigNumberish }[] = []
    const attributeParams: { name: BytesLike; value: BytesLike; validity: BigNumberish }[] = []
    const signedDelegateParams: {
      identity: string
      sigV: number
      sigR: BytesLike
      sigS: BytesLike
      delegateType: BytesLike
      delegate: string
      validity: BigNumberish
    }[] = []
    const signedAttributeParams: {
      identity: string
      sigV: number
      sigR: BytesLike
      sigS: BytesLike
      name: BytesLike
      value: BytesLike
      validity: BigNumberish
    }[] = []

    before(async () => {
      delegateParams.push({
        delegateType: formatBytes32String('attestor'),
        delegate: delegate3.address,
        validity: 86400,
      })

      delegateParams.push({
        delegateType: formatBytes32String('attestor-2'),
        delegate: delegate2.address,
        validity: 86400,
      })

      attributeParams.push({
        name: formatBytes32String('encryptionKey'),
        value: toUtf8Bytes('mykey'),
        validity: 86400,
      })
    })

    it('bulkAdd test', async () => {
      let signerNonce = Number(await didReg.nonce(signerAddress))

      const sig = await signData(
        signerAddress,
        signerAddress,
        privateKey,
        concat([
          toUtf8Bytes('addDelegate'),
          formatBytes32String('attestor'),
          delegate.address,
          zeroPad(hexlify(86400), 32),
        ]),
        signerNonce++
      )

      signedDelegateParams.push({
        identity: signerAddress,
        sigV: sig.v,
        sigR: sig.r,
        sigS: sig.s,
        delegateType: formatBytes32String('attestor'),
        delegate: delegate.address,
        validity: 86400,
      })

      console.log(signedDelegateParams)

      const sig2 = await signData(
        signerAddress,
        signerAddress,
        privateKey,
        concat([
          toUtf8Bytes('setAttribute'),
          formatBytes32String('encryptionKey'),
          toUtf8Bytes('mykey'),
          zeroPad(hexlify(86400), 32),
        ]),
        signerNonce++
      )

      signedAttributeParams.push({
        identity: signerAddress,
        sigV: sig2.v,
        sigR: sig2.r,
        sigS: sig2.s,
        name: formatBytes32String('encryptionKey'),
        value: toUtf8Bytes('mykey'),
        validity: 86400,
      })

      console.log(signedAttributeParams)

      // Change owner to SignerAddress
      // await didReg.connect(identity).changeOwner(identity.address, signerAddress)
      // console.log('Owner of ', identity.address, ' = ', await didReg.identityOwner(identity.address))

      previousChange = (await didReg.changed(identity.address)).toNumber()
      tx = await didReg
        .connect(identity)
        .bulkAdd(identity.address, delegateParams, attributeParams, signedDelegateParams, signedAttributeParams)
        // .addDelegateSigned(signerAddress, sig.v, sig.r, sig.s, formatBytes32String('attestor'), delegate.address, 86400)
        // .setAttributeSigned(
        //   signerAddress,
        //   sig2.v,
        //   sig2.r,
        //   sig2.s,
        //   formatBytes32String('encryptionKey'),
        //   toUtf8Bytes('mykey'),
        //   86400
        // )
      block = await ethers.provider.getBlock((await tx.wait()).blockNumber)
    })

    it('bulkRevoke test', async () => {
      let signerNonce = Number(await didReg.nonce(signerAddress))

      signedDelegateParams.length = 0
      signedAttributeParams.length = 0

      const sig = await signData(
        signerAddress,
        signerAddress,
        privateKey,
        concat([toUtf8Bytes('revokeDelegate'), formatBytes32String('attestor'), delegate.address]),
        signerNonce++
      )

      signedDelegateParams.push({
        identity: signerAddress,
        sigV: sig.v,
        sigR: sig.r,
        sigS: sig.s,
        delegateType: formatBytes32String('attestor'),
        delegate: delegate.address,
        validity: 86400,
      })

      console.log(signedDelegateParams)

      const sig2 = await signData(
        signerAddress,
        signerAddress,
        privateKey,
        concat([toUtf8Bytes('revokeAttribute'), formatBytes32String('encryptionKey'), toUtf8Bytes('mykey')]),
        signerNonce++
      )

      signedAttributeParams.push({
        identity: signerAddress,
        sigV: sig2.v,
        sigR: sig2.r,
        sigS: sig2.s,
        name: formatBytes32String('encryptionKey'),
        value: toUtf8Bytes('mykey'),
        validity: 86400,
      })

      console.log(signedAttributeParams)

      // Change owner to SignerAddress
      // await didReg.connect(identity).changeOwner(identity.address, signerAddress)
      // console.log('Owner of ', identity.address, ' = ', await didReg.identityOwner(identity.address))

      previousChange = (await didReg.changed(identity.address)).toNumber()
      tx = await didReg
        .connect(identity)
        .bulkRevoke(identity.address, delegateParams, attributeParams, signedDelegateParams, signedAttributeParams)
        // .addDelegateSigned(signerAddress, sig.v, sig.r, sig.s, formatBytes32String('attestor'), delegate.address, 86400)
        // .setAttributeSigned(
        //   signerAddress,
        //   sig2.v,
        //   sig2.r,
        //   sig2.s,
        //   formatBytes32String('encryptionKey'),
        //   toUtf8Bytes('mykey'),
        //   86400
        // )
      block = await ethers.provider.getBlock((await tx.wait()).blockNumber)
    })

    it('Signing data test', async () => {
      const concatData = concat([
        toUtf8Bytes('addDelegate'),
        formatBytes32String('attestor'),
        delegate.address,
        zeroPad(hexlify(86400), 32),
      ])
      // console.log('SigningData = ', concatData)
    })

    /*
    it('validDelegate should be true', async () => {
      const valid = await didReg.validDelegate(identity.address, formatBytes32String('attestor'), delegate3.address)
      expect(valid).to.equal(true) // assigned delegate correctly
    })
    it('should sets changed to transaction block', async () => {
      const latest = await didReg.changed(identity.address)
      expect(latest).to.equal((await tx.wait()).blockNumber)
    })
    it('should create DIDDelegateChanged event', async () => {
      let event = (await tx.wait()).events?.[0] as DIDDelegateChangedEvent
      expect(event.event).to.equal('DIDDelegateChanged')
      expect(event.args.identity).to.equal(identity.address)
      expect(parseBytes32String(event.args.delegateType)).to.equal('attestor')
      expect(event.args.delegate).to.equal(delegate3.address)
      expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400)
      expect(event.args.previousChange.toNumber()).to.equal(previousChange)

      event = (await tx.wait()).events?.[1] as DIDDelegateChangedEvent
      expect(event.event).to.equal('DIDDelegateChanged')
      expect(event.args.identity).to.equal(identity.address)
      expect(parseBytes32String(event.args.delegateType)).to.equal('attestor-2')
      expect(event.args.delegate).to.equal(delegate2.address)
      expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400)
      // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
    })

    it('should create DIDAttributeChanged event', async () => {
      const event = (await tx.wait()).events?.[2] as DIDAttributeChangedEvent
      expect(event.event).to.equal('DIDAttributeChanged')
      expect(event.args.identity).to.equal(identity.address)
      expect(parseBytes32String(event.args.name)).to.equal('encryptionKey')
      expect(event.args.value).to.equal('0x6d796b6579') // the hex encoding of the string "mykey"
      expect(event.args.validTo.toNumber()).to.equal(block.timestamp + 86400)
      // expect(event.args.previousChange.toNumber()).to.equal(previousChange)
    })
    */
  })
})
