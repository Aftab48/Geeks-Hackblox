import {
  degrees,
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { CertificateArt } from "./certificateSvg";

// A4 landscape, in points.
const WIDTH = 842;
const HEIGHT = 595;

const INK = rgb(0.071, 0.161, 0.122);
const SOFT = rgb(0.298, 0.341, 0.306);
const RULE = rgb(0.765, 0.741, 0.671);
const SEAL = rgb(0.541, 0.106, 0.106);
const PAPER = rgb(0.957, 0.949, 0.922);

/** PDF space runs bottom-up; the layout below is written top-down. */
const y = (fromTop: number) => HEIGHT - fromTop;

function trackedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  return font.widthOfTextAtSize(text, size) + tracking * Math.max(0, text.length - 1);
}

type TextOptions = {
  size: number;
  font: PDFFont;
  color?: ReturnType<typeof rgb>;
  tracking?: number;
  align?: "left" | "center" | "right";
};

function drawText(
  page: PDFPage,
  text: string,
  left: number,
  top: number,
  options: TextOptions
) {
  const { size, font, color = INK, tracking = 0, align = "left" } = options;
  const width = trackedWidth(font, text, size, tracking);
  let x = left;
  if (align === "center") x = left - width / 2;
  if (align === "right") x = left - width;

  if (tracking === 0) {
    page.drawText(text, { x, y: y(top), size, font, color });
    return;
  }

  // pdf-lib has no letter-spacing, so tracked text is drawn glyph by glyph.
  let cursor = x;
  for (const char of text) {
    page.drawText(char, { x: cursor, y: y(top), size, font, color });
    cursor += font.widthOfTextAtSize(char, size) + tracking;
  }
}

function drawRule(page: PDFPage, from: number, to: number, top: number) {
  page.drawLine({
    start: { x: from, y: y(top) },
    end: { x: to, y: y(top) },
    thickness: 0.75,
    color: RULE,
  });
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}\u2026` : trimmed;
}

/** The same document as the SVG, drawn straight into a PDF. */
export async function certificatePdf(input: CertificateArt): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([WIDTH, HEIGHT]);

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  pdf.setTitle(`Certificate ${input.entryNumber} - ${input.recipientName}`);
  pdf.setSubject(`${input.courseName}, issued by ${input.issuerName}`);
  pdf.setProducer("Certificate Register");

  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: PAPER });
  page.drawRectangle({
    x: 26, y: 26, width: WIDTH - 52, height: HEIGHT - 52,
    borderColor: INK, borderWidth: 1.5,
  });
  page.drawRectangle({
    x: 37, y: 37, width: WIDTH - 74, height: HEIGHT - 74,
    borderColor: RULE, borderWidth: 0.75,
  });

  // Corner brackets.
  const bracket = 22;
  for (const [cx, cy, dx, dy] of [
    [46, 46, 1, 1], [WIDTH - 46, 46, -1, 1],
    [46, HEIGHT - 46, 1, -1], [WIDTH - 46, HEIGHT - 46, -1, -1],
  ]) {
    page.drawLine({
      start: { x: cx, y: cy }, end: { x: cx + dx * bracket, y: cy },
      thickness: 1.5, color: INK,
    });
    page.drawLine({
      start: { x: cx, y: cy }, end: { x: cx, y: cy + dy * bracket },
      thickness: 1.5, color: INK,
    });
  }

  drawText(page, truncate(input.issuerName, 38).toUpperCase(), 68, 82, {
    size: 10, font: sans, color: SOFT, tracking: 4.5,
  });
  drawText(page, `No. ${input.entryNumber}`, WIDTH - 68, 82, {
    size: 16, font: serif, color: SEAL, align: "right",
  });
  drawRule(page, 68, WIDTH - 68, 96);

  drawText(page, "Certificate of Completion", WIDTH / 2, 172, {
    size: 30, font: serif, align: "center",
  });
  drawText(page, "This is to certify that", WIDTH / 2, 205, {
    size: 10.5, font: sans, color: SOFT, align: "center",
  });

  drawText(page, truncate(input.recipientName, 38), WIDTH / 2, 272, {
    size: 38, font: serif, align: "center",
  });
  drawRule(page, 210, WIDTH - 210, 292);

  drawText(page, "has completed the programme", WIDTH / 2, 324, {
    size: 10.5, font: sans, color: SOFT, align: "center",
  });
  drawText(page, truncate(input.courseName, 44), WIDTH / 2, 362, {
    size: 23, font: serifItalic, align: "center",
  });

  drawRule(page, 68, WIDTH - 68, 424);

  // Footer runs on one baseline grid: labels on 458 and 508, values on 480
  // and 528, with the QR spanning the whole block.
  const LABEL_1 = 458;
  const VALUE_1 = 480;
  const LABEL_2 = 508;
  const VALUE_2 = 528;
  const QR_SIZE = 84;
  const QR_TOP = 446;
  const qrRight = WIDTH - 68;
  const qrLeft = qrRight - QR_SIZE;

  drawText(page, "RECORDED", 68, LABEL_1, {
    size: 8, font: sans, color: SOFT, tracking: 1.5,
  });
  drawText(page, input.issuedOn, 68, VALUE_1, { size: 14, font: serif });

  if (input.issuerAddress) {
    const wallet = `${input.issuerAddress.slice(0, 10)}…${input.issuerAddress.slice(-8)}`;
    drawText(page, "SIGNED BY", 68, LABEL_2, {
      size: 8, font: sans, color: SOFT, tracking: 1.5,
    });
    drawText(page, wallet, 68, VALUE_2, { size: 10, font: mono });
  }

  if (input.qrDataUri) {
    const png = await pdf.embedPng(input.qrDataUri);
    page.drawImage(png, {
      x: qrLeft, y: y(QR_TOP + QR_SIZE), width: QR_SIZE, height: QR_SIZE,
    });
    page.drawRectangle({
      x: qrLeft - 3, y: y(QR_TOP + QR_SIZE + 3),
      width: QR_SIZE + 6, height: QR_SIZE + 6,
      borderColor: RULE, borderWidth: 0.75,
    });
  }

  if (input.verifyUrl) {
    const textRight = input.qrDataUri ? qrLeft - 22 : qrRight;
    drawText(page, "CHECK THIS CERTIFICATE AT", textRight, LABEL_1, {
      size: 8, font: sans, color: SOFT, tracking: 1.5, align: "right",
    });
    drawText(page, truncate(input.verifyUrl, 54), textRight, VALUE_1, {
      size: 9.5, font: mono, align: "right",
    });
  }

  if (input.revoked) {
    page.drawText("REVOKED", {
      x: 150, y: 250, size: 110, font: sans,
      color: SEAL, opacity: 0.16, rotate: degrees(18),
    });
    page.drawLine({
      start: { x: 26, y: HEIGHT - 26 }, end: { x: WIDTH - 26, y: 26 },
      thickness: 1.2, color: SEAL, opacity: 0.35,
    });
  }

  return pdf.save();
}
