// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre, { ethers, upgrades } from "hardhat";
import * as fs from "fs";

async function saveDeployedAddress(
  proxyAddr: string,
  adminAddr: string,
  implAddress: string
) {
  const dir = __dirname;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.writeFileSync(
    dir + "/contract-address.json",
    JSON.stringify(
      {
        Proxy: proxyAddr,
        ProxyAdmin: adminAddr,
        Implementation: implAddress
      },
      undefined,
      2
    )
  );
}

async function main() {
  const contractFactory = await ethers.getContractFactory("NameRegistry");
  const contract = await upgrades.deployProxy(contractFactory, {
    initializer: "initialize",
    timeout: 0,
    pollingInterval: 5000,
  });

  await contract.deployed();

  const proxyAddr = contract.address;
  const adminAddr = await hre.upgrades.erc1967.getAdminAddress(proxyAddr);
  const implAddr = await hre.upgrades.erc1967.getImplementationAddress(
    proxyAddr
  );

  await saveDeployedAddress(proxyAddr, adminAddr, implAddr);
  console.log("NameRegistry deployed to: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Deployed Address
// 2022/10/24 : Version 0.2.0 - Mumbai
// 0x248eea8D67D844fa565490B4c4a37B02191F1C01
// BSC-Testnet
// 0x8d8a1f363ACf13e3117bB854F4dC105374C3BF7d