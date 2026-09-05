/**
 * The attestation stamp. A registrar's seal is what people already trust on a
 * paper certificate, so the on-chain check wears the same clothes: issuer
 * around the ring, register number and network in the middle, applied at a
 * slight angle like it was pressed by hand.
 */
export function Seal({
  issuerName,
  tokenId,
  revoked,
  size = 136,
}: {
  issuerName: string;
  tokenId: bigint;
  revoked: boolean;
  size?: number;
}) {
  const ring = (issuerName || "Registered issuer").toUpperCase();
  const entry = tokenId.toString().padStart(3, "0");
  const colour = revoked ? "#6b6b6b" : "#8a1b1b";

  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      className="stamp-in shrink-0"
      style={{ transform: "rotate(-7deg)", opacity: revoked ? 0.55 : 0.9 }}
      role="img"
      aria-label={
        revoked
          ? `Revoked seal for register entry ${entry}`
          : `Verification seal for register entry ${entry}`
      }
    >
      <defs>
        <path id={`ring-${entry}`} d="M 26,80 A 54,54 0 0 1 134,80" />
      </defs>

      <g fill="none" stroke={colour} strokeWidth="2.5">
        <circle cx="80" cy="80" r="74" />
      </g>
      <g fill="none" stroke={colour} strokeWidth="1">
        <circle cx="80" cy="80" r="66" />
      </g>

      <text
        fill={colour}
        fontSize="9.5"
        letterSpacing="2.4"
        style={{ fontFamily: "var(--font-public-sans), sans-serif" }}
        fontWeight={600}
      >
        <textPath href={`#ring-${entry}`} startOffset="50%" textAnchor="middle">
          {ring.length > 30 ? `${ring.slice(0, 29)}\u2026` : ring}
        </textPath>
      </text>

      <text
        x="80"
        y="86"
        textAnchor="middle"
        fill={colour}
        fontSize="17"
        letterSpacing="1"
        style={{ fontFamily: "var(--font-newsreader), Georgia, serif" }}
      >
        {revoked ? "REVOKED" : "VERIFIED"}
      </text>

      <line x1="58" y1="95" x2="102" y2="95" stroke={colour} strokeWidth="1" />

      <text
        x="80"
        y="107"
        textAnchor="middle"
        fill={colour}
        fontSize="9"
        letterSpacing="1.8"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        ENTRY {entry}
      </text>
      <text
        x="80"
        y="120"
        textAnchor="middle"
        fill={colour}
        fontSize="7.5"
        letterSpacing="1.6"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        BASE SEPOLIA
      </text>

      {revoked && (
        <>
          <line x1="20" y1="72" x2="140" y2="72" stroke={colour} strokeWidth="3" />
          <line x1="20" y1="84" x2="140" y2="84" stroke={colour} strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
