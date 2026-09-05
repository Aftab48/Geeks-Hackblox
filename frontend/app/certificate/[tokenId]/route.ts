import { getCertificateById } from "@/lib/certificates";
import { certificatePdf } from "@/lib/certificatePdf";
import { certificateSvg, type CertificateArt } from "@/lib/certificateSvg";
import { getSiteUrl, qrDataUrl } from "@/lib/qr";

/**
 * The printable certificate, rendered from what the chain currently says.
 * Unlike the copy pinned at mint time, this always carries the real register
 * number and reflects a later revocation.
 *
 *   ?format=pdf   A4 landscape PDF (default is SVG, for viewing in a browser)
 *   ?download=1   serve as an attachment rather than inline
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  if (!/^\d+$/.test(tokenId)) {
    return new Response("Not a register number", { status: 400 });
  }

  const certificate = await getCertificateById(BigInt(tokenId));
  if (!certificate) {
    return new Response("No such entry in the register", { status: 404 });
  }

  const siteUrl = await getSiteUrl();
  const verifyUrl = `${siteUrl}/verify/${tokenId}`;
  const entryNumber = tokenId.padStart(3, "0");

  const document: CertificateArt = {
    recipientName: certificate.recipientName,
    courseName: certificate.courseName,
    issuerName: certificate.issuerName,
    issuedOn: new Date(Number(certificate.issuedAt) * 1000).toLocaleDateString(
      "en-GB",
      { year: "numeric", month: "long", day: "numeric" }
    ),
    entryNumber,
    issuerAddress: certificate.issuer,
    verifyUrl,
    qrDataUri: (await qrDataUrl(verifyUrl)) ?? undefined,
    revoked: certificate.revoked,
  };

  const search = new URL(request.url).searchParams;
  const wantsPdf = search.get("format") === "pdf";
  const wantsDownload = search.has("download");

  const extension = wantsPdf ? "pdf" : "svg";
  const disposition = wantsDownload
    ? `attachment; filename="certificate-${entryNumber}.${extension}"`
    : "inline";

  if (wantsPdf) {
    const pdf = await certificatePdf(document);
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  return new Response(certificateSvg(document), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": disposition,
      "Cache-Control": "public, max-age=60",
    },
  });
}
