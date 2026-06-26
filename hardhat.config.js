import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

const L2_RPC_URL = process.env.L2_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "PASTE_YOUR_TESTNET_PRIVATE_KEY_HERE"
  ? [process.env.PRIVATE_KEY]
  : [];

const networks = {
  hardhat: {},
};

if (L2_RPC_URL && PRIVATE_KEY.length > 0) {
  networks.baseSepolia = {
    url: L2_RPC_URL,
    accounts: PRIVATE_KEY,
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: networks
};
