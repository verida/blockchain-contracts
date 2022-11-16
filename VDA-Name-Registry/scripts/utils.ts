import * as fs from "fs";
import Axios from "axios";
import { ethers } from "hardhat";

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

export async function getMaticFee(isProd: boolean) {
  let maxFeePerGas = ethers.BigNumber.from(40000000000); // fallback to 40 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(40000000000); // fallback to 40 gwei
  const gasLimit = ethers.BigNumber.from(50000000000); // fallback to 50 gwei

  try {
    const { data } = await Axios({
      method: "get",
      url: isProd
        ? "https://gasstation-mainnet.matic.network/v2"
        : "https://gasstation-mumbai.matic.today/v2",
    });
    maxFeePerGas = ethers.utils.parseUnits(
      Math.ceil(data.fast.maxFee) + "",
      "gwei"
    );
    maxPriorityFeePerGas = ethers.utils.parseUnits(
      Math.ceil(data.fast.maxPriorityFee) + "",
      "gwei"
    );
  } catch {
    // ignore
    console.log("Error in get gasfee");
  }

  return { maxFeePerGas, maxPriorityFeePerGas, gasLimit };
}
