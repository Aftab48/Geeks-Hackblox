import { ethers, network } from "hardhat";

async function main() {
  const usingAlchemy = Boolean(process.env.BASE_SEPOLIA_RPC_URL);
  console.log("RPC:    ", usingAlchemy ? "custom (.env)" : "public sepolia.base.org");

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not set in .env");
  }

  const address = signers[0].address;
  const balance = await ethers.provider.getBalance(address);

  console.log("Network:", network.name);
  console.log("Address:", address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("\nNo funds yet. Paste the address above into a faucet.");
  } else {
    console.log("\nFunded. You're clear to deploy.");
  }

  console.log("Explorer: https://sepolia.basescan.org/address/" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
