import hre from "hardhat";
import * as fs from "fs";
import { exec } from "child_process";

async function main() {
    const dir = __dirname;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    const filePath = dir + "/contract-address.json";


    let orgData: any = {};
    if (fs.existsSync(filePath)) {
        orgData = require(filePath);
        // console.log(orgData);
    }

    const network = hre.network.name;

    if (Object.keys(orgData[network]).length === 0) {
        throw new Error(`No contracts in ${network}`);
    }

    console.log("Verifying diamond contract")
    exec(`npx hardhat verify --${network} --constructor-args argument.js ${orgData[network]["diamond"]}`);

    // Verify facet contracts
    const keyArr = Object.keys(orgData[network]).filter((key: string) => key !== 'date' && key !== 'diamond');
    for (let i = 0; i < keyArr.length; i++) {
        const tokenName = keyArr[i];
        const tokenAddr = orgData[network][tokenName];
        console.log(`Verifying ${tokenName}`);
        exec(`npx hardhat verify --${network} ${tokenAddr}`);
    }
}  

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  