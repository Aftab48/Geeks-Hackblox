import { NextResponse } from "next/server";
import { certificateSvg } from "@/lib/certificateSvg";
import { publicClient } from "@/lib/chain";
import { CONTRACT_ADDRESS, SOULBOUND_ABI } from "@/lib/contract";
import { getSiteUrl, qrDataUrl } from "@/lib/qr";

const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

type MintMetadataRequest = {
  recipientName?: string;
  courseName?: string;
  issuerName?: string;
  issuerAddress?: string;
  to?: string;
  /** Set on a retry, when a revert has already told us the real next entry. */
  expectedTokenId?: number;
};

function toDataUri(json: unknown): string {
  const encoded = Buffer.from(JSON.stringify(json), "utf8").toString("base64");
  return `data:application/json;base64,${encoded}`;
}

async function pinToPinata(
  url: string,
  jwt: string,
  body: BodyInit,
  headers: Record<string, string> = {}
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, ...headers },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Pinata responded ${response.status}: ${detail.slice(0, 200)}`);
  }

  const result = (await response.json()) as { IpfsHash?: string };
  if (!result.IpfsHash) throw new Error("Pinata response had no IpfsHash");
  return result.IpfsHash;
}

export async function POST(request: Request) {
  let body: MintMetadataRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recipientName = body.recipientName?.trim();
  const courseName = body.courseName?.trim();
  const issuerName = body.issuerName?.trim() || "Unnamed issuer";

  if (!recipientName || !courseName) {
    return NextResponse.json(
      { error: "recipientName and courseName are required" },
      { status: 400 }
    );
  }

  const issuedOn = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // The register number this artwork is stamped with. It's a claim, not a
  // fact, until the mint lands: two issuers reading the same nextTokenId in
  // the same block would both stamp it. The client passes it to
  // issueCertificateAt, which reverts unless the chain still agrees, and
  // comes back here with the real number to pin a corrected copy.
  let expectedTokenId: number | null = null;
  const retryWith = Number(body.expectedTokenId);
  if (Number.isInteger(retryWith) && retryWith > 0) {
    expectedTokenId = retryWith;
  } else {
    try {
      const next = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: SOULBOUND_ABI,
        functionName: "nextTokenId",
      })) as bigint;
      expectedTokenId = Number(next);
    } catch {
      // Fall through unnumbered rather than failing the mint outright.
    }
  }

  const entryNumber =
    expectedTokenId === null ? "000" : expectedTokenId.toString().padStart(3, "0");

  const siteUrl = await getSiteUrl();
  // With no number to point at, send the QR to the holder's wallet instead,
  // which resolves to the same certificate and can't go stale.
  const verifyTarget = expectedTokenId ?? body.to?.trim();
  const verifyUrl = `${siteUrl}/verify/${verifyTarget ?? ""}`;
  const qr = verifyTarget ? await qrDataUrl(verifyUrl) : null;

  const svg = certificateSvg({
    recipientName,
    courseName,
    issuerName,
    issuedOn,
    entryNumber,
    issuerAddress: body.issuerAddress,
    verifyUrl,
    qrDataUri: qr ?? undefined,
  });

  const metadata = {
    name: `${courseName} \u2014 ${recipientName}`,
    description:
      `Soulbound certificate issued by ${issuerName} to ${recipientName} ` +
      `for completing ${courseName}. This token is permanently bound to the ` +
      `recipient's wallet and cannot be transferred.`,
    attributes: [
      { trait_type: "Register Entry", value: entryNumber },
      { trait_type: "Course", value: courseName },
      { trait_type: "Recipient", value: recipientName },
      { trait_type: "Issuer", value: issuerName },
      { trait_type: "Issued On", value: issuedOn },
      { trait_type: "Transferable", value: "No" },
    ],
  };

  const jwt = process.env.PINATA_JWT;

  // No key configured: return everything inline so minting still works.
  if (!jwt) {
    const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    return NextResponse.json({
      uri: toDataUri({ ...metadata, image: svgDataUri }),
      pinned: false,
      reason: "PINATA_JWT not set - metadata embedded inline instead",
      entryNumber,
      expectedTokenId,
    });
  }

  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([svg], { type: "image/svg+xml" }),
      "certificate.svg"
    );
    form.append(
      "pinataMetadata",
      JSON.stringify({ name: `certificate-${Date.now()}.svg` })
    );

    const imageHash = await pinToPinata(PINATA_FILE_URL, jwt, form);

    const metadataHash = await pinToPinata(
      PINATA_JSON_URL,
      jwt,
      JSON.stringify({
        pinataContent: { ...metadata, image: `ipfs://${imageHash}` },
        pinataMetadata: { name: `${courseName}-${recipientName}.json` },
      }),
      { "Content-Type": "application/json" }
    );

    return NextResponse.json({
      uri: `ipfs://${metadataHash}`,
      imageUri: `ipfs://${imageHash}`,
      pinned: true,
      entryNumber,
      expectedTokenId,
    });
  } catch (error) {
    // Pinning failed mid-hackathon. Fall back rather than block the mint.
    const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    return NextResponse.json({
      uri: toDataUri({ ...metadata, image: svgDataUri }),
      pinned: false,
      reason: error instanceof Error ? error.message : "Pinning failed",
      entryNumber,
      expectedTokenId,
    });
  }
}
