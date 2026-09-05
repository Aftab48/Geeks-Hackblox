import { ethers, network } from "hardhat";
import { loadDeployment } from "./deployments";

/**
 * Grants REGISTRAR_ROLE to an address so it can appoint issuers of its own.
 * Admin only, and the tier above issuers: admin -> registrar -> issuer.
 *
 *   $env:REGISTRAR_ADDRESS="0x..."; $env:REGISTRAR_NAME="Faculty of Science"; npm run grant:registrar
 */
async function main() {
  const deployment = loadDeployment(network.name);
  const [admin] = await ethers.getSigners();

  const account = process.env.REGISTRAR_ADDRESS;
  if (!account || !ethers.isAddress(account)) {
    throw new Error("Set REGISTRAR_ADDRESS to a valid 0x address.");
  }
  const name = process.env.REGISTRAR_NAME || deployment.genesisIssuerName;

  const contract = await ethers.getContractAt(
    "SoulboundCertificate",
    deployment.address,
    admin
  );

  const adminRole = await contract.DEFAULT_ADMIN_ROLE();
  if (!(await contract.hasRole(adminRole, admin.address))) {
    throw new Error(`${admin.address} is not an admin on this contract.`);
  }

  if (await contract.isRegistrar(account)) {
    console.log(`${account} already has REGISTRAR_ROLE. Nothing to do.`);
    return;
  }

  console.log("Contract:", deployment.address);
  console.log("Admin   :", admin.address);
  console.log("Granting REGISTRAR_ROLE to", account, `as "${name}"`);

  const tx = await contract.addRegistrar(account, name);
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  // Same RPC lag as grantIssuer: a read straight after the write can land on
  // a node that is a block behind, so poll rather than report a false negative.
  for (let attempt = 1; attempt <= 10; attempt++) {
    if (await contract.isRegistrar(account)) {
      console.log("Granted. isRegistrar: true");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(
    "Transaction confirmed, but the role has not shown up in reads yet. " +
      "This is usually RPC lag. Check with: npm run check:role"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
