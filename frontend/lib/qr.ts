import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * Absolute origin for this request. Uses NEXT_PUBLIC_SITE_URL when set
 * (useful for a fixed production domain), otherwise infers it from the
 * request so the same code works on localhost and on Vercel.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

/**
 * QR code as a PNG data URI. Deliberately dark-on-white rather than themed:
 * inverted codes are unreliable on some phone scanners, and this one has to
 * work first time in front of a judge.
 */
export async function qrDataUrl(target: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(target, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0e14", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}
