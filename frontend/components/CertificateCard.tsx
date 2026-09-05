import type { Certificate } from "@/lib/certificates";
import { CONTRACT_ADDRESS, EXPLORER_URL } from "@/lib/contract";
import { toHttpUrl, type CertificateMetadata } from "@/lib/metadata";
import { Seal } from "./Seal";

function shorten(address: string) {
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

function formatDate(seconds: bigint) {
  return new Date(Number(seconds) * 1000).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-soft">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

export function CertificateCard({
  certificate,
  owner,
  metadata,
  qr,
  verifyUrl,
}: {
  certificate: Certificate;
  owner?: string;
  metadata?: CertificateMetadata | null;
  qr?: string | null;
  verifyUrl?: string;
}) {
  const revoked = certificate.revoked;
  const image = metadata?.image ? toHttpUrl(metadata.image) : null;
  const entry = certificate.tokenId.toString().padStart(3, "0");

  return (
    <article className="border border-rule bg-card">
      <div className="border border-rule/50 m-1.5 px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-soft">
              Register entry {entry}
            </p>
            <h2
              className={`display mt-2 text-3xl leading-tight sm:text-4xl ${
                revoked ? "text-soft line-through decoration-seal/60" : ""
              }`}
            >
              {certificate.courseName}
            </h2>
            <p className="mt-2 text-soft">
              Awarded to{" "}
              <span className="text-ink">{certificate.recipientName}</span>
            </p>
          </div>

          <Seal
            issuerName={certificate.issuerName}
            tokenId={certificate.tokenId}
            revoked={revoked}
          />
        </div>

        {revoked && (
          <p className="mt-6 border-l-2 border-seal bg-seal/5 px-4 py-3 text-sm text-seal">
            {certificate.issuerName || "The issuer"} revoked this entry, so it
            no longer certifies anything. The token stays in the holder&apos;s
            wallet as a permanent record that it was revoked.
          </p>
        )}

        <div className="my-7 h-px bg-rule" />

        <dl className="grid gap-5 sm:grid-cols-3">
          <Field label="Recorded">{formatDate(certificate.issuedAt)}</Field>
          <Field label="Issued by">
            <span className="block">
              {certificate.issuerName || "Unnamed issuer"}
            </span>
            <a
              href={`${EXPLORER_URL}/address/${certificate.issuer}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-soft underline decoration-rule underline-offset-2 hover:text-seal"
            >
              {shorten(certificate.issuer)}
            </a>
          </Field>
          {owner ? (
            <Field label="Held by">
              <a
                href={`${EXPLORER_URL}/address/${owner}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline decoration-rule underline-offset-2 hover:text-seal"
              >
                {shorten(owner)}
              </a>
            </Field>
          ) : (
            <Field label="Record">
              <a
                href={`${EXPLORER_URL}/token/${CONTRACT_ADDRESS}?a=${certificate.tokenId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline decoration-rule underline-offset-2 hover:text-seal"
              >
                Read it on Basescan
              </a>
            </Field>
          )}
        </dl>

        {image && (
          <div className="mt-7 border border-rule bg-paper p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={`Certificate issued to ${certificate.recipientName}`}
              className={`block w-full ${revoked ? "opacity-40 grayscale" : ""}`}
            />
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-5 border-t border-rule pt-6">
          {qr && (
            <div className="border border-rule bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt={`QR code for register entry ${entry}`}
                className="block"
                style={{ height: 92, width: 92 }}
              />
            </div>
          )}

          <div className="min-w-0 flex-1 basis-56">
            {verifyUrl && (
              <p className="truncate font-mono text-xs text-soft">{verifyUrl}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <a
                href={`/certificate/${certificate.tokenId.toString()}?format=pdf&download=1`}
                className="border border-ink px-5 py-2.5 font-mono text-[0.7rem] uppercase
                           tracking-[0.14em] text-ink transition hover:border-seal hover:text-seal"
              >
                Download PDF
              </a>
              <a
                href={`/certificate/${certificate.tokenId.toString()}?format=svg&download=1`}
                className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-soft
                           underline decoration-rule underline-offset-4 hover:text-seal"
              >
                SVG
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
