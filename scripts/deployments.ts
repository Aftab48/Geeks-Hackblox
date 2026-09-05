import * as fs from "fs";
import * as path from "path";

export type DeploymentInfo = {
  network: string;
  address: string;
  genesisIssuerName: string;
  deployer: string;
  deployedAt: string;
  /** Block the contract landed in. The roll is rebuilt from logs, and this is
   *  where that scan starts; without it every read walks the whole chain. */
  block?: number;
};

const DIR = path.join(__dirname, "..", "deployments");

export function saveDeployment(info: DeploymentInfo): string {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${info.network}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2) + "\n");
  return file;
}

export function loadDeployment(network: string): DeploymentInfo {
  const file = path.join(DIR, `${network}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No deployment recorded for network "${network}". Run: npm run deploy`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function explorerUrl(network: string, address: string): string {
  return network === "baseSepolia"
    ? `https://sepolia.basescan.org/address/${address}`
    : address;
}
