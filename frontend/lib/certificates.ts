import { isAddress } from "viem";
import { publicClient } from "./chain";
import { CONTRACT_ADDRESS, SOULBOUND_ABI } from "./contract";

export type Certificate = {
  tokenId: bigint;
  recipientName: string;
  courseName: string;
  issuedAt: bigint;
  issuer: `0x${string}`;
  issuerName: string;
  revoked: boolean;
  uri: string;
};

const contract = {
  address: CONTRACT_ADDRESS,
  abi: SOULBOUND_ABI,
} as const;

/** Every certificate held by a wallet, valid and revoked alike. */
export async function getCertificatesFor(
  holder: `0x${string}`
): Promise<Certificate[]> {
  const result = await publicClient.readContract({
    ...contract,
    functionName: "getCertificates",
    args: [holder],
  });
  return result as unknown as Certificate[];
}

/** A single certificate by token ID. Returns null if it does not exist. */
export async function getCertificateById(
  tokenId: bigint
): Promise<Certificate | null> {
  try {
    const result = await publicClient.readContract({
      ...contract,
      functionName: "getCertificate",
      args: [tokenId],
    });
    return result as unknown as Certificate;
  } catch {
    return null;
  }
}

export async function getOwnerOf(
  tokenId: bigint
): Promise<`0x${string}` | null> {
  try {
    return (await publicClient.readContract({
      ...contract,
      functionName: "ownerOf",
      args: [tokenId],
    })) as `0x${string}`;
  } catch {
    return null;
  }
}

/**
 * Every entry in the register, oldest first. The appointments page needs the
 * whole thing because a registrar supervises by issuer, and there is no
 * contract call for "certificates minted by the people I appointed".
 */
export async function getAllCertificates(): Promise<Certificate[]> {
  try {
    const total = (await publicClient.readContract({
      ...contract,
      functionName: "totalIssued",
    })) as bigint;

    const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
    const certificates = await Promise.all(ids.map(getCertificateById));
    return certificates.filter((cert): cert is Certificate => cert !== null);
  } catch {
    return [];
  }
}

export type LookupKind = "address" | "tokenId" | "invalid";

export function classifyQuery(raw: string): LookupKind {
  const value = raw.trim();
  if (isAddress(value)) return "address";
  if (/^\d+$/.test(value)) return "tokenId";
  return "invalid";
}

/**
 * The newest entries in the register, most recent first. Returns an empty list
 * rather than throwing: the front page should still render if the node is
 * having a bad minute.
 */
export async function getRecentCertificates(limit = 4): Promise<Certificate[]> {
  try {
    const total = (await publicClient.readContract({
      ...contract,
      functionName: "totalIssued",
    })) as bigint;

    const count = Number(total);
    if (count === 0) return [];

    const ids: bigint[] = [];
    for (let id = count; id > Math.max(0, count - limit); id--) {
      ids.push(BigInt(id));
    }

    const certificates = await Promise.all(ids.map(getCertificateById));
    return certificates.filter((cert): cert is Certificate => cert !== null);
  } catch {
    return [];
  }
}
