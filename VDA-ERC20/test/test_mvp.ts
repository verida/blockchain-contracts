/* eslint-disable camelcase */
/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import hre, { ethers, upgrades } from "hardhat";

import { VeridaToken } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "@ethersproject/bignumber";

let accountList: SignerWithAddress[];
let owner: SignerWithAddress;
let receiver: SignerWithAddress;

const hardhatReset = async () => {
    await hre.network.provider.send("hardhat_reset");
    
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [],
    });
}

describe("MVP-Verida Test", () => {
    let vda: VeridaToken;
    let MAX_SUPPLY : BigNumber;
    let RATE_DENOMINATOR : number;

    const deployContract = async () => {
        const vdaFactory = await ethers.getContractFactory("VeridaToken");
        vda = (await upgrades.deployProxy(vdaFactory, {
            initializer: "initialize",
        })) as VeridaToken;

        await vda.deployed();
    }

    before(async () => {
        
        await hardhatReset()

        accountList = await ethers.getSigners();
        owner = accountList[0];
        receiver = accountList[1];
        // for (let i = 0; i < accountList.length; i++)
        //     console.log("## ", accountList[i].address);

        await deployContract()
        MAX_SUPPLY = await vda.MAX_SUPPLY();
        RATE_DENOMINATOR = await vda.RATE_DENOMINATOR();
    });

    describe("Mint & burn", () => {
        before(async () => {
            await deployContract()
        })

        it("Should mint & burn from contract owner", async () => {
            const owner = accountList[0]

            // Mint
            expect((await vda.balanceOf(owner.address)).toNumber()).to.be.equal(0)
            await vda.mint(owner.address, 100)
            expect((await vda.balanceOf(owner.address)).toNumber()).to.be.equal(100)

            // Burn
            await vda.burn(100)
            expect((await vda.balanceOf(owner.address)).toNumber()).to.be.equal(0)
        })

        it("Add & revoke minter", async () => {
            const minter = accountList[1]

            await expect(
                vda.connect(minter).mint(minter.address, 100)
            ).to.be.rejectedWith("Not a minter")

            // Add a minter
            await vda.addMinter(minter.address)

            // Mint from new minter
            expect(await vda.balanceOf(minter.address)).to.be.eq(0)
            await vda.connect(minter).mint(minter.address, 100)
            expect(await vda.balanceOf(minter.address)).to.be.eq(100)

            // Burn
            await vda.connect(minter).burn(100)

            // Revoke a minter
            await vda.revokeMinter(minter.address)
        })

        it("Transfer ownership", async () => {
            const oldOwner = accountList[0]
            const newOwner = accountList[1]
            const minter = accountList[2]

            // Transfer ownership
            await vda.transferOwnership(newOwner.address)

            // Old owner has no permission to mint
            await expect(
                vda.connect(oldOwner).mint(oldOwner.address, 100)
            ).to.be.rejectedWith("Not a minter")

            // Old owner has no permission to add/revoke minters
            await expect(
                vda.connect(oldOwner).addMinter(minter.address)
            ).to.be.rejectedWith()
            
            // New owner has permission to mint
            expect(await vda.balanceOf(newOwner.address)).to.be.eq(0)
            await vda.connect(newOwner).mint(newOwner.address, 100)
            expect(await vda.balanceOf(newOwner.address)).to.be.eq(100)

            await vda.connect(newOwner).burn(100)
            expect(await vda.balanceOf(newOwner.address)).to.be.eq(0)
            
            // New owenr has permission to add a minter
            await expect(
                vda.connect(minter).mint(minter.address, 100)
            ).to.be.rejectedWith("Not a minter")
            await vda.connect(newOwner).addMinter(minter.address)
            
            // Mint from new minter
            expect(await vda.balanceOf(minter.address)).to.be.eq(0)
            await vda.connect(minter).mint(minter.address, 100)
            expect(await vda.balanceOf(minter.address)).to.be.eq(100)

            await vda.connect(minter).burn(100)
            expect(await vda.balanceOf(minter.address)).to.be.eq(0)

            // New owner has permission to revoke a minter
            await vda.connect(newOwner).revokeMinter(minter.address)
            await expect(
                vda.connect(minter).mint(minter.address, 100)
            ).to.be.rejectedWith("Not a minter")
        })

        it("Renounce ownership", async () => {
            await hardhatReset()
            await deployContract()

            const oldOwner = accountList[0]
            const minter = accountList[2]

            // Renounce ownership
            await vda.renounceOwnership()

            // Old owner has no permission to mint
            await expect(
                vda.connect(oldOwner).mint(oldOwner.address, 100)
            ).to.be.rejectedWith("Not a minter")

            // Old owner has no permission to add/revoke minters
            await expect(
                vda.connect(oldOwner).addMinter(minter.address)
            ).to.be.rejectedWith()
        })
    })

    describe("Token Transfer", () => {
        let receiver : SignerWithAddress

        before(async () => {
            await deployContract()

            receiver = accountList[1]
            vda.mint(owner.address, 500)
        })

        it("Should reject token transfer before transfer enabled", async () => {
            await expect(
                vda.transfer(receiver.address, 100)
            ).to.be.rejectedWith("Token transfer not allowed")
        })

        it("Transfer success after transfer enabled", async () => {
            await vda.enableTransfer()

            const orgAmount = (await vda.balanceOf(receiver.address)).toNumber()
            vda.transfer(receiver.address, 100)
            const newAmount = (await vda.balanceOf(receiver.address)).toNumber()

            expect(newAmount).to.be.eq(orgAmount + 100)
        })
    })

    describe("Tests after token transfer enabled", () => {
        beforeEach(async () => {
            await deployContract()
            await vda.enableTransfer()
        })

        describe("Minter Test",  () => {
            let owner: SignerWithAddress,
            testAccount: SignerWithAddress,
            testMinter: SignerWithAddress;
    
            before(async () => {
                owner = accountList[0];
                testAccount = accountList[1];
                testMinter = accountList[2];
            });
    
            it("addMinter", async () => {
                // Ownable Testexpect(await vda.getMinterCount()).to.be.eq(2);
                await expect(
                    vda.connect(testAccount).addMinter(testMinter.address)
                ).to.be.rejectedWith("Ownable: caller is not the owner");
                // Already granted
                await expect(vda.addMinter(owner.address)).to.be.rejectedWith(
                    "Already granted"
                );
    
                await vda.addMinter(testMinter.address);
                await expect(vda.addMinter(testMinter.address)).to.be.rejectedWith(
                    "Already granted"
                );
            });
    
            it("revokeMinter", async () => {
                await vda.addMinter(testMinter.address);
    
                await vda.revokeMinter(testMinter.address);
                await expect(vda.revokeMinter(testMinter.address)).to.be.rejectedWith(
                    "No minter"
                );
            });
    
            it("getMinterCount", async () => {
                expect(await vda.getMinterCount()).to.be.eq(1);
    
                await vda.addMinter(testAccount.address);
                expect(await vda.getMinterCount()).to.be.eq(2);
    
                await vda.addMinter(testMinter.address);
                expect(await vda.getMinterCount()).to.be.eq(3);
    
                await vda.revokeMinter(testAccount.address);
                await vda.revokeMinter(testMinter.address);
    
                expect(await vda.getMinterCount()).to.be.eq(1);
            });
    
            it("getMinterList", async () => {
                const orgListLen = (await vda.getMinterCount()).toNumber()
    
                await vda.addMinter(testMinter.address);
                await vda.addMinter(testAccount.address);
    
                expect(await vda.getMinterCount()).to.be.eq(orgListLen + 2)
            });
        });
    
        describe("MaxAmountPerWallet", function(){
    
            describe("Update max amount per wallet", () => {
                it("Rejected by Amount Rate Limit", async () => {
                    await expect(
                        vda.updateMaxAmountPerWalletRate(31 * RATE_DENOMINATOR)
                    ).to.be.rejectedWith("Invalid rate");
                });
    
                it("Rejected when setting 0 rate", async () => {
                    await expect(
                        vda.updateMaxAmountPerWalletRate(0)
                    ).to.be.rejectedWith("Invalid rate");
                });
    
                it("Updated correctly", async () => {
                    await vda.updateMaxAmountPerWalletRate(25 * RATE_DENOMINATOR);
                    
                });
            });
    
            describe("Enable max amount per wallet", () => {
                const MAX_AMOUNT_PER_WALLET_RATE = 25; // 25%
    
                beforeEach(async () => {
                    await vda.updateMaxAmountPerWalletRate(MAX_AMOUNT_PER_WALLET_RATE * RATE_DENOMINATOR);
                    await vda.mint(owner.address, MAX_SUPPLY);
                })
    
                it("When maxAmountPerWallet disabled, successfully send over MAX_AMOUNT_PER_WALLT", async () => {
                    // Check maxAmountPerWallet enabled status
                    expect(await vda.isMaxAmountPerWalletEnabled()).to.be.eq(false);
    
                    // Check balance before receive
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                    // Send over MAX_AMOUNT_PER_WALLET
                    const amount_40 = MAX_SUPPLY.mul(40).div(100);
                    await vda.transfer(receiver.address, amount_40);
    
                    // Check out balance after receive
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_40);
                })
    
                it("When maxAmountPerWallet enabled, failed to send over MAX_AMOUNT_PER_WALLET - Single Transaction", async () => {
                    // Enable maxAmountPerWallet
                    await vda.enableMaxAmountPerWallet(true);
    
                    // Check receiver balance before transaction
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                    // Send 40% when maxAmountPerWallet rate is 25%
                    const amount_40 = MAX_SUPPLY.mul(40).div(100);
                    await expect(vda.transfer(receiver.address, amount_40)).to.be.rejectedWith("Receiver amount limit");
    
                    // Check receiver balance
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                    // Send 25.1% when maxAmountPerWallet rate is 25%
                    const amount_25_1 = MAX_SUPPLY.mul(251).div(1000);
                    await expect(vda.transfer(receiver.address, amount_25_1)).to.be.rejectedWith("Receiver amount limit");
    
                    // Check receiver balance
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
                })
    
                it("When maxAmountPerWallet enabled, failed to send over MAX_AMOUNT_PER_WALLET - Multiple transaction", async () => {
                    // Enable maxAmountPerWallet
                    await vda.enableMaxAmountPerWallet(true);
    
                    // Check receiver balance before transaction
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                    // Send 10% success
                    const amount_10 = MAX_SUPPLY.mul(10).div(100);
                    await vda.transfer(receiver.address, amount_10);
                    // Check receiver balance
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_10);
    
                    // Send 14% success
                    const amount_14 = MAX_SUPPLY.mul(14).div(100);
                    await vda.transfer(receiver.address, amount_14);
                    // Check receiver balance
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_10.add(amount_14));
    
                    // Send 2% will be failed, max amount per wallet is 25%
                    const amount_2 = MAX_SUPPLY.mul(2).div(100);
                    await expect(vda.transfer(receiver.address, amount_2)).to.be.rejectedWith("Receiver amount limit");
    
                    // Check receiver balance
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_10.add(amount_14));
                })
    
                it("When maxAmountPerWallet enabled, send successfully", async () => {
                    // Enable maxAmountPerWallet
                    await vda.enableMaxAmountPerWallet(true);
    
                    // Check receiver balance before transaction
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                    // Send 25% when maxAmountPerWallet rate is 25%
                    const amount_25 = MAX_SUPPLY.mul(25).div(100);
                    await vda.transfer(receiver.address, amount_25);
    
                    // Check receiver balance
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_25);
                })
            })
        });
    
        describe("MaxAmountPerSell", () => {
            describe("Update max amount per sell", () => {
                it("Rejected by Amount Rate Limit", async () => {
                    await expect(
                        vda.updateMaxAmountPerSellRate(31 * RATE_DENOMINATOR)
                    ).to.be.rejectedWith("Invalid rate");
                });
    
                it("Rejected when setting 0 rate", async () => {
                    await expect(
                        vda.updateMaxAmountPerSellRate(0)
                    ).to.be.rejectedWith("Invalid rate");
                });
    
                it("Updated correctly", async () => {
                    await vda.updateMaxAmountPerWalletRate(25 * RATE_DENOMINATOR);
                    
                });
            });
    
            describe("Enable max amount per sell", () => {
                let mockPoolAccount : SignerWithAddress;
                let sellerAccount : SignerWithAddress;
    
                const OWNER_MINTED_RATE = 30; // 30% of MAX_SUPPLY
                const SELLER_MINTED_RATE = 20; // 20% of MAX_SUPPLY
    
                const MAX_AMOUNT_PER_SELL = 100; // 100 / RATE_DENOMINATOR = 0.1 %
    
                before(async () => {
                    mockPoolAccount = accountList[3];
                    sellerAccount = accountList[2];
                });
    
                beforeEach(async () => {
                    await vda.mint(owner.address, MAX_SUPPLY.mul(OWNER_MINTED_RATE).div(100));
                    await vda.mint(sellerAccount.address, MAX_SUPPLY.mul(SELLER_MINTED_RATE).div(100));
    
                    // Set mock pool address for sell test
                    await vda.setAutomatedMarketMakerPair(mockPoolAccount.address, true);
                });
    
                it("When maxAmountPerSell disabled, successfully send over max sell amount to mock pool account", async () => {
                    // check current maxAmountPerSellRate
                    expect(await vda.maxAmountPerSellRate()).to.be.eq(100); // 0.1%
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(0);
    
                    // Send 10 % of MAX_SUPPLY
                    const amount_10 = MAX_SUPPLY.mul(10).div(100);
                    await vda.connect(sellerAccount).transfer(mockPoolAccount.address, amount_10);
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(amount_10);
                });
    
                it("When maxAmountPerSell enabled, failed to send over limit", async () => {
                    // Enable max amount per sell
                    await vda.enableMaxAmountPerSell(true);
    
                    // check current maxAmountPerSellRate
                    expect(await vda.maxAmountPerSellRate()).to.be.eq(100); // 0.1%
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(0);
    
                    // Send 10 % of MAX_SUPPLY, Failed
                    const amount_10 = MAX_SUPPLY.mul(10).div(100);
                    await expect(vda.connect(sellerAccount).transfer(mockPoolAccount.address, amount_10)).to.be.rejectedWith("Sell amount exceeds limit");
    
                    // Send 0.11 % of MAX_SUPPLY when max sell rate is 0.1%, Failed
                    const amount_0_11 = MAX_SUPPLY.mul(11).div(100).div(100);
                    await expect(vda.connect(sellerAccount).transfer(mockPoolAccount.address, amount_0_11)).to.be.rejectedWith("Sell amount exceeds limit");
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(0);
                })
    
                it("When maxAmountPerSell enabled, successfully sell", async () => {
                    // Enable max amount per sell
                    await vda.enableMaxAmountPerSell(true);
    
                    // check current maxAmountPerSellRate
                    expect(await vda.maxAmountPerSellRate()).to.be.eq(100); // 0.1%
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(0);
    
                    // Sell 0.1 % of MAX_SUPPLY, limit is 0.1%
                    const amount_0_1 = MAX_SUPPLY.mul(100).div(1000).div(100);
                    await vda.connect(sellerAccount).transfer(
                        mockPoolAccount.address, 
                        amount_0_1);
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(amount_0_1);
    
                    // Send 0.05% of MAX_SUPPLY, limit is 0.1%
                    const amount_0_05 = MAX_SUPPLY.mul(50).div(1000).div(100);
                    await vda.connect(sellerAccount).transfer(
                        mockPoolAccount.address, 
                        amount_0_05);
    
                    // Check Pool balance
                    expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(amount_0_1.add(amount_0_05));
                })
    
                it("When maxAmountPerSell enabled, general transfer success with no limit", async () => {           
                    // Enable max amount per sell
                    await vda.enableMaxAmountPerSell(true);
    
                    // check current maxAmountPerSellRate
                    expect(await vda.maxAmountPerSellRate()).to.be.eq(100); // 0.1%
    
                    // check balance before send
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                    // Send 10% of MAX_SUPPLY, limit is 0.1%
                    const amount_10 = MAX_SUPPLY.mul(10).div(100);
                    await vda.transfer(receiver.address, amount_10);
    
                    // check balance before send
                    expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_10);
                })
            })
        })
    
        describe("Exclude from max wallet amount limit", () => {
            const MAX_AMOUNT_PER_WALLET_RATE = 10; // 10%
            let testAccount : SignerWithAddress;
    
            beforeEach(async () => {
                testAccount = accountList[1];
                receiver = accountList[2];
    
                // enable MaxAmountPerWallet on each test
                await vda.enableMaxAmountPerWallet(true);
                await vda.updateMaxAmountPerWalletRate(MAX_AMOUNT_PER_WALLET_RATE * RATE_DENOMINATOR);
                
                const amount_40 = MAX_SUPPLY.mul(40).div(100);
                await vda.mint(testAccount.address, amount_40);
            })
    
            it("Before excluded from max wallet amount limit, user failed to receive over limit", async () => {
                // Check receiver is not excluded from wallet limit
                expect (await vda.isExcludedFromWalletAmountLimit(receiver.address)).to.be.eq(false);
    
                // Receiver can't receive over 10% of MAX_SUPPLY
                const amount_11 = MAX_SUPPLY.mul(11).div(100);
                await expect(vda.connect(testAccount).transfer(receiver.address, amount_11)).to.be.rejectedWith("Receiver amount limit");
            })
    
            it("After excluded from max wallet amount limit, can receive over limit", async () => {
                // Check receiver is not excluded from wallet limit
                expect (await vda.isExcludedFromWalletAmountLimit(receiver.address)).to.be.eq(false);
    
                // Exclude receiver from max amount wallet limit
                await vda.excludeFromWalletAmountLimit(receiver.address, true);
    
                // Check max amount wallet limit
                expect(await vda.maxAmountPerWalletRate()).to.be.eq(10 * RATE_DENOMINATOR);
    
                // Check balance of receiver before transaction
                expect(await vda.balanceOf(receiver.address)).to.be.eq(0);
    
                // Receiver accept 20% of amount while wallet limit is 10%
                const amount_20 = MAX_SUPPLY.mul(20).div(100);
                await vda.connect(testAccount).transfer(receiver.address, amount_20);
    
                // Check balance of receiver after transaction
                expect(await vda.balanceOf(receiver.address)).to.be.eq(amount_20);
            })
        })
    
        describe("Exclude from max sell amount limit", () => {
            const MAX_SELL_AMOUNT_RATE = 10; // 10 % for test
            let seller : SignerWithAddress;
            let receiver : SignerWithAddress;
            let mockPoolAccount : SignerWithAddress;
    
            beforeEach(async () => {
                seller = accountList[1];
                receiver = accountList[2];
                mockPoolAccount = accountList[3];
    
                // enable MaxAmountPerWallet on each test
                await vda.enableMaxAmountPerSell(true);
                await vda.updateMaxAmountPerSellRate(MAX_SELL_AMOUNT_RATE * RATE_DENOMINATOR);
    
                // set up mockPoolAccount as AutomatedMarketMaker
                await vda.setAutomatedMarketMakerPair(mockPoolAccount.address, true);
                
                // mint 40% of MAX_SUPPLY to the seller
                const amount_40 = MAX_SUPPLY.mul(40).div(100);
                await vda.mint(seller.address, amount_40);
            })
    
            it("Before excluded from max sell amount limit, seller failed to sell over sell limit", async () => {
                // Check Seller is not excluded from sell limit
                expect(await vda.isExcludedFromSellAmountLimit(seller.address)).to.be.eq(false);
    
                // Check sell limit is 10%
                expect(await vda.maxAmountPerSellRate()).to.be.eq(MAX_SELL_AMOUNT_RATE * RATE_DENOMINATOR);
    
                // check mockPoolAccount balance before transaction
                expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(0);
    
                // Seller can sell below limit, sell 5%
                const amount_5 = MAX_SUPPLY.mul(5).div(100);
                await vda.connect(seller).transfer(mockPoolAccount.address, amount_5);
    
                // check mockPoolAccount balance after transaction
                expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(amount_5);
    
                // Seller failed to sell over limit. Sell 20%
                const amount_20 = MAX_SUPPLY.mul(20).div(100);
                await expect(vda.connect(seller).transfer(mockPoolAccount.address, amount_20)).to.be.rejectedWith("Sell amount exceeds limit");
            })
    
            it("After excluded from max sell amount limit, seller call sell over limit", async () => {
                // Exclude seller from sell limit
                await vda.excludeFromSellAmountLimit(seller.address, true);
    
                // Check sell limit is 10%
                expect(await vda.maxAmountPerSellRate()).to.be.eq(MAX_SELL_AMOUNT_RATE * RATE_DENOMINATOR);
    
                // check mockPoolAccount balance before transaction
                expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(0);
    
                // Seller can sell over limit, sell 20%
                const amount_20 = MAX_SUPPLY.mul(20).div(100);
                await vda.connect(seller).transfer(mockPoolAccount.address, amount_20);
    
                // check mockPoolAccount balance after transaction
                expect(await vda.balanceOf(mockPoolAccount.address)).to.be.eq(amount_20);
            })
        })
    })
});
