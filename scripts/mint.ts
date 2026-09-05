import { ethers, network } from "hardhat";
import { loadDeployment } from "./deployments";

async function main() {
  const deployment = loadDeployment(network.name);
  const [signer] = await ethers.getSigners();

  const contract = await ethers.getContractAt(
    "SoulboundCertificate",
    deployment.address,
    signer
  );

  const to = process.env.MINT_TO || signer.address;
  const recipientName = process.env.MINT_NAME || "Demo Student";
  const courseName = process.env.MINT_COURSE || "Web3 Development";
  // Phase 5 replaces this with a real pinned IPFS hash.
  const uri = process.env.MINT_URI || "ipfs://placeholder-metadata";

  if (!(await contract.isIssuer(signer.address))) {
    throw new Error(
      `${signer.address} is not a whitelisted issuer on this contract.`
    );
  }

  console.log("Contract :", deployment.address);
  console.log("Issuer   :", signer.address);
  console.log("Recipient:", to, `(${recipientName})`);
  console.log("Course   :", courseName);

  const tx = await contract.issueCertificate(to, recipientName, courseName, uri);
  console.log("\nTx sent:", tx.hash);
  const receipt = await tx.wait();

  const issued = receipt!.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "CertificateIssued");

  const tokenId = issued?.args.tokenId as bigint | undefined;
  console.log("Minted token ID:", tokenId?.toString() ?? "(check explorer)");

  if (network.name === "baseSepolia") {
    console.log(`\nHolder: https://sepolia.basescan.org/address/${to}`);
    console.log(`Tx    : https://sepolia.basescan.org/tx/${tx.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
