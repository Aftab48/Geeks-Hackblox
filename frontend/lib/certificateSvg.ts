function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

function clamp(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}\u2026` : trimmed;
}

export type CertificateArt = {
  recipientName: string;
  courseName: string;
  issuerName: string;
  issuedOn: string;
  /** Register number, zero-padded. Printed so a paper copy can be looked up. */
  entryNumber: string;
  issuerAddress?: string;
  verifyUrl?: string;
  /** PNG data URI, embedded so the file stays self-contained when downloaded. */
  qrDataUri?: string;
  /** Overprints the document so a revoked copy can never pass as valid. */
  revoked?: boolean;
};

/**
 * The certificate as a document people can print. Everything a paper copy
 * needs to be checked later lives on it: the register number, the issuing
 * wallet, and a QR pointing at the lookup page.
 */
export function certificateSvg(input: CertificateArt): string {
  const recipient = escapeXml(clamp(input.recipientName, 38));
  const course = escapeXml(clamp(input.courseName, 44));
  const issuer = escapeXml(clamp(input.issuerName, 38)).toUpperCase();
  const issuedOn = escapeXml(clamp(input.issuedOn, 30));
  const entry = escapeXml(input.entryNumber);
  const wallet = input.issuerAddress
    ? escapeXml(`${input.issuerAddress.slice(0, 10)}\u2026${input.issuerAddress.slice(-8)}`)
    : "";
  const url = input.verifyUrl ? escapeXml(clamp(input.verifyUrl, 52)) : "";

  const qr = input.qrDataUri
    ? `<image href="${input.qrDataUri}" x="788" y="526" width="100" height="100"/>
  <rect x="785" y="523" width="106" height="106" fill="none" stroke="#c3bdab" stroke-width="1"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="700" viewBox="0 0 960 700" role="img" aria-label="Certificate ${entry} awarded to ${recipient}">
  <rect width="960" height="700" fill="#f4f2eb"/>

  <rect x="28" y="28" width="904" height="644" fill="none" stroke="#12291f" stroke-width="2"/>
  <rect x="40" y="40" width="880" height="620" fill="none" stroke="#c3bdab" stroke-width="1"/>

  <g stroke="#12291f" stroke-width="2" fill="none">
    <path d="M52 76 V52 H76"/>
    <path d="M908 76 V52 H884"/>
    <path d="M52 624 V648 H76"/>
    <path d="M908 624 V648 H884"/>
  </g>

  <text x="72" y="112" fill="#4c574e" font-family="Helvetica, Arial, sans-serif" font-size="13" letter-spacing="6">${issuer}</text>
  <text x="888" y="112" text-anchor="end" fill="#8a1b1b" font-family="Georgia, 'Times New Roman', serif" font-size="20">No. ${entry}</text>
  <path d="M72 130 H888" stroke="#c3bdab" stroke-width="1"/>

  <text x="480" y="212" text-anchor="middle" fill="#12291f" font-family="Georgia, 'Times New Roman', serif" font-size="40">Certificate of Completion</text>
  <text x="480" y="256" text-anchor="middle" fill="#4c574e" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="1">This is to certify that</text>

  <text x="480" y="344" text-anchor="middle" fill="#12291f" font-family="Georgia, 'Times New Roman', serif" font-size="54">${recipient}</text>
  <path d="M240 370 H720" stroke="#c3bdab" stroke-width="1"/>

  <text x="480" y="414" text-anchor="middle" fill="#4c574e" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="1">has completed the programme</text>
  <text x="480" y="464" text-anchor="middle" fill="#12291f" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-style="italic">${course}</text>

  <path d="M72 508 H888" stroke="#c3bdab" stroke-width="1"/>

  <text x="72" y="546" fill="#4c574e" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="2">RECORDED</text>
  <text x="72" y="572" fill="#12291f" font-family="Georgia, 'Times New Roman', serif" font-size="19">${issuedOn}</text>

  ${wallet ? `<text x="72" y="606" fill="#4c574e" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="2">SIGNED BY</text>
  <text x="72" y="632" fill="#12291f" font-family="'Courier New', monospace" font-size="14">${wallet}</text>` : ""}

  ${url ? `<text x="762" y="546" text-anchor="end" fill="#4c574e" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="2">CHECK THIS CERTIFICATE AT</text>
  <text x="762" y="572" text-anchor="end" fill="#12291f" font-family="'Courier New', monospace" font-size="13">${url}</text>` : ""}

  ${qr}
${
  input.revoked
    ? `  <g opacity="0.16" transform="rotate(-18 480 350)">
    <text x="480" y="392" text-anchor="middle" fill="#8a1b1b" font-family="Helvetica, Arial, sans-serif" font-size="150" font-weight="bold" letter-spacing="10">REVOKED</text>
  </g>
  <path d="M28 28 L932 672" stroke="#8a1b1b" stroke-width="1.5" opacity="0.35"/>`
    : ""
}
</svg>`;
}
