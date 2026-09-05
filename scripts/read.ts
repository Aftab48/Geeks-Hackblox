import { ethers, network } from "hardhat";
import { loadDeployment } from "./deployments";

async function main() {
  const deployment = loadDeployment(network.name);
  const contract = await ethers.getContractAt(
    "SoulboundCertificate",
    deployment.address
  );

  const holder = process.env.READ_ADDRESS || deployment.deployer;

  console.log("Contract    :", deployment.address);
  console.log("Total issued:", (await contract.totalIssued()).toString());
  console.log("Holder      :", holder);

  const certs = await contract.getCertificates(holder);
  if (certs.length === 0) {
    console.log("\nNo certificates held by this address.");
    return;
  }

  for (const cert of certs) {
    const issued = new Date(Number(cert.issuedAt) * 1000).toISOString();
    console.log("\n--- Certificate #" + cert.tokenId.toString() + " ---");
    console.log("  Recipient :", cert.recipientName);
    console.log("  Course    :", cert.courseName);
    console.log("  Issued    :", issued);
    console.log("  Issuer    :", cert.issuerName, "(" + cert.issuer + ")");
    console.log("  Status    :", cert.revoked ? "REVOKED" : "VALID");
    console.log("  Metadata  :", cert.uri);
    console.log("  Owner     :", await contract.ownerOf(cert.tokenId));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
