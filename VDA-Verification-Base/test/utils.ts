import { DIDClient } from "@verida/did-client"
import { AutoAccount } from "@verida/account-node";
import { Client} from "@verida/client-ts";
import { EnvironmentType, DIDClientConfig } from '@verida/types'

// import { Wallet } from '@ethersproject/wallet'
import { Wallet } from "ethers"
import { JsonRpcProvider } from '@ethersproject/providers'

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
        network: EnvironmentType.TESTNET,
        rpcUrl: rpcUrl
    }

    const didClient = new DIDClient(config)

    console.log("DIDClient created");

    // Configure authenticate to talk directly to the blockchain
    didClient.authenticate(
        veridaAccount.privateKey,
        'web3',
        {
            privateKey: '383b7ac8d2f4eb6693b2bc8de97d26c69a50f7b10520e11ea97b4f95dd219967'
        },
        [
            `https://acacia-dev1.tn.verida.tech/did/`,
            `https://acacia-dev2.tn.verida.tech/did`,
            `https://acacia-dev3.tn.verida.tech/did/`
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
    'https://node2-apse2.devnet.verida.tech/did/',
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
            network: EnvironmentType.TESTNET,
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