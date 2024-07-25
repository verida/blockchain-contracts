import { ethers, upgrades } from "hardhat";
import { SnapshotRestorer, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import { NameRegistryV2 } from "../typechain-types"
import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { VeridaToken } from "@verida/erc20-contract/typechain-types";
import { abi as TokenABI, bytecode as TokenByteCode } from "@verida/erc20-contract/artifacts/contracts/VDA-V1.sol/VeridaToken.json";

import { appDataNoDomain, appDataWithDomain, checkRegisterApp, getRegisterAppSignature, IAppMetaData, ZeroAddress } from "./utils";
import { BigNumber, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("NameRegistry V2 test", function (){
    let contract: NameRegistryV2;
    let token: VeridaToken;

    let tokenDeployedSnapshot: SnapshotRestorer;
    let appRegisteredStatus: SnapshotRestorer;

    const user = Wallet.createRandom();

    const REGISTERED_OWNER = "Owner";
    const REGISTERED_APP = "App";
    const APP_REGISTER_FEE = 500;

    let owner: SignerWithAddress;
    let account: SignerWithAddress;

    

    before(async () => {
        // Deploy NameRegistryV2 contract
        const contractFactory = await ethers.getContractFactory("NameRegistryV2");
        contract = (await upgrades.deployProxy(contractFactory, {
            "initializer": "initialize"
        })) as NameRegistryV2;

        // Deploy token
        const tokenFactory = await ethers.getContractFactory(TokenABI, TokenByteCode)
        token = await tokenFactory.deploy() as VeridaToken
        await token.deployed()
        await token.initialize();
        await token.enableTransfer();

        [ owner, account ] = await ethers.getSigners();

        // Mint token
        await token.mint(owner.address, 10000);

        tokenDeployedSnapshot = await takeSnapshot();
    })

    describe("App register fee", () => {
        describe("Get fee", () => {
            it("Get 0 when fee not set", async () => {
                expect(await contract.getAppRegisterFee()).to.be.eq(0);
            })
        })

        describe("Update app register fee", () => {
            it("Failed: Fee should be greater than 0", async () => {
                await expect(
                    contract.updateAppRegisterFee(0)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");
            })

            it("Success", async () => {
                await expect(
                    contract.updateAppRegisterFee(APP_REGISTER_FEE)
                ).to.emit(contract, "UpdateAppRegisterFee").withArgs(0, APP_REGISTER_FEE);
            })

            it("Failed: Updating to the current fee value", async () => {
                await expect(
                    contract.updateAppRegisterFee(APP_REGISTER_FEE)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");
            })
        })
    })

    describe("Token Address", () => {
        before(async () => {
            await tokenDeployedSnapshot.restore();
        })

        describe("Get Token address", () => {
            it("Get zero address when token address not set", async () => {
                expect(await contract.getTokenAddress()).to.be.equal(ZeroAddress);
            })
        })

        describe("Set token address", () => {
            it("Failed: Zero address", async () => {
                await expect(
                    contract.setTokenAddress(ZeroAddress)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");
            })

            it("Success", async () => {
                await expect(
                    contract.setTokenAddress(token.address)
                ).to.emit(contract, "SetTokenAddress").withArgs(
                    token.address
                );
            })

            it("Failed: Same token address", async () => {
                await expect(
                    contract.setTokenAddress(token.address)
                ).to.be.revertedWithCustomError(contract, "InvalidValue");
            })
        })
    })

    describe("Enabling App Register", () => {
        before(async () => {
            await tokenDeployedSnapshot.restore();
        })

        describe("Check app register eneabled", () => {
            it("App register disabled", async () => {
                expect(await contract.isAppRegisterEnabled()).to.be.eq(false);
            })
        })

        describe("Enable/disable app register", () => {
            it("Enable failed: token address not set", async () => {
                expect(await contract.getTokenAddress()).to.equal(ZeroAddress);

                await (expect(contract.setAppRegisterEnabled(true))).to.be.revertedWithCustomError(contract, "TokenAddressNotSet");
            })

            it("Enable Failed: Fee not set", async () => {
                await contract.setTokenAddress(token.address);

                expect(await contract.getAppRegisterFee()).to.be.eq(0);

                await (expect(contract.setAppRegisterEnabled(true))).to.be.revertedWithCustomError(contract, "AppRegisterFeeNotSet");
                
            })

            it("Enable success", async () => {
                await contract.updateAppRegisterFee(APP_REGISTER_FEE);

                await expect(
                    contract.setAppRegisterEnabled(true)
                ).to.emit(contract, "AppRegisterEnabled").withArgs(true);
            })

            it("Enable faild if enabled already", async () => {
                expect(await contract.isAppRegisterEnabled()).to.be.eq(true);

                // Failed for true value
                await (expect(contract.setAppRegisterEnabled(true))).to.be.revertedWithCustomError(contract, "InvalidValue");
            })

            it("Disable success", async () => {
                await expect(
                    contract.setAppRegisterEnabled(false)
                ).to.emit(contract, "AppRegisterEnabled").withArgs(false);
            })

            it("Disable failed if disabled already", async () => {
                expect(await contract.isAppRegisterEnabled()).to.be.eq(false);

                // Failed for true value
                await (expect(contract.setAppRegisterEnabled(false))).to.be.revertedWithCustomError(contract, "InvalidValue");
            })
        })
    })

    describe("Register App", () => {

        const registerApp = async () => {
            
            await token.approve(contract.address, APP_REGISTER_FEE);
            await checkRegisterApp(contract, owner, user, REGISTERED_OWNER, REGISTERED_APP, appDataWithDomain, true);

            appRegisteredStatus = await takeSnapshot();
        }

        before(async () => {
            await tokenDeployedSnapshot.restore();
        })

        describe("Failed: App register not enabled", () => {
            it("App register not enabled", async () => {
                await expect(
                    contract.registerApp(user.address, " ", " ", [], "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "AppRegisterNotEnabled");
            })
        })

        describe("Failed: Invalid owner name", () => {
            before(async () => {
                await contract.setTokenAddress(token.address);
                await contract.updateAppRegisterFee(APP_REGISTER_FEE);
                await contract.setAppRegisterEnabled(true);
            })

            it("Invalid characters in owner name", async () => {
                const invalidOwnerNames = [
                    "",     //Empty letters
                    "A@b",  //Invalid character
                    "A_b-", //Invalid character
                ];
    
                for (let i = 0; i < invalidOwnerNames.length; i++) {
                    await expect(
                        contract.registerApp(user.address, invalidOwnerNames[i], "", [], "0x", "0x")
                    ).to.be.revertedWithCustomError(contract, "InvalidOwnerName");
                }
            })

            it("DID has already owner name registered", async () => {
                await registerApp();

                await expect(
                    contract.registerApp(user.address, "ValidOwner", "", [], "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "InvalidOwnerName");
            })

            it("Duplicated owner name - owner name registered to another DID", async () => {
                await expect(
                    contract.registerApp(Wallet.createRandom().address, REGISTERED_OWNER, "", [], "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "DuplicatedOwnerName");
            })
        })

        describe("Failed: Invalid app name", () => {
            before(async () => {
                if (!appRegisteredStatus) {
                    await registerApp();
                } else {
                    await appRegisteredStatus.restore();
                }
            })

            it("Invalid characters in app name", async () => {
                const invalidName = [
                    "",     //Empty letters
                    "A@b",  //Invalid character
                    "A_b-", //Invalid character
                ];
    
                for (let i = 0; i < invalidName.length; i++) {
                    await expect(
                        contract.registerApp(user.address, REGISTERED_OWNER, invalidName[i], [], "0x", "0x")
                    ).to.be.revertedWithCustomError(contract, "InvalidAppName");
                }
            })

            it("Duplicated app name", async () => {
                await expect(
                    contract.registerApp(user.address, REGISTERED_OWNER, REGISTERED_APP, [], "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "DuplicatedAppName");
            })
        })

        describe("Failed: Domain name", () => {
            it("No `domain` in the meta data", async () => {
                // For registered owner
                await expect(
                    contract.registerApp(user.address, REGISTERED_OWNER, "NewApp", appDataNoDomain, "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "NoDomainInAppMetaData");

                // For non-registered owner
                await expect(
                    contract.registerApp(Wallet.createRandom().address, "NewOwner", "NewApp", appDataNoDomain, "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "NoDomainInAppMetaData");
            })

            it("Invalid domain name", async () => {
                const invalidDomainNames = [
                    "",     // Empty string
                    "A ",   // Space not allowed
                    "BB!!"  // Not allowed letters
                ];

                for (let i = 0; i < invalidDomainNames.length; i++) {
                    const item: IAppMetaData = {
                        key: "domain",
                        value: invalidDomainNames[i]
                    };

                    // For registered owner
                    await expect(
                        contract.registerApp(user.address, REGISTERED_OWNER, "NewApp", [item], "0x", "0x")
                    ).to.be.revertedWithCustomError(contract, "InvalidDomainName");

                    // For non-registered owner
                    await expect(
                        contract.registerApp(Wallet.createRandom().address, "NewOwner", "NewApp", [item], "0x", "0x")
                    ).to.be.revertedWithCustomError(contract, "InvalidDomainName");
                }
            })
        })

        describe("Failed: Invalid request signature", () => {
            it("Empty signature and proof", async () => {
                await expect(
                    contract.registerApp(Wallet.createRandom().address, "Owner1", "App1", appDataWithDomain, "0x", "0x")
                ).to.be.revertedWithCustomError(contract, "InvalidSignature");
            })

            it("Bad signer", async () => {
                const didWallet = Wallet.createRandom();
                const badSigner = Wallet.createRandom();
                const ownerName = "Owner1";
                const appName = "App1";
                const {requestSignature, requestProof} = await getRegisterAppSignature(contract, didWallet, ownerName, appName, appDataWithDomain, badSigner);

                await expect(
                    contract.registerApp(didWallet.address, ownerName, appName, appDataWithDomain, requestSignature, requestProof)
                ).to.be.revertedWithCustomError(contract, "InvalidSignature");
            })
        })

        describe("Failed: Fee", () => {
            let registerFee: BigNumber;
            const did = Wallet.createRandom();

            before(async () => {
                registerFee = await contract.getAppRegisterFee();
            })

            it("Token not approved by the provider", async () => {
                expect(await token.allowance(owner.address, contract.address)).to.be.eq(0);

                const {requestSignature, requestProof} = await getRegisterAppSignature(contract, did, "Owner1", "App1", appDataWithDomain);

                await expect(
                    contract.registerApp(did.address, "Owner1", "App1", appDataWithDomain, requestSignature, requestProof)
                ).to.be.rejectedWith("ERC20: insufficient allowance");

            })

            it("Insufficient token at the provider", async () => {
                await token.connect(account).approve(contract.address, registerFee);
                expect(await token.balanceOf(account.address)).to.be.lt(registerFee);

                const {requestSignature, requestProof} = await getRegisterAppSignature(contract, did, "Owner1", "App1", appDataWithDomain);

                await expect(
                    contract.connect(account).registerApp(did.address, "Owner1", "App1", appDataWithDomain, requestSignature, requestProof)
                ).to.be.rejectedWith("ERC20: transfer amount exceeds balance");
            })
        })

        describe("Success", () => {
            before(async () => {
                await appRegisteredStatus.restore();
            })

            it("Register multiple apps to one owner", async () => {
                const appCount = 3;
                await token.approve(contract.address, APP_REGISTER_FEE * appCount);
                for (let i = 0; i < appCount; i++) {
                    await checkRegisterApp(contract, owner, user, REGISTERED_OWNER, `App ${i+1}`, appDataWithDomain, true);
                }
            })

            it("Register same app name to different owners", async () => {
                await token.mint(account.address, APP_REGISTER_FEE);
                await token.connect(account).approve(contract.address, APP_REGISTER_FEE);

                const did = Wallet.createRandom();
                await checkRegisterApp(contract, account, did, "Owner2", REGISTERED_APP, appDataWithDomain, true);
            })
        })
    })

    describe("Get App", () => {
        before(async () => {
            await appRegisteredStatus.restore();
        })

        it("Failed: Unregistered owner name", async () => {
            await expect(
                contract.getApp("Owner1", "")
            ).to.be.revertedWithCustomError(contract, "InvalidOwnerName");
        })

        it("Failed: Unregistered app name", async () => {
            await expect(
                contract.getApp(REGISTERED_OWNER, "")
            ).to.be.revertedWithCustomError(contract, "InvalidAppName");
        })

        it("Success: Names case sensitive", async () => {
            // const app = await contract.getApp(REGISTERED_OWNER, REGISTERED_APP);
            // expect(
            //     app[0]
            // ).to.be.eq(user.address);

            expect(
                await contract.getApp(REGISTERED_OWNER, REGISTERED_APP)
            ).to.include(user.address);
        })

        it("Success: Names no case sensitive", async () => {
            expect(
                await contract.getApp(REGISTERED_OWNER.toLowerCase(), REGISTERED_APP.toUpperCase())
            ).to.include(user.address);
        })
    })

    describe("Update App", () => {
        const newItem: IAppMetaData = {
            key: "newItem",
            value: "newValue"
        }

        before(async () => {
            await appRegisteredStatus.restore();
        })

        it("Failed: DID not matched owner name", async () => {
            const did = Wallet.createRandom();
            const {requestSignature, requestProof} = await getRegisterAppSignature(contract, did, REGISTERED_OWNER, REGISTERED_APP, [newItem]);

            await expect(
                contract.updateApp(did.address, REGISTERED_OWNER, REGISTERED_APP, newItem, requestSignature, requestProof)
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(true, false);
        })

        it("Failed: Unregistered owner name", async () => {
            await expect(
                contract.updateApp(user.address, "Owner1", "", newItem, "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(true, false);
        })

        it("Failed: Unregistered app name", async () => {
            await expect(
                contract.updateApp(user.address, REGISTERED_OWNER, "", newItem, "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(false, true);
        })

        it("Failed: Invalid request signature & proof", async () => {
            await expect(
                contract.updateApp(user.address, REGISTERED_OWNER, REGISTERED_APP, newItem, "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "InvalidSignature");
        })
        
        it("Success: Add an item", async () => {
            const {requestSignature, requestProof} = await getRegisterAppSignature(contract, user, REGISTERED_OWNER, REGISTERED_APP, [newItem]);

            await expect(
                contract.updateApp(user.address, REGISTERED_OWNER, REGISTERED_APP, newItem, requestSignature, requestProof)
            ).to.emit(contract, "UpdateApp").withArgs(
                user.address, 
                REGISTERED_OWNER.toLowerCase(),
                REGISTERED_APP.toLowerCase(),
                anyValue
            );
        })

        it("Success: Update existing item", async () => {
            const updatingItem: IAppMetaData = {
                key: newItem.key,
                value: "value-1"
            }

            const {requestSignature, requestProof} = await getRegisterAppSignature(contract, user, REGISTERED_OWNER.toLowerCase(), REGISTERED_APP.toUpperCase(), [updatingItem]);

            await expect(
                contract.updateApp(user.address, REGISTERED_OWNER.toLowerCase(), REGISTERED_APP.toUpperCase(), updatingItem, requestSignature, requestProof)
            ).to.emit(contract, "UpdateApp").withArgs(
                user.address, 
                REGISTERED_OWNER.toLowerCase(),
                REGISTERED_APP.toLowerCase(),
                anyValue
            );
        })
    })

    describe("Deregister App", () => {
        const owner2 = "Owner2";
        const app2 = "App2";
        const user2 = Wallet.createRandom();

        before(async () => {
            await appRegisteredStatus.restore();

            await token.approve(contract.address, APP_REGISTER_FEE);
            await checkRegisterApp(contract, owner, user2, owner2, app2, appDataWithDomain);
        })

        it("Failed: DID not matched owner name", async () => {
            // Unregistered DID
            await expect(
                contract.deregisterApp(Wallet.createRandom().address, REGISTERED_OWNER, "", "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(true, false);

            // Registered DID and other's owner name
            await expect(
                contract.deregisterApp(user.address, owner2, "", "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(true, false);
        })

        it("Failed: Unregistered owner name", async () => {
            await expect(
                contract.deregisterApp(user.address, "Unknown", "", "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(true, false);
        })

        it("Failed: Unregistered app name", async () => {
            await expect(
                contract.deregisterApp(user.address, REGISTERED_OWNER, "", "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "AppNotFound").withArgs(false, true);
        })

        it("Failed: Invalid request signature and proof", async () => {
            await expect(
                contract.deregisterApp(user.address, REGISTERED_OWNER, REGISTERED_APP, "0x", "0x")
            ).to.be.revertedWithCustomError(contract, "InvalidSignature");
        })

        it("Success", async () => {
            const {requestSignature, requestProof} = await getRegisterAppSignature(contract, user, REGISTERED_OWNER, REGISTERED_APP, []);
            await expect(
                contract.deregisterApp(user.address, REGISTERED_OWNER, REGISTERED_APP, requestSignature, requestProof)
            ).to.emit(contract, "DeregisterApp").withArgs(
                user.address,
                REGISTERED_OWNER.toLowerCase(),
                REGISTERED_APP.toLowerCase()
            );

            // Confrim removed
            await expect(
                contract.getApp(REGISTERED_OWNER, REGISTERED_APP)
            ).to.be.revertedWithCustomError(contract, "InvalidOwnerName");
        })
    })
})