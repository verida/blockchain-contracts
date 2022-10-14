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
// BSC TestNet
// 0xD13E95913649c78c2d99591533a85a5ecf815e34
// 2022/5/6 12:54
// 0x1e48398CB21E4C228De595859598cdE12D1A0435

// 2022/6/3 16: Upgradeable contract
// 0x5c5CA3376b2C82f0322DB9dEE0504D2565080865
