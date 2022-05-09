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

// BSC testnet
const address = "0x2862BC860f55D389bFBd1A37477651bc1642A20B";
const web3 = new Web3('https://speedy-nodes-nyc.moralis.io/bd1c39d7c8ee1229b16b4a97/bsc/testnet');

const { privateKey } = require('./.evn.json')

const { address: admin } = web3.eth.accounts.wallet.add(privateKey)
const controller = new web3.eth.Contract(ControllerContract.abi, address)

const identity =  '0x268c970A5FBFdaFfdf671Fa9d88eA86Ee33e14B1'.toLowerCase()
// '0x599b3912A63c98dC774eF3E60282fBdf14cda748'.toLowerCase()
const delegate = '0x01298a7ec3e153dac8d0498ea9b40d3a40b51900'

const testSignature = "0x67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c"
const badSignature = "0xf157fd349172fa8bb84710d871724091947289182373198723918cabcc888ef888ff8876956050565d5757a57d868b8676876e7678687686f95419238191488923"


async function changeOwner() {
    try {
        const tx = controller.methods.changeOwner(
            identity, 
            delegate,
            testSignature,
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

async function setAttribute() {
    try {
        const tx = controller.methods.setAttribute(
            identity,
            formatBytes32String("encryptionKey"),
            formatBytes32String("encryptionKey"),
            86400,
            testSignature
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

async function bulkAdd() {
    const delegateParams = [];
    const attributeParams = [];
    const delegate2 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
    const delegate3 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"

    delegateParams.push({
        delegateType: formatBytes32String("bulktest-1"),
        delegate: delegate3,
        validity: 86400
    })
    
    delegateParams.push({
        delegateType: formatBytes32String("bulktest-2"),
        delegate: delegate2,
        validity: 86400
    })
    
    attributeParams.push({
        name: formatBytes32String("encryptionKey"),
        value: "0x12345678",
        validity: 86400
    })
    
    try {
        const tx = controller.methods.bulkAdd(
            identity,
            delegateParams,
            attributeParams,
            testSignature
        )

        console.log("bulkAdd TX:", tx)

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
    }}

// changeOwner()
// setAttribute()
bulkAdd()