/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-var-requires */

import {
    arrayify,
    concat,
    formatBytes32String,
    hexConcat,
    hexlify,
    keccak256,
    SigningKey,
    toUtf8Bytes,
    zeroPad,
  } from 'ethers/lib/utils.js'

import { stringToBytes32, attributeToHex } from './helpers.mjs'

// const Web3 = require('web3')
import Web3 from 'web3'

import { createRequire } from "module"; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url); // construct the require method
const ControllerContract = require('../artifacts/contracts/VeridaDIDRegistry.sol/VeridaDIDRegistry.json')


// BSC
// const address = "0x713A5Db664297195061b9558f40e88434cb79C77";
// const web3 = new Web3('https://speedy-nodes-nyc.moralis.io/bd1c39d7c8ee1229b16b4a97/bsc/testnet');

// Polygon main net
const address = '0xAe8c7BBA52Dfc2346dCa38840389495D38eE7C7c'
const web3 = new Web3('https://polygon-rpc.com/')
// const web3 = new Web3('https://polygon-mainnet.g.alchemy.com/v2/JT3kfJ7hivnlA2dtPNpw3ahJCjhW26EV');

const { privateKey } = require('./.evn.json')

const { address: admin } = web3.eth.accounts.wallet.add(privateKey)
const controller = new web3.eth.Contract(ControllerContract.abi, address)

const identity =  '0x268c970A5FBFdaFfdf671Fa9d88eA86Ee33e14B1'.toLowerCase()
// '0x599b3912A63c98dC774eF3E60282fBdf14cda748'.toLowerCase()
const delegate1 = '0x01298a7ec3e153dac8d0498ea9b40d3a40b51900'

let dParams = []
let aParams = []
const signedDParams = []
const signedAParams = []

// export enum DelegateTypes {
//     veriKey = 'veriKey',
//     sigAuth = 'sigAuth',
//     enc = 'enc',
//   }
const veriKey = 'veriKey'
const sigAuth = 'sigAuth'
const enc = 'enc'

const signerPrivateKey = arrayify('0xa285ab66393c5fdda46d6fbad9e27fafd438254ab72ad5acb681a0e9f20f5d7b')
const signerAddress = '0x2036C6CD85692F0Fb2C26E6c6B2ECed9e4478Dfd'


dParams.push({ // Key Agreement
    delegateType: enc,
    delegate: delegate1,
    },{ // Verification method
    delegateType: veriKey,
    delegate: delegate1,
    }, { // Authentication method
    delegateType: sigAuth,
    delegate: delegate1,
    },
)

dParams = dParams.map((item) => {
    return {
        delegateType: stringToBytes32(item.delegateType),
        delegate: item.delegate,
        validity: 86400,
    }
})

const context = '0x84e5fb4eb5c3f53d8506e7085dfbb0ef333c5f7d0769bcaf4ca2dc0ca4698fd4'
// { name: string; value: string; validity: number }
aParams.push({
    name: 'did/svc/VeridaDatabase',
    value: 'https://db.testnet.verida.io:5002##' + context + '##database',
    },{
    name: 'did/svc/VeridaMessage',
    value: 'https://db.testnet.verida.io:5002##' + context + '##messaging',
    },{
    name: 'did/svc/VeridaNotification',
    value: 'https://notification.testnet.verida.io:5002##' + context + '##notification',
    },{
    name: 'did/svc/VeridaStorage',
    value: 'https://storage.testnet.verida.io:5002##' + context + '##storage',
    },{
    name: 'did/svc/BlockchainAddress',
    value: '0x01298a7ec3e153dac8d0498ea9b40d3a40b51900##' + context + '##ethereum:eip155-1',
    },
)

aParams = aParams.map((item) => {
    let attrValue = attributeToHex(item.name, item.value)

    const attrName = item.name.startsWith('0x') ? item.name : stringToBytes32(item.name)
    attrValue = attrValue.startsWith('0x')
        ? attrValue
        : '0x' + Buffer.from(attrValue, 'utf-8').toString('hex')
    return {
        name: attrName,
        value: attrValue,
        validity: 86400
    }    
})

async function addDelegate() {
    try {
        const tx = controller.methods.addDelegate(
            identity, 
            dParams[0].delegateType,
            dParams[0].delegate,
            dParams[0].validity,
        )

        const [gasPrice, gasCost] = await Promise.all([web3.eth.getGasPrice(), tx.estimateGas({ from: admin })])

        const data = tx.encodeABI()

        const txData = {
            from: admin,
            to: controller.options.address,
            data,
            gas: gasCost,
            gasPrice,
        }

        const receipt = await web3.eth.sendTransaction(txData)
        console.log(`Transaction hash: ${receipt.transactionHash}`)
        // console.log('Receipt', receipt);
        return { success: true, transactionHash: receipt.transactionHash }
    } catch (e) {
        console.log('Error occured : ', e)
        return { success: false, error: e }
    }
}

const signData = async (
    identity,
    // signerAddress: string,
    privateKeyBytes,
    dataBytes,
    nonce
  ) => {
    const paddedNonce = zeroPad(arrayify(nonce), 32)
    const dataToSign = hexConcat(['0x1900', address, paddedNonce, identity, dataBytes])
    const hash = keccak256(dataToSign)
    return new SigningKey(privateKeyBytes).signDigest(hash)
}

async function generateAddSignedParams() {
    signedDParams.length = 0
    signedAParams.length = 0

    let nonce = await controller.methods.nonce(signerAddress).call()

    const sig = await signData(
        signerAddress, 
        signerPrivateKey, 
        concat([
            toUtf8Bytes('addDelegate'),
            formatBytes32String('attestor'),
            delegate1,
            zeroPad(hexlify(86400), 32),
        ]),
        nonce++
    )
    signedDParams.push(
        {
            identity: signerAddress,
            sigV: sig.v,
            sigR: sig.r,
            sigS: sig.s,
            delegateType: formatBytes32String('attestor'),
            delegate: delegate1,
            validity: 86400,
        }
    )

    const sig2 = await signData(
        signerAddress,
        // signerAddress,
        signerPrivateKey,
        concat([
          toUtf8Bytes('setAttribute'),
          formatBytes32String('encryptionKey'),
          toUtf8Bytes('mykey'),
          zeroPad(hexlify(86400), 32),
        ]),
        nonce++
    )

    signedAParams.push(
        {
            identity: signerAddress,
            sigV: sig2.v,
            sigR: sig2.r,
            sigS: sig2.s,
            name: formatBytes32String('encryptionKey'),
            value: toUtf8Bytes('mykey'),
            validity: 86400,
        }
    )
}

async function bulkAdd() {
    await generateAddSignedParams()

    // console.log('dParam: ', dParams)
    // console.log('aParam: ', aParams)
    // console.log('signedDParam: ', signedDParams)
    // console.log('signedAParam: ', signedDParams)

    // console.log('contract: ', controller)

    try {
        const tx = controller.methods.bulkAdd(identity, dParams, aParams, signedDParams, signedAParams)

        const [gasPrice, gasCost] = await Promise.all([web3.eth.getGasPrice(), tx.estimateGas({ from: admin })])

        const data = tx.encodeABI()

        const txData = {
            from: admin,
            to: controller.options.address,
            data,
            gas: gasCost,
            gasPrice,
        }

        const receipt = await web3.eth.sendTransaction(txData)
        // console.log(`Transaction hash: ${receipt.transactionHash}`)
        // console.log('Receipt', receipt);
        return { success: true, transactionHash: receipt.transactionHash }
    } catch (e) {
        console.log('Error occured : ', e)
        return { success: false, error: e }
    }
}

async function generateRevokeSignedParams() {
    signedDParams.length = 0
    signedAParams.length = 0

    let nonce = await controller.methods.nonce(signerAddress).call()

    const sig = await signData(
        signerAddress, 
        signerPrivateKey, 
        concat([
            toUtf8Bytes('revokeDelegate'),
            formatBytes32String('attestor'),
            delegate1,
        ]),
        nonce++
    )
    signedDParams.push(
        {
            identity: signerAddress,
            sigV: sig.v,
            sigR: sig.r,
            sigS: sig.s,
            delegateType: formatBytes32String('attestor'),
            delegate: delegate1,
        }
    )

    const sig2 = await signData(
        signerAddress,
        // signerAddress,
        signerPrivateKey,
        concat([
          toUtf8Bytes('revokeAttribute'),
          formatBytes32String('encryptionKey'),
          toUtf8Bytes('mykey'),
        ]),
        nonce++
    )

    signedAParams.push(
        {
            identity: signerAddress,
            sigV: sig2.v,
            sigR: sig2.r,
            sigS: sig2.s,
            name: formatBytes32String('encryptionKey'),
            value: toUtf8Bytes('mykey'),
        }
    )
}
async function bulkRevoke() {
    await generateRevokeSignedParams()

    try {
        const tx = controller.methods.bulkRevoke(identity, dParams, aParams, signedDParams, signedAParams)

        const [gasPrice, gasCost] = await Promise.all([web3.eth.getGasPrice(), tx.estimateGas({ from: admin })])

        const data = tx.encodeABI()

        const txData = {
            from: admin,
            to: controller.options.address,
            data,
            gas: gasCost,
            gasPrice,
        }

        const receipt = await web3.eth.sendTransaction(txData)
        console.log(`Transaction hash: ${receipt.transactionHash}`)
        // console.log('Receipt', receipt);
        return { success: true, transactionHash: receipt.transactionHash }
    } catch (e) {
        console.log('Error occured : ', e)
        return { success: false, error: e }
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function testCaller() {
    let startTime, endTime

    startTime = Date.now();
    console.log("Start: ", startTime )

    await addDelegate()

    endTime = Date.now();
    console.log("End: ", endTime )

    console.log("addDelegate() Consumed: ", endTime - startTime)



    await sleep(3000);

    startTime = Date.now();
    console.log("Start: ", startTime )

    await bulkAdd()

    endTime = Date.now();
    console.log("End: ", endTime )

    console.log("bulkAdd() Consumed: ", endTime - startTime)



    await sleep(3000);

    startTime = Date.now();
    console.log("Start: ", startTime )

    await bulkRevoke()

    endTime = Date.now();
    console.log("End: ", endTime )

    console.log("bulkRevoke() Consumed: ", endTime - startTime)
}

async function testThreeTimes() {
    await testCaller();

    // await testCaller();

    // await testCaller();

}

testThreeTimes()


// module.exports = {
//     bulkAdd
// }
