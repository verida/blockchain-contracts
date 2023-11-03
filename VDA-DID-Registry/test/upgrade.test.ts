import { expect } from "chai";
import hre, { ethers , upgrades } from "hardhat"
import { VeridaDIDRegistryV2 } from "../typechain-types";

describe("Upgradeable test", () => {
    let proxyAddr: string;

    it("Deploy 1.0 version",async () => {
        const contractFactory =  await ethers.getContractFactory("VeridaDIDRegistry");
        const contract = await upgrades.deployProxy(
            contractFactory,
            {
                initializer: "initialize"
            }
        );
        await contract.deployed();

        proxyAddr = contract.address;
    })

    it("Upgrade to 2.0 version",async () => {
        const contractFactory = await ethers.getContractFactory("VeridaDIDRegistryV2");
        const contract = await upgrades.upgradeProxy(
            proxyAddr,
            contractFactory
        ) as VeridaDIDRegistryV2;
        await contract.deployed();

        expect(await contract.getVersion()).to.equal("2.0");

    })
})