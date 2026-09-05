const GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

export type CertificateMetadata = {
  name?: string;
  description?: string;
  image?: string;
};

/** Turns an ipfs:// URI into something a browser can load. */
export function toHttpUrl(uri: string): string {
  if (uri.startsWith("ipfs://")) return GATEWAY + uri.slice("ipfs://".length);
  return uri;
}

/**
 * Reads certificate metadata from IPFS, an https URL, or an inline data URI.
 * Returns null for placeholders and anything unreachable - the card renders
 * fine without it.
 */
export async function resolveMetadata(
  uri: string
): Promise<CertificateMetadata | null> {
  if (!uri || uri.startsWith("ipfs://placeholder")) return null;

  if (uri.startsWith("data:application/json;base64,")) {
    try {
      const encoded = uri.slice("data:application/json;base64,".length);
      return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }

  const url = toHttpUrl(uri);
  if (!url.startsWith("http")) return null;

  try {
    const response = await fetch(url, {
      // A CID addresses its own bytes, so this can never go stale. Cache it
      // for good: the public gateway takes 4-7 seconds on a cold read, and
      // paying that once per certificate rather than once per page load is
      // the difference between a demo that hangs and one that doesn't.
      cache: "force-cache",
      // The old 6s ceiling sat right in the middle of that range, so the
      // artwork appeared or vanished depending on how the gateway felt.
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return (await response.json()) as CertificateMetadata;
  } catch {
    return null;
  }
}
