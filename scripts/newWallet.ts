import { ethers } from "ethers";

// Generates a brand-new throwaway keypair for deploying to testnets.
// This wallet exists only for this hackathon. Never send it real funds.
const wallet = ethers.Wallet.createRandom();

console.log("\n=== NEW DEPLOYER WALLET ===\n");
console.log("Address     :", wallet.address);
console.log("Private key :", wallet.privateKey);
console.log("\nNext:");
console.log("  1. Paste the private key into .env as DEPLOYER_PRIVATE_KEY");
console.log("  2. Send Base Sepolia faucet funds to the address above");
console.log("\nTestnet only. Never fund this with real ETH.\n");
