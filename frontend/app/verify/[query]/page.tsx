import { CertificateCard } from "@/components/CertificateCard";
import { SearchForm } from "@/components/SearchForm";
import {
  classifyQuery,
  getCertificateById,
  getCertificatesFor,
  getOwnerOf,
  type Certificate,
} from "@/lib/certificates";
import { GENESIS_ISSUER_NAME } from "@/lib/contract";
import { resolveMetadata, type CertificateMetadata } from "@/lib/metadata";
import { getSiteUrl, qrDataUrl } from "@/lib/qr";

type Result =
  | { status: "invalid" }
  | { status: "error" }
  | { status: "none"; subject: string }
  | {
      status: "ok";
      subject: string;
      certificates: Certificate[];
      metadata: (CertificateMetadata | null)[];
      owner?: string;
    };

async function lookup(raw: string): Promise<Result> {
  const query = raw.trim();
  const kind = classifyQuery(query);

  if (kind === "invalid") return { status: "invalid" };

  try {
    if (kind === "address") {
      const holder = query as `0x${string}`;
      const certificates = await getCertificatesFor(holder);
      if (certificates.length === 0) return { status: "none", subject: holder };
      const metadata = await Promise.all(
        certificates.map((cert) => resolveMetadata(cert.uri))
      );
      return { status: "ok", subject: holder, certificates, metadata };
    }

    const tokenId = BigInt(query);
    const certificate = await getCertificateById(tokenId);
    if (!certificate) {
      return { status: "none", subject: `register entry ${query}` };
    }

    const owner = await getOwnerOf(tokenId);
    return {
      status: "ok",
      subject: `register entry ${query}`,
      certificates: [certificate],
      metadata: [await resolveMetadata(certificate.uri)],
      owner: owner ?? undefined,
    };
  } catch {
    return { status: "error" };
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ query: string }>;
}) {
  const { query: rawQuery } = await params;
  const query = decodeURIComponent(rawQuery);
  const result = await lookup(query);

  const siteUrl = await getSiteUrl();
  const verifyUrls =
    result.status === "ok"
      ? result.certificates.map(
          (cert) => `${siteUrl}/verify/${cert.tokenId.toString()}`
        )
      : [];
  const qrCodes = await Promise.all(verifyUrls.map((url) => qrDataUrl(url)));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-10">
      <div className="max-w-xl">
        <SearchForm initial={query} />
      </div>

      <div className="mt-10">
        {result.status === "invalid" && (
          <Notice heading="That isn’t an address or a register number">
            Wallet addresses start with <code className="font-mono">0x</code>{" "}
            and run 42 characters. Register numbers are plain digits, like{" "}
            <code className="font-mono">1</code>, printed on the certificate
            itself.
          </Notice>
        )}

        {result.status === "error" && (
          <Notice heading="Couldn’t reach Base" tone="seal">
            The node didn&rsquo;t answer. Nothing is wrong with the certificate;
            give it a moment and run the lookup again.
          </Notice>
        )}

        {result.status === "none" && (
          <Notice heading="Nothing recorded here">
            {GENESIS_ISSUER_NAME} has no entry against{" "}
            <span className="font-mono text-ink">{result.subject}</span>. Check
            the address for a typo, or look it up by the register number on the
            document.
          </Notice>
        )}

        {result.status === "ok" && (
          <>
            {result.subject.startsWith("0x") && (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-soft">
                {result.certificates.length === 1
                  ? "One entry"
                  : `${result.certificates.length} entries`}{" "}
                for {result.subject}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-8">
              {result.certificates.map((certificate, index) => (
                <CertificateCard
                  key={certificate.tokenId.toString()}
                  certificate={certificate}
                  owner={result.owner}
                  metadata={result.metadata[index]}
                  qr={qrCodes[index]}
                  verifyUrl={verifyUrls[index]}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Notice({
  heading,
  children,
  tone = "ink",
}: {
  heading: string;
  children: React.ReactNode;
  tone?: "ink" | "seal";
}) {
  return (
    <div
      className={`border-l-2 bg-card px-6 py-5 ${
        tone === "seal" ? "border-seal" : "border-ink"
      }`}
    >
      <h2 className="display text-xl">{heading}</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-soft">{children}</p>
    </div>
  );
}
