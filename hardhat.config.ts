import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_SEPOLIA_RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
// Etherscan V2 uses one key across all chains. Accept either name so an
// existing BASESCAN_API_KEY keeps working.
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin 5.6 emits the mcopy opcode. Base (OP stack) has been
      // Cancun-enabled since Ecotone, so this is safe on Base Sepolia.
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  etherscan: {
    // A single string key makes hardhat-verify use the Etherscan V2 unified
    // API, which already knows Base Sepolia. Per-network key objects and
    // customChains are the V1 path, and V1 endpoints are shut down.
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
