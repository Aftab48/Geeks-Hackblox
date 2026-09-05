import { ethers, network } from "hardhat";
import { loadDeployment } from "./deployments";

async function main() {
  const deployment = loadDeployment(network.name);
  const contract = await ethers.getContractAt(
    "SoulboundCertificate",
    deployment.address
  );

  const account = process.env.CHECK_ADDRESS;
  if (!account || !ethers.isAddress(account)) {
    throw new Error("Set CHECK_ADDRESS to a valid 0x address.");
  }

  const adminRole = await contract.DEFAULT_ADMIN_ROLE();
  const issuerRole = await contract.ISSUER_ROLE();

  console.log("Block   :", await ethers.provider.getBlockNumber());
  console.log("Contract:", deployment.address);
  console.log("Account :", account);
  console.log("");
  console.log("  isIssuer      :", await contract.isIssuer(account));
  console.log("  ISSUER_ROLE   :", await contract.hasRole(issuerRole, account));
  console.log("  DEFAULT_ADMIN :", await contract.hasRole(adminRole, account));
  console.log("  issuerName    :", JSON.stringify(await contract.issuerName(account)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
