import { ethers, network } from "hardhat";
import { loadDeployment } from "./deployments";

/**
 * Grants ISSUER_ROLE to an address so it can mint from the dashboard.
 * Must be run by the contract admin (the deployer).
 *
 *   $env:ISSUER_ADDRESS="0x..."; $env:ISSUER_NAME="University Of Calcutta"; npm run grant:issuer
 */
async function main() {
  const deployment = loadDeployment(network.name);
  const [admin] = await ethers.getSigners();

  const account = process.env.ISSUER_ADDRESS;
  if (!account || !ethers.isAddress(account)) {
    throw new Error("Set ISSUER_ADDRESS to a valid 0x address.");
  }
  const name = process.env.ISSUER_NAME || deployment.genesisIssuerName;

  const contract = await ethers.getContractAt(
    "SoulboundCertificate",
    deployment.address,
    admin
  );

  const adminRole = await contract.DEFAULT_ADMIN_ROLE();
  if (!(await contract.hasRole(adminRole, admin.address))) {
    throw new Error(`${admin.address} is not an admin on this contract.`);
  }

  if (await contract.isIssuer(account)) {
    console.log(`${account} already has ISSUER_ROLE. Nothing to do.`);
    return;
  }

  console.log("Contract:", deployment.address);
  console.log("Admin   :", admin.address);
  console.log("Granting ISSUER_ROLE to", account, `as "${name}"`);

  const tx = await contract.addIssuer(account, name);
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  // Public RPCs load-balance across nodes, so a read immediately after a write
  // can land on one that has not caught up yet. Poll rather than report a
  // false negative.
  for (let attempt = 1; attempt <= 10; attempt++) {
    if (await contract.isIssuer(account)) {
      console.log("Granted. isIssuer: true");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(
    "Transaction confirmed, but the role has not shown up in reads yet.
" +
      "This is usually RPC lag. Check with: npm run check:role"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
