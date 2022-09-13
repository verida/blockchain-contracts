import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Wallet } from "ethers";

import hre, { ethers , upgrades } from "hardhat"
import { RewardToken } from "../typechain-types";

chai.use(chaiAsPromised);

let accountList: SignerWithAddress[];
let owner: SignerWithAddress;

describe("VeridaRewardToken", () => {
    let contract: RewardToken
    const contractAddress = Wallet.createRandom().address

    before(async () => {
        accountList = await ethers.getSigners();
        owner = accountList[0];

        const contractFactory = await ethers.getContractFactory("RewardToken")
        contract = (await upgrades.deployProxy(
            contractFactory,
            [contractAddress],
            {
                initializer: '__RewardToken_init'
            }
        )) as RewardToken
        await contract.deployed()
    })

    it ('Check balance of Contract', async () => {
        const balance = await contract.balanceOf(contractAddress)
        const decimal = await contract.decimals()
        const bal = ethers.utils.formatUnits(balance.toString(), decimal)

        console.log('Mint amount: ', bal)
    })

    describe('Min test', () => {
        const testAccount = Wallet.createRandom();
        const mintAmount = ethers.utils.parseEther("3");
        it('Mint failed from non-owner address', async () => {
            await expect(contract.connect(accountList[1]).mint(testAccount.address, mintAmount)).to.rejectedWith("Ownable: caller is not the owner")
        })

        it('Mint failed by max supply limit', async () => {
            const maxSupply = ethers.utils.parseEther('10000001')
            await expect(contract.mint(testAccount.address, maxSupply)).to.rejectedWith("Amount overflow max supply")
        })

        it('Mint success by owner',async () => {
            const orgBalance = await contract.balanceOf(testAccount.address)
            await contract.connect(owner).mint(testAccount.address, mintAmount)
            expect(await contract.balanceOf(testAccount.address)).to.equal(orgBalance.add(mintAmount))
        })
    })

    describe('Transfer test', () => {
        const mintAmount = ethers.utils.parseEther('100')
        const firstTrnasferAmount = ethers.utils.parseEther('15')
        const chainedTrnasferAmount = ethers.utils.parseEther('5')
        let testAccount : SignerWithAddress[] 
        before(async () => {
            testAccount = [accountList[1], accountList[2], accountList[3]]
            await contract.mint(testAccount[0].address, mintAmount)
        })

        it('Transfer success from minted account', async () => {
            const orgBalance = await contract.balanceOf(testAccount[0].address)
            expect(await contract.balanceOf(testAccount[1].address)).to.equal(BigNumber.from(0))

            await contract.connect(testAccount[0]).transfer(testAccount[1].address, firstTrnasferAmount)

            expect(await contract.balanceOf(testAccount[1].address)).to.equal(firstTrnasferAmount)
            expect(await contract.balanceOf(testAccount[0].address)).to.equal(orgBalance.sub(firstTrnasferAmount))
        })

        it('Transfer success from received account', async () => {
            const orgBalance = await contract.balanceOf(testAccount[1].address)
            expect(await contract.balanceOf(testAccount[2].address)).to.equal(BigNumber.from(0))

            await contract.connect(testAccount[1]).transfer(testAccount[2].address, chainedTrnasferAmount)

            expect(await contract.balanceOf(testAccount[2].address)).to.equal(chainedTrnasferAmount)
            expect(await contract.balanceOf(testAccount[1].address)).to.equal(orgBalance.sub(chainedTrnasferAmount))
        })
    })
})