import { DIDClient, DIDClientConfig } from "@verida/did-client"
import { AutoAccount } from "@verida/account-node";
import { Client, EnvironmentType } from "@verida/client-ts";

// import { Wallet } from '@ethersproject/wallet'
import { Wallet } from "ethers"
import { JsonRpcProvider } from '@ethersproject/providers'

import { Keyring } from "@verida/keyring";

if (process.env.PRIVATE_KEY === undefined) {
    throw new Error('PRIVATE_KEY not defined in env')
}
const privateKey : string = process.env.PRIVATE_KEY!

const rpcUrl = process.env[`RPC_URL`]
if (rpcUrl === undefined) {
    throw new Error('RPC url is not defined in env')
}
console.log('RPC URL :', rpcUrl)

const provider = new JsonRpcProvider(rpcUrl);
const txSigner = new Wallet(privateKey, provider)

export async function getDIDClient(veridaAccount: Wallet) {
    
    const config: DIDClientConfig = {
        network: 'testnet',
        rpcUrl: rpcUrl
    }

    const didClient = new DIDClient(config)

    console.log("DIDClient created");

    // Configure authenticate to talk directly to the blockchain
    didClient.authenticate(
        veridaAccount.privateKey,
        'web3',
        {
            privateKey
        },
        [
            `https://node1-apse2.devnet.verida.tech/did/`,
            // `https://node1-apse2.devnet.verida.tech/did/`,
            `https://node3-apse2.devnet.verida.tech/did/`,
        ]
    )

    console.log("DIDClient authenticated");

    // Configure authenticate to use meta transaction server
    /*didClient.authenticate(
        veridaAccount.privateKey,
        'gasless',
        {
            veridaKey: veridaAccount.privateKey,
            serverConfig: {
                headers: {
                    'context-name' : 'Verida Test'
                } 
              },
              postConfig: {
                  headers: {
                      'user-agent': 'Verida-Vault'
                  }
              },
              endpointUrl: 'http://localhost:5021'
        }
    )*/

    return didClient
}

const DEFAULT_ENDPOINTS = [
    'https://node1-apse2.devnet.verida.tech/did/', 
    // 'https://node1-apse2.devnet.verida.tech/did/', 
    'https://node3-apse2.devnet.verida.tech/did/'
]

export async function initVerida(didwallet: Wallet, CONTEXT_NAME: string) {
    const account = new AutoAccount({
        defaultDatabaseServer: {
            type: 'VeridaDatabase',
            endpointUri: DEFAULT_ENDPOINTS
        },
        defaultMessageServer: {
            type: 'VeridaMessage',
            endpointUri: DEFAULT_ENDPOINTS
        },
    }, {
        privateKey: didwallet.privateKey,
        environment: EnvironmentType.TESTNET,
        didClientConfig: {
            callType: 'web3',
            web3Config: {
                privateKey,
                rpcUrl
            },
            didEndpoints: DEFAULT_ENDPOINTS
        }
    })

    const client = new Client({
        environment: EnvironmentType.TESTNET,
        didClientConfig: {
            rpcUrl
        }
    })

    // console.log("Connecting account...")
    await client.connect(account)

    // console.log("Opening context...")
    const context = await client.openContext(CONTEXT_NAME, true)

    return {
        didwallet,
        account,
        client,
        context,
        CONTEXT_NAME
    }
}

export interface SignInfo {
    signKeyring : Keyring
    signerAddress: string
    signerProof?: string
    userKeyring: Keyring
    userAddress: string
    userProof?:  string
}

export async function generateProof() : Promise<SignInfo> {
    const signWallet = Wallet.createRandom()
    // const signWallet = Wallet.fromMnemonic('devote biology pass disorder fit cherry grace polar wrist trash regret frame')
    const signVerida = await initVerida(signWallet, 'Facebook: FB Signing Context')
    const signAccount = signVerida.account
    const signerDid = await signAccount.did()
    const SIGN_CONTEXT_NAME = signVerida.CONTEXT_NAME
    const signKeyring = await signAccount.keyring(SIGN_CONTEXT_NAME)

    // console.log("Signer: ", signWallet.address, " - ", signerDid)

    const userVerida = await initVerida(Wallet.createRandom(), 'Verida: Test DID User Context')
    const userWallet = userVerida.didwallet
    const userAccount = userVerida.account
    const userDid = await userAccount.did()
    const USER_CONTEXT_NAME = userVerida.CONTEXT_NAME
    const userKeyring = await userAccount.keyring(USER_CONTEXT_NAME)

    const didClient = await signAccount.getDidClient()

    const signerDoc = await didClient.get(signerDid)
    const signerProof = signerDoc.locateContextProof(SIGN_CONTEXT_NAME)

    const userDoc = await didClient.get(userDid)
    const userProof = userDoc.locateContextProof(USER_CONTEXT_NAME)

    return {
        signKeyring,
        signerAddress: signWallet.address.toLowerCase(),
        signerProof,
        userKeyring,
        userAddress: userWallet.address.toLowerCase(),
        userProof,
    }
}