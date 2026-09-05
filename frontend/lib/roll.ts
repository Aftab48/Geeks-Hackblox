import { publicClient } from "./chain";
import { CONTRACT_ADDRESS, DEPLOY_BLOCK, SOULBOUND_ABI } from "./contract";

export type Officer = {
  address: `0x${string}`;
  name: string;
  /** The registrar that appointed this issuer. Zero for the genesis issuer. */
  appointedBy: `0x${string}`;
  isAdmin: boolean;
  isRegistrar: boolean;
  isIssuer: boolean;
};

export type Roll = {
  officers: Officer[];
  /** True when the log scan failed and the roll below is incomplete. */
  partial: boolean;
};

const contract = { address: CONTRACT_ADDRESS, abi: SOULBOUND_ABI } as const;

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * Everyone who currently holds an office, and who put them there.
 *
 * AccessControl keeps no list of role holders, so the candidates come from
 * RoleGranted logs. That catches the raw grantRole path as well as addIssuer,
 * which addIssuer-only events would miss. Logs give candidates, not answers:
 * a role granted in block 4 may have been revoked in block 9, so every
 * candidate is checked against current state before it reaches the page.
 */
export async function getRoll(): Promise<Roll> {
  let candidates: `0x${string}`[] = [];
  let partial = false;

  try {
    // Coinbase's endpoint rejects fromBlock + "latest" outright, so the head
    // is resolved to a number first. The window keeps this working on nodes
    // that cap how many blocks one query may cover.
    const latest = await publicClient.getBlockNumber();
    const WINDOW = BigInt(9000);

    const seen = new Set<string>();
    for (let from = BigInt(DEPLOY_BLOCK); from <= latest; from += WINDOW) {
      const end = from + WINDOW - BigInt(1);
      const granted = await publicClient.getContractEvents({
        ...contract,
        eventName: "RoleGranted",
        fromBlock: from,
        toBlock: end > latest ? latest : end,
      });

      for (const log of granted) {
        const account = log.args.account;
        if (!account) continue;
        const key = account.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(account);
      }
    }
  } catch {
    // A gateway that won't serve a log range shouldn't take the page down.
    // The connected wallet still gets checked below, so you can always see
    // your own office even when the roll can't be drawn.
    partial = true;
    candidates = [];
  }

  return { officers: await describe(candidates), partial };
}

/** The same shape as the roll, for one address. Used to fill in a partial scan. */
export async function getOfficer(
  address: `0x${string}`
): Promise<Officer | null> {
  const [officer] = await describe([address]);
  return officer ?? null;
}

async function describe(addresses: `0x${string}`[]): Promise<Officer[]> {
  if (addresses.length === 0) return [];

  const [adminRole, registrarRole, issuerRole] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: "DEFAULT_ADMIN_ROLE" }),
    publicClient.readContract({ ...contract, functionName: "REGISTRAR_ROLE" }),
    publicClient.readContract({ ...contract, functionName: "ISSUER_ROLE" }),
  ]);

  const results = await Promise.all(
    addresses.map(async (address) => {
      const [isAdmin, isRegistrar, isIssuer, name, appointedBy] =
        await Promise.all([
          publicClient.readContract({
            ...contract,
            functionName: "hasRole",
            args: [adminRole, address],
          }),
          publicClient.readContract({
            ...contract,
            functionName: "hasRole",
            args: [registrarRole, address],
          }),
          publicClient.readContract({
            ...contract,
            functionName: "hasRole",
            args: [issuerRole, address],
          }),
          publicClient.readContract({
            ...contract,
            functionName: "issuerName",
            args: [address],
          }),
          publicClient.readContract({
            ...contract,
            functionName: "appointedBy",
            args: [address],
          }),
        ]);

      return {
        address,
        name: name as string,
        appointedBy: appointedBy as `0x${string}`,
        isAdmin: isAdmin as boolean,
        isRegistrar: isRegistrar as boolean,
        isIssuer: isIssuer as boolean,
      };
    })
  );

  // Someone stripped of every role has left the roll; they stay in the logs
  // but not on the page.
  return results.filter(
    (officer) => officer.isAdmin || officer.isRegistrar || officer.isIssuer
  );
}

export function isZero(address: string): boolean {
  return address.toLowerCase() === ZERO;
}

export function same(a?: string, b?: string): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
