import * as fs from "fs";

/**
 * Save deploied contract addresses for Upgradeable contract
 * @param proxyAddr Proxy contract address
 * @param diamondAddr Diamond contract address
 * @param tokenAddr Verida token address connected to the diamond
 */
export async function saveDeployedAddress(
  targetNet: string,
  diamondAddr: string,
  tokenAddr: string,
  facetsAddress: Record<string, string>
) {
  const dir = require('path').resolve(__dirname, '..');
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
    diamond: diamondAddr,
    tokenAddr: tokenAddr,
  };

  for (const [key, value] of Object.entries(facetsAddress)) {
    orgData[targetNet][key] = value;
  }

  fs.writeFileSync(filePath, JSON.stringify(orgData, undefined, 2));
}

export async function saveABI(
  abi: string,
) {
  const dir = require('path').resolve(__dirname, '..');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const filePath = dir + "/abi.json";

  let orgData: any = {};
  if (fs.existsSync(filePath)) {
    orgData = require(filePath);
    // console.log(orgData);
  }

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();

  orgData["contractName"] = "StorageNodeRegistry";
  orgData["abi"] = JSON.parse(abi);
  
  fs.writeFileSync(filePath, JSON.stringify(orgData, undefined, 2));
}

export async function saveDeployArgument(args: any[]) {
  const dir = require('path').resolve(__dirname, '..');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const filePath = dir + "/argument.js";

  const content = `module.exports = ${JSON.stringify(args)}`
  
  fs.writeFileSync(filePath, content);
}