import { EnvironmentType, DIDClientConfig } from "@verida/types"

export default {
    ENVIRONMENT: EnvironmentType.TESTNET,
    VDA_PRIVATE_KEY:   '0x91d3b996ec98a9a536efdffbae40e5eaaf117765a587483c69195c9460165d39',
    VDA_PRIVATE_KEY_2: '0x92d3b996ec98a9a536efdffbae40f5eaaf117765a587483c69195c9460165d39',
    VDA_PRIVATE_KEY_3: '0x93d3b996ec98a91536efdffbae40f5eaaf117765a587483c69195c9460165d39',
    CONTEXT_NAME: 'Verida Test: On-Chain Verification',
    DATABASE_SERVER: 'https://sn-acacia1.tn.verida.tech/',
    MESSAGE_SERVER: 'https://sn-acacia1.tn.verida.tech/',
    DEFAULT_ENDPOINTS: {
        defaultDatabaseServer: {
            type: 'VeridaDatabase',
            endpointUri: 'https://sn-acacia1.tn.verida.tech/'
        },
        defaultMessageServer: {
            type: 'VeridaMessage',
            endpointUri: 'https://sn-acacia1.tn.verida.tech/'
        },
    },
    DID_CLIENT_CONFIG: <DIDClientConfig> {
        network: EnvironmentType.TESTNET,
        callType: 'web3',
        web3Config: {},
    },
}