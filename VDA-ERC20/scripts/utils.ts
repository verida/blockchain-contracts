import * as fs from "fs";

/**
 * Save deploied contract addresses for Upgradeable contract
 * @param proxyAddr Proxy contract address
 * @param adminAddr Admin address
 * @param implAddress Implementation address
 */
export async function saveDeployedAddress(
  targetNet: string,
  proxyAddr: string,
  adminAddr: string,
  implAddress: string
) {
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

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();

  orgData[targetNet] = {
    date: `${yyyy}/${mm}/${dd}`,
    Proxy: proxyAddr,
    ProxyAdmin: adminAddr,
    Implementation: implAddress,
  };

  fs.writeFileSync(filePath, JSON.stringify(orgData, undefined, 2));
}