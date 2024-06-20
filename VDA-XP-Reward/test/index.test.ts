import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import hre, { ethers , upgrades } from "hardhat"
import { VDAXPReward } from "../typechain-types";
import { VeridaToken } from "@verida/erc20-contract/typechain-types";
import EncryptionUtils from '@verida/encryption-utils'

import { abi as TokenABI, bytecode as TokenByteCode } from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json";

import { CLAIM_INVALID_XP, CLAIM_GAMER31, ClaimData, ClaimInfo, CLAIM_ZKPASS } from "./claimHelper";

let accountList: SignerWithAddress[];
let owner: SignerWithAddress;
let user: SignerWithAddress;
const registeredDID = Wallet.createRandom();

const trustedSigners = [
    Wallet.createRandom(),
    Wallet.createRandom(),
    Wallet.createRandom(),
]

// Reward receives address
const receiverAddress = [
    Wallet.createRandom().address,
    Wallet.createRandom().address,
    Wallet.createRandom().address,
]

describe("VeridaXPReward", () => {
    let contract: VDAXPReward;
    let token: VeridaToken;
    let veridaWallet: SignerWithAddress;

    const deployContracts = async() => {
        // Deploy and initialize token
        const tokenFactory = await ethers.getContractFactory(TokenABI, TokenByteCode)
        token = await tokenFactory.deploy() as VeridaToken
        await token.deployed()
        await token.initialize();

        await token.enableTransfer();

        const contractFactory = await ethers.getContractFactory("VDAXPReward")
        contract = (await upgrades.deployProxy(
            contractFactory,
            [token.address],
            {
                initializer: '__VDAXPReward_init'
            }
        )) as VDAXPReward
        await contract.deployed()
    }

    before(async() => {
        accountList = await ethers.getSigners();
        owner = accountList[0]
        user = accountList[1]
        veridaWallet = accountList[2];
        
        await deployContracts()
    })

    describe("TrustedSigners", () => {
        describe("Add an address", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).addTrustedSigner(
                    trustedSigners[0].address
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Add an address successfully", async () => {
                await contract.addTrustedSigner(trustedSigners[0].address)
            })

            it("Failed for already added address", async () => {
                await expect(contract.addTrustedSigner(
                    trustedSigners[0].address)
                ).to.be.revertedWithCustomError(contract, "RegisteredSigner")
            })
        })

        describe("Remove an address", () => {
            it("Failed from non-owner transaction", async () => {
                await expect(contract.connect(user).removeTrustedSigner(
                    trustedSigners[0].address
                )).to.be.rejectedWith('Ownable: caller is not the owner')
            })

            it("Failed for non-existing address", async () => {
                await expect(contract.removeTrustedSigner(
                    trustedSigners[1].address
                )).to.be.revertedWithCustomError(contract, "UnregisteredSigner")
            })

            it("Remove an address successfully", async () => {
                await contract.removeTrustedSigner(trustedSigners[0].address)
            })

            it("Failed for removed address", async () => {
                await expect(contract.removeTrustedSigner(
                    trustedSigners[0].address)
                ).to.be.revertedWithCustomError(contract, "UnregisteredSigner")
            })
        })
    })

    describe("Get contract addresses", () => {
        it("Get token address",async () => {
            expect(
                await contract.getTokenAddress()
            ).to.be.eq(token.address);
        })
    })

    describe("Rate denominator", () => {
        describe("Get rate denominator", () => {
            it("Get successfully", async () => {
                expect(await contract.getRateDenominator()).greaterThan(0);
            })
        })

        describe("Set rate denominator", () => {
            it("Failed for zero value", async () => {
                await expect(
                    contract.setRateDenominator(0)
                ).to.be.revertedWithCustomError(contract, "InvalidValue")
            })

            it("Failed for same value", async () => {
                const orgVal = await contract.getRateDenominator();
                await expect(
                    contract.setRateDenominator(orgVal)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");
            })

            it("Set successfully", async () => {
                const curSnapShot = await takeSnapshot();

                const orgVal = await contract.getRateDenominator();
                const newVal = orgVal * 10;
                await expect(
                    contract.setRateDenominator(newVal)
                ).to.emit(contract, "UpdateRateDenominator").withArgs(orgVal, newVal);

                expect(await contract.getRateDenominator()).to.be.eq(newVal);

                await curSnapShot.restore();
            })
        })
    })

    describe("XP-Token conversion rate", () => {
        describe("Get conversion rate", () => {
            it("Get successfully", async () => {
                expect(await contract.getConversionRate()).to.be.eq(0);
            })
        })

        describe("Set conversion rate", () => {
            let curSnapShot: SnapshotRestorer;

            before(async () => {
                curSnapShot = await takeSnapshot();
            })

            it("Failed for non-owner", async () => {
                await expect(
                    contract.connect(accountList[1]).setConversionRate(0)
                ).to.be.rejectedWith("Ownable: caller is not the owner");
            })

            it("Failed for zero value", async () => {
                // Before rate initialized (when rate is 0)
                await expect(
                    contract.setConversionRate(0)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");

                // Set value
                await expect(contract.setConversionRate(1)).to.emit(contract, "UpdateConversionRate");

                // Failed for 0 value when rate is not 0
                await expect(
                    contract.setConversionRate(0)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");

                await curSnapShot.restore();
            })

            it("Failed for same value", async () => {
                // Before rate initialized (when rate is 0)
                expect(await contract.getConversionRate()).to.eq(0);
                await expect(
                    contract.setConversionRate(0)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");

                // Set value
                const newRate = 1;
                await expect(
                    contract.setConversionRate(newRate)
                ).to.emit(contract, "UpdateConversionRate");
                expect(await contract.getConversionRate()).to.eq(newRate);

                // Failed for same value
                await expect(
                    contract.setConversionRate(newRate)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");

                await curSnapShot.restore();
            })

            it("Set successfully", async () => {
                // Before rate initialized (when rate is 0)
                expect(await contract.getConversionRate()).to.eq(0);
                let orgRate = 0;
                let newRate = 10;
                await expect(
                    contract.setConversionRate(newRate)
                ).to.emit(contract, "UpdateConversionRate").withArgs(orgRate, newRate);

                // When rate is not 0
                orgRate = await contract.getConversionRate();
                newRate = 10 * orgRate;
                await expect(
                    contract.setConversionRate(newRate)
                ).to.emit(contract, "UpdateConversionRate").withArgs(orgRate, newRate);

                await curSnapShot.restore();
            })
        })
    })

    describe("Claim XP reward", () => {
        const RATE_VALUE = 0.000001; // 1XP = 0.000001 VDA token (not care for token decimal)
        let conversionRate : number;

        let claimAvailableState: SnapshotRestorer;

        const contextSigner = Wallet.createRandom();

        /**
         * Get time that is 1 month before of the current blockchain time
         * Month value is in range of 1 to 12
         * @returns [issueYear, issueMonth] Array of year and month values
         */
        const getProofIssueTime = async () => {
            const blockTime = new Date((await time.latest()) * 1000);

            let issueYear = blockTime.getFullYear();
            let issueMonth = blockTime.getMonth(); // blockTime.getMonth() returns value between 0 and 11

            if (issueMonth == 0) {
                issueMonth = 12;
                issueYear = issueYear - 1;
            }

            return [issueYear, issueMonth];
        };

        /**
         * Update the `issueYear` and `issueMonth` values to valid time, that is 1 month before of current blockchain time
         * @param claims Array of `ClaimData` type
         * @returns Array of `ClaimData` type updated with valid `issueYear` and `issueMonth`
         */
        const updateProofIssueTime = async (claims:ClaimData[]): Promise<ClaimData[]> => {
            const [issueYear, issueMonth] = await getProofIssueTime();
            const ret: ClaimData[] = [];
            for (let i = 0; i < claims.length; i++) {
                const info = {...claims[i]};
                info.issueYear = issueYear;
                info.issueMonth = issueMonth;
                ret.push(info);
            }
            return ret;
        }
        
        /**
         * Create and returns a `ClaimInfo` type 
         * @param trustedSigner Trusted signer that is added to the contract
         * @param did DID address
         * @param data `ClaimData` type
         * @returns `ClaimInfo` type that added `signature` and `proof` to the `data` parameter
         */
        const generateClaimInfo = (trustedSigner:Wallet, did:string, data: ClaimData) : ClaimInfo => {
            const rawMsg = ethers.utils.solidityPack(
                ['address', 'string', 'uint16', 'uint8', 'uint'],
                [did, `${data.typeId}${data.uniqueId}`, data.issueYear, data.issueMonth, data.xp]
            );
            let privateKeyArray = new Uint8Array(Buffer.from(contextSigner.privateKey.slice(2), 'hex'));
            const signature = EncryptionUtils.signData(rawMsg, privateKeyArray);

            const proofMsg = `${trustedSigner.address}${contextSigner.address}`.toLowerCase();
            privateKeyArray = new Uint8Array(Buffer.from(trustedSigner.privateKey.slice(2), 'hex'));
            const proof = EncryptionUtils.signData(proofMsg, privateKeyArray);

            return { ...data, signature, proof };
        }

        /**
         * Create `requestSignature` and `requestProof` for `claimXPReward()` function
         * @param didAddress parameter of `claimXPReward()` function
         * @param recipient parameter of `claimXPReward()` function
         * @param claimData parameter of `claimXPReward()` function
         * @param requestSigner The singer of request - should be the walle that represent the above `didAddress`
         * @returns Array of [requestSignature, requestProof]
         */
        const getRequestSignature = async (didAddress: string, recipient: string, claimData: ClaimInfo[], requestSigner: Wallet) => {
            const nonce = await contract.nonce(didAddress);

            let requestMsg =  ethers.utils.solidityPack(
                ['address', 'address'],
                [didAddress, recipient]
            );
            for (let i = 0; i < claimData.length; i++) {
                requestMsg = ethers.utils.solidityPack(
                    ['bytes', 'bytes'],
                    [requestMsg, claimData[i].signature]
                )
            }
            requestMsg = ethers.utils.solidityPack(
                ['bytes', 'uint'],
                [requestMsg, nonce]
            );
            const privateKeyArray = new Uint8Array(Buffer.from(requestSigner.privateKey.slice(2), 'hex'))
            const requestSignature = EncryptionUtils.signData(requestMsg, privateKeyArray);

            const proofMsg = `${didAddress}${didAddress}`.toLowerCase();
            const requestProof = EncryptionUtils.signData(proofMsg, privateKeyArray);

            return [requestSignature, requestProof];
        }

        /**
         * Check the `claimXPReward()` function call
         * @param didWallet DID wallet - the address of the wallet is the first parameter of the `claimXPReward()` function
         * @param recipient The recipient address that receives the claimed reward - parameter of the `claimXPReward()` function
         * @param claimData Array of claim information - parameter of the `claimXPReward()` function
         * @param expectedResult - True if this transction should be succeed, false otherwise.
         * @param expectedCustomError - Optional parameter. This is the name of the custom error when the `expectedResult` is false
         */
        const checkClaimXPReward = async (
            didWallet : Wallet,
            recipient: string,
            claimData: ClaimInfo[],
            expectedResult: boolean,
            expectedCustomError?: string,
        ) => {
            const didAddress = didWallet.address;
            const [requestSignature, requestProof] = await getRequestSignature(didAddress, recipient, claimData, didWallet);

            if (expectedResult === true) {
                await expect(
                    contract.claimXPReward(didAddress, recipient, claimData, requestSignature, requestProof)
                ).to.emit(contract, "ClaimedXPReward").withArgs(
                    didAddress,
                    recipient,
                    anyValue,
                    anyValue,
                    anyValue
                )
            } else {
                await expect(
                    contract.claimXPReward(didAddress, recipient, claimData, requestSignature, requestProof)
                ).to.be.revertedWithCustomError(contract, expectedCustomError!)
            }
        }

        const CLAIM_GAMER31_UniqueID: ClaimData = {...CLAIM_GAMER31};

        before(async () => {
            CLAIM_GAMER31_UniqueID.uniqueId = 'unique_id_1';

            // Mint token to the VeridaWallet
            await token.mint(veridaWallet.address, 10000000n);
            expect(await token.balanceOf(veridaWallet.address)).to.be.eq(10000000n);

            // Add trusted signers to the contract
            for (let i = 0; i < trustedSigners.length; i++) {
                await expect(contract.addTrustedSigner(trustedSigners[i].address)).to.emit(contract, "AddTrustedSigner");
            }
            
            conversionRate = (await contract.getRateDenominator()) * RATE_VALUE;          
        })

        describe("Failed : Conversion rate not set", () => {
            it("Reverted successfully", async () => {
                expect(await contract.getConversionRate()).to.be.eq(0);
    
                await expect(
                    contract.claimXPReward(
                        Wallet.createRandom().address,
                        receiverAddress[0],
                        [],
                        '0x10',
                        '0x10'
                    )
                ).to.be.revertedWithCustomError(contract, "InvalidConversionRate");

                // Set conversion rate for other tests
                await contract.setConversionRate(conversionRate);
                claimAvailableState = await takeSnapshot();
            })
        })

        describe("Failed : Empty claim data", () => {
            it("Reverted successfully", async () => {
                await expect(
                    contract.claimXPReward(
                        registeredDID.address,
                        receiverAddress[0],
                        [],
                        '0x10',
                        '0x10'
                    )
                ).to.be.revertedWithCustomError(contract, "EmptyClaimData");
            })
        })

        describe("Falied : Invalid Request signature", () => {
            it("Reverted successfully", async () => {
                // Test with and without uniqueId
                const test_claim_infos = [CLAIM_GAMER31, CLAIM_GAMER31_UniqueID];
                for (let i = 0; i < test_claim_infos.length; i++) {
                    const claimData = [generateClaimInfo(Wallet.createRandom(), registeredDID.address, test_claim_infos[i])]; 
                    // 0 length signature
                    await expect(
                        contract.claimXPReward(
                            registeredDID.address,
                            receiverAddress[0],
                            claimData,
                            '0x',
                            '0x'
                        )
                    ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    
                    // 0 length proof
                    await expect(
                        contract.claimXPReward(
                            registeredDID.address,
                            receiverAddress[0],
                            claimData,
                            '0x1212',
                            '0x'
                        )
                    ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    
                    // Invalid request signature signer
                    const [requestSignature, requestProof] = await getRequestSignature(registeredDID.address, receiverAddress[0], claimData, Wallet.createRandom());
                    await expect(
                        contract.claimXPReward(
                            registeredDID.address,
                            receiverAddress[0],
                            claimData,
                            requestSignature,
                            requestProof
                        )
                    ).to.be.revertedWithCustomError(contract, "InvalidSignature");
                }
            })
        })
        
        describe("Failed : 0 XP value", () => {
            it("Reverted successfully", async () => {
                // Test with and without uniqueId
                const uniqueIds = ['', 'unique_id_1'];
                const invalidClaimInfo : ClaimData = {...CLAIM_INVALID_XP};
                for (let i = 0; i < uniqueIds.length; i++) {
                    invalidClaimInfo.uniqueId = uniqueIds[i];
    
                    const claimData = [generateClaimInfo(trustedSigners[0], registeredDID.address, invalidClaimInfo)];
                    await checkClaimXPReward(
                        registeredDID,
                        receiverAddress[0],
                        claimData,
                        false,
                        "InvalidXP"
                    );

                    const [validClaimData] = await updateProofIssueTime([CLAIM_GAMER31]);
                    
                    const multiClaimData = [
                        generateClaimInfo(trustedSigners[0], registeredDID.address, validClaimData),
                        generateClaimInfo(trustedSigners[1], registeredDID.address, invalidClaimInfo)
                    ];
                    await checkClaimXPReward(
                        registeredDID,
                        receiverAddress[0],
                        multiClaimData,
                        false,
                        "InvalidXP"
                    );
                }
            })
        })

        describe("Failed : Invalid Proof", () => {
            describe("Invalid proof time", () => {
                // Test for claim data with and without uniqueId
                const claim_gamer31_array = [CLAIM_GAMER31, CLAIM_GAMER31_UniqueID];

                let BLOCK_YEAR: number;
                let BLOCK_MONTH: number;

                before(async () => {
                    const blockTime = new Date((await time.latest()) * 1000);
    
                    BLOCK_YEAR = blockTime.getFullYear();
                    BLOCK_MONTH = blockTime.getMonth() + 1;
                })


                it("Invalid year value", async () => {
                    for (let n = 0; n < claim_gamer31_array.length; n++) {
                        // Restore state
                        await claimAvailableState.restore();
        
                        // Invalid Year
                        const CLAIM_INVALID_YEAR: ClaimData = {...claim_gamer31_array[n]};
                        const INVALID_YEAR_VALUES = [0, BLOCK_YEAR - 2, BLOCK_YEAR+1];
                        for (let i = 0; i < INVALID_YEAR_VALUES.length; i++) {
                            CLAIM_INVALID_YEAR.issueYear = INVALID_YEAR_VALUES[i];
                            const claimData = [ generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_INVALID_YEAR),];
        
                            await checkClaimXPReward(
                                registeredDID,
                                receiverAddress[0],
                                claimData,
                                false,
                                "InvalidProofTime"
                            )
                        }
                    }
                })

                it("Invalid month value", async () => {
                    for (let n = 0; n < claim_gamer31_array.length; n++) {
                        // Restore state
                        await claimAvailableState.restore();

                        const CLAIM_INVALID_MONTH: ClaimData = {...claim_gamer31_array[n]};
                        // Test invalid month values - that are out of range
                        const INVALID_MONTH_VALUES = [0, 13, 20];
                        // Add month value that is 2 months before of current blockchain time
                        if (BLOCK_MONTH > 2) {
                            INVALID_MONTH_VALUES.push(BLOCK_MONTH - 2);
                        }
                        // Add month values that are after 1 and 5 months from current blockchain time
                        INVALID_MONTH_VALUES.push((BLOCK_MONTH + 1) % 12, (BLOCK_MONTH + 5) % 12);

                        CLAIM_INVALID_MONTH.issueYear = BLOCK_YEAR;
                        for (let i = 0; i < INVALID_MONTH_VALUES.length; i++) {
                            CLAIM_INVALID_MONTH.issueMonth = INVALID_MONTH_VALUES[i];
                            const claimData = [ generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_INVALID_MONTH),]
        
                            await checkClaimXPReward(
                                registeredDID,
                                receiverAddress[0],
                                claimData,
                                false,
                                "InvalidProofTime"
                            )
                        }
                    }
        
                })

                it("Check in January", async () => {
                    for (let n = 0; n < claim_gamer31_array.length; n++) {
                        // Restore state
                        await claimAvailableState.restore();

                        // Set target date as Jan 2nd of next year. This consider the time zone offset
                        // If set as Jan 1st, the block time sometimes updated to the Dec 31th.
                        const targetDate = new Date(BLOCK_YEAR+1, 0, 2);
                        await time.increaseTo(targetDate.getTime() / 1000);

                        // Check for Nov failed
                        const CLAIM_INVALID_YEAR: ClaimData = {...claim_gamer31_array[n]};
                        CLAIM_INVALID_YEAR.issueYear = BLOCK_YEAR;
                        CLAIM_INVALID_YEAR.issueMonth = 11;
                        const claimData = [ generateClaimInfo(Wallet.createRandom(), registeredDID.address, CLAIM_INVALID_YEAR),];
        
                        await checkClaimXPReward(
                            registeredDID,
                            receiverAddress[0],
                            claimData,
                            false,
                            "InvalidProofTime"
                        )
                    }
                })
            })
            
            describe("Invalid signatures of claim information", () => {
                it("Claim information is not signed by trusted signer", async () => {
                    // Test with and without uniqueId
                    const test_claim_infos = [CLAIM_GAMER31, CLAIM_GAMER31_UniqueID];
                    for (let i = 0; i < test_claim_infos.length; i++) {
                        await claimAvailableState.restore();
    
                        const [CLAIM_1, CLAIM_2] = await updateProofIssueTime([test_claim_infos[i], CLAIM_ZKPASS]);
    
                        // Single Claim Information
                        let claimData = [
                            generateClaimInfo(Wallet.createRandom(), registeredDID.address, CLAIM_1),
                        ]
                        await checkClaimXPReward(
                            registeredDID,
                            receiverAddress[0],
                            claimData,
                            false,
                            "InvalidSignature"
                        );
        
                        // Multiple information
                        claimData = [
                            generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                            generateClaimInfo(Wallet.createRandom(), registeredDID.address, CLAIM_2),
                        ]
                        await checkClaimXPReward(
                            registeredDID,
                            receiverAddress[0],
                            claimData,
                            false,
                            "InvalidSignature"
                        );
                    }
                })
            })           
        })

        describe("Failed : Duplicated request", () => {
            describe("Duplicated `typeId` in the same month", () => {
                const test_cases = [CLAIM_GAMER31, CLAIM_GAMER31_UniqueID];

                it("Same claim informations signed by different trusted signers", async () => {
                    for (let i = 0; i < test_cases.length; i++) {
                        await claimAvailableState.restore();

                        const [CLAIM_1] = await updateProofIssueTime([test_cases[i]]);
                        let claimData = [
                            generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                            generateClaimInfo(trustedSigners[1], registeredDID.address, CLAIM_1),
                        ]
                        await checkClaimXPReward(
                            registeredDID,
                            receiverAddress[0],
                            claimData,
                            false,
                            "DuplicatedRequest"
                        );
                    }
                })

                it("Different claim informations with same `typeId`", async () => {
                    for (let i = 0; i < test_cases.length; i++) {
                        await claimAvailableState.restore();

                        const [ CLAIM_1 ] = await updateProofIssueTime([test_cases[i]]);
                                
                        // Different claim information
                        const CLAIM_2: ClaimData = {...CLAIM_1};
                        CLAIM_2.xp = CLAIM_1.xp + 10;
                        const claimData = [
                            generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                            generateClaimInfo(trustedSigners[1], registeredDID.address, CLAIM_2),
                        ]
                        await checkClaimXPReward(
                            registeredDID,
                            receiverAddress[0],
                            claimData,
                            false,
                            "DuplicatedRequest"
                        );
                    }
                })

                it("Same `typeId` with different `uniqueId`", async () => {
                    await claimAvailableState.restore();
                    
                    const [CLAIM_1, CLAIM_2] = await updateProofIssueTime([CLAIM_GAMER31, CLAIM_GAMER31_UniqueID]);
    
                    let claimData = [
                        generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                        generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_2),
                    ]
                    await checkClaimXPReward(
                        registeredDID,
                        receiverAddress[0],
                        claimData,
                        false,
                        "DuplicatedRequest"
                    );
                })
            })
            
            describe("Duplicated `signature` in the same month", () => {
                it("Reverted", async () => {
                    // Test with and without uniqueId
                    const test_cases = [CLAIM_GAMER31, CLAIM_GAMER31_UniqueID];
                    for (let i = 0; i < test_cases.length; i++) {
                        await claimAvailableState.restore();
                        
                        const [CLAIM_1] = await updateProofIssueTime([test_cases[i]]);
            
                        let claimData = [
                            generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                            generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                        ]
                        await checkClaimXPReward(
                            registeredDID,
                            receiverAddress[0],
                            claimData,
                            false,
                            "DuplicatedRequest"
                        );
                    }
                })
            })
        })

        describe("Failed : Duplicated uniqueId", () => {
            it("Reverted successfully", async () => {
                await claimAvailableState.restore();
                // Claim successfully for one uniqueId
                const [ CLAIM_1 ] = await updateProofIssueTime([CLAIM_GAMER31_UniqueID]);
                let claimData = [ generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),]
                await checkClaimXPReward(
                    registeredDID,
                    receiverAddress[0],
                    claimData,
                    true,
                );
    
                // Increase time to next month
                const blockTime = new Date((await time.latest()) * 1000);
                blockTime.setMonth(blockTime.getMonth() + 1);
                await time.increaseTo(blockTime.getTime() / 1000);

                const [issueYear, issueMonth] = await getProofIssueTime();
                CLAIM_1.issueYear = issueYear;
                CLAIM_1.issueMonth = issueMonth;
                CLAIM_1.xp = CLAIM_1.xp + 10;
                claimData = [ generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),]
                await checkClaimXPReward(
                    registeredDID,
                    receiverAddress[0],
                    claimData,
                    false,
                    "DuplicatedUniqueId"
                );            
            })
        })

        describe("Failed : Insufficient token amount", async () => {
            it("Reverted successfully", async () => {
                await claimAvailableState.restore();
    
                const rewardAmount = 200; //VDA token
                const rewardXP = rewardAmount / RATE_VALUE;

                const [ CLAIM_1 ] = await updateProofIssueTime([CLAIM_GAMER31]);
                CLAIM_1.xp = rewardXP;
    
                expect(await token.balanceOf(contract.address)).to.be.eq(0);
    
                const claimData = [
                    generateClaimInfo(trustedSigners[0], registeredDID.address, CLAIM_1),
                ]
                await checkClaimXPReward(
                    registeredDID,
                    receiverAddress[0],
                    claimData,
                    false,
                    "InsufficientTokenAmount"
                );
            })  
        })

        describe("Claimed successfully", () => {
            /**
             * Check for the success of `claimXPReward()` function
             * This updates the `issueYear` and `issueMonth` of claim information to the valid values - 1 monthe before of the current blockchain time
             * @param claimInfos Array of claim information that doesn't include `signature` and `proof`
             * @param rewardXPs Targeing XP values for each calim information
             */
            const checkClaimSuccess = async (claimInfos: ClaimData[], rewardXPs: number[]) => {
                const claimData = [];
                const [issueYear, issueMonth] = await getProofIssueTime();

                let totalRewardAmount = 0;

                for (let i = 0; i < rewardXPs.length; i++) {
                    const rewardAmount = rewardXPs[i] * RATE_VALUE;
                    totalRewardAmount += rewardAmount;

                    const claimInfo: ClaimData = {...claimInfos[i]};
                    claimInfo.issueYear = issueYear;
                    claimInfo.issueMonth = issueMonth;
                    claimInfo.xp = rewardXPs[i];

                    claimData.push(
                        generateClaimInfo(trustedSigners[0], registeredDID.address, claimInfo)
                    );
                }

                // Deposit token to the `XPReward` contract
                await token.connect(veridaWallet).transfer(contract.address, totalRewardAmount);

                const orgBalance = await token.balanceOf(receiverAddress[0]);
                
                await checkClaimXPReward(
                    registeredDID,
                    receiverAddress[0],
                    claimData,
                    true,
                );

                expect(
                    await token.balanceOf(receiverAddress[0])
                ).to.be.eq(orgBalance.add(totalRewardAmount));
            }

            it("Claim without `uniqueId`", async () => {
                await claimAvailableState.restore();
                const rewardXPs = [200000000, 100000000];
                const claim_infos = [CLAIM_GAMER31, CLAIM_ZKPASS];

                await checkClaimSuccess(claim_infos, rewardXPs);
            })

            it("Claim for same `uniqueId` in the same month", async () => {
                await claimAvailableState.restore();
                const rewardXPs = [200000000, 100000000];
                const claim_infos = [
                    CLAIM_GAMER31_UniqueID,
                {...CLAIM_GAMER31_UniqueID}
                ];
                claim_infos[1].typeId = `${claim_infos[1].typeId}-1`

                await checkClaimSuccess(claim_infos, rewardXPs);
            })

            it("Claim for different `uniqueId` in the same month", async () => {
                await claimAvailableState.restore();
                const rewardXPs = [200000000, 100000000];
                const claim_infos = [
                    CLAIM_GAMER31_UniqueID,
                {...CLAIM_GAMER31_UniqueID}
                ];
                claim_infos[1].typeId = `${claim_infos[1].typeId}-1`
                claim_infos[1].uniqueId = `${claim_infos[1].uniqueId}-1`;

                await checkClaimSuccess(claim_infos, rewardXPs);
            })

            it("Claim for same data in the next month", async () => {
                await claimAvailableState.restore();
                
                const rewardXPs = [200000000, 100000000];
                const claim_infos = [CLAIM_GAMER31, CLAIM_ZKPASS];
                await checkClaimSuccess(claim_infos, rewardXPs);

                // Increase block time to next month
                const blockTime = new Date((await time.latest()) * 1000);
                blockTime.setMonth(blockTime.getMonth() + 1);
                await time.increaseTo(blockTime.getTime() / 1000);

                await checkClaimSuccess(claim_infos, rewardXPs);
            })

            it("Claim in January", async () => {
                await claimAvailableState.restore();

                const blockTime = new Date((await time.latest()) * 1000);

                // Set Blockchain time to the next Jan
                blockTime.setFullYear(blockTime.getFullYear() + 1);
                blockTime.setMonth(0);
                await time.increaseTo(blockTime.getTime() / 1000);

                const rewardXPs = [200000000, 100000000];
                const claim_infos = [CLAIM_GAMER31, CLAIM_ZKPASS];
                await checkClaimSuccess(claim_infos, rewardXPs);
            })
        })
    })

    describe("Withdraw", () => {
        const DEPOSIT_AMOUNT = 100;
        const recipient = Wallet.createRandom().address;

        before(async () => {
            // Deposit token to contract
            await token.connect(veridaWallet).transfer(contract.address, DEPOSIT_AMOUNT);
        })

        it("Failed : Non-owner", async () => {
            const extBalance = await token.balanceOf(contract.address);
            await expect(
                contract.connect(user).withdraw(recipient, extBalance)
            ).to.be.rejectedWith("Ownable: caller is not the owner");
        })

        it("Withdraw successfully", async () => {
            expect(await token.balanceOf(recipient)).to.be.eq(0);

            const extBalance = await token.balanceOf(contract.address);
            await contract.withdraw(recipient, extBalance);

            expect(await token.balanceOf(recipient)).to.be.eq(extBalance);
        })
    })


})