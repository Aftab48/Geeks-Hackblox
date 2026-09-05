import { run, network } from "hardhat";
import { loadDeployment } from "./deployments";

async function main() {
  if (!process.env.ETHERSCAN_API_KEY && !process.env.BASESCAN_API_KEY) {
    throw new Error(
      "No explorer API key set. Add ETHERSCAN_API_KEY to .env (Etherscan V2 " +
        "keys work across all chains, Base Sepolia included)."
    );
  }

  const deployment = loadDeployment(network.name);
  console.log("Verifying", deployment.address, "on", network.name);

  await run("verify:verify", {
    address: deployment.address,
    constructorArguments: [deployment.genesisIssuerName],
  });

  console.log(
    `\nSource: https://sepolia.basescan.org/address/${deployment.address}#code`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
