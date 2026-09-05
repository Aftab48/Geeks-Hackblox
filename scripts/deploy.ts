import { ethers, network } from "hardhat";
import { saveDeployment, explorerUrl } from "./deployments";

const GENESIS_ISSUER_NAME =
  process.env.GENESIS_ISSUER_NAME || "HackBlox University";

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not set in .env");
  }

  const deployer = signers[0];
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Network :", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance :", ethers.formatEther(balance), "ETH");
  console.log("Issuer  :", GENESIS_ISSUER_NAME);

  if (balance === 0n && network.name !== "hardhat") {
    throw new Error(
      `Deployer has 0 ETH. Fund ${deployer.address} from a Base Sepolia faucet.`
    );
  }

  const contract = await ethers.deployContract("SoulboundCertificate", [
    GENESIS_ISSUER_NAME,
  ]);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const file = saveDeployment({
    network: network.name,
    address,
    genesisIssuerName: GENESIS_ISSUER_NAME,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  });

  console.log("\nSoulboundCertificate deployed to:", address);
  console.log("Recorded in:", file);

  if (network.name === "baseSepolia") {
    console.log("Explorer:", explorerUrl(network.name, address));
    console.log("\nNext:");
    console.log("  npm run verify   (needs BASESCAN_API_KEY in .env)");
    console.log("  npm run mint     (mints a demo certificate)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
