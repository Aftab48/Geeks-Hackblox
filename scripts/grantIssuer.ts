import { ethers, network } from "hardhat";
import { loadDeployment } from "./deployments";

/**
 * Grants ISSUER_ROLE to an address so it can mint from the dashboard.
 * Must be run by a registrar. The deployer is one; anyone else needs
 * npm run grant:registrar first.
 *
 *   $env:ISSUER_ADDRESS="0x..."; $env:ISSUER_NAME="Dept of Computer Science"; npm run grant:issuer
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

  // ISSUER_ROLE is administered by REGISTRAR_ROLE, so appointing an issuer
  // is a registrar's job. An admin that isn't also a registrar gets rejected
  // by the contract, which is the hierarchy working as intended.
  if (!(await contract.isRegistrar(admin.address))) {
    throw new Error(
      `${admin.address} is not a registrar on this contract. ` +
        "Run npm run grant:registrar from the admin wallet first."
    );
  }

  if (await contract.isIssuer(account)) {
    console.log(`${account} already has ISSUER_ROLE. Nothing to do.`);
    return;
  }

  console.log("Contract :", deployment.address);
  console.log("Registrar:", admin.address);
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
    "Transaction confirmed, but the role has not shown up in reads yet. " +
      "This is usually RPC lag. Check with: npm run check:role"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
