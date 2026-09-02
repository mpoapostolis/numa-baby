// Draws a CardSpec (domain/shareCards.ts) onto a canvas and hands it to the
// phone's share sheet. 1080 x 1350, the portrait size every chat app and
// story format shows whole. The palette is the app's own light theme,
// hand-copied as hex because a canvas cannot read CSS variables.

import { CardSpec } from "../domain/shareCards";

const W = 1080;
const H = 1350;
const MARGIN = 96;

// Shared with the PDF page (lib/visitPdf.ts), which is the same design on paper.
export const PALETTE = {
  INK: "#2b2326",
  INK_2: "#6a5c60",
  INK_3: "#8a7a80",
  BG: "#fdf5f2",
  CARD: "#fffaf8",
  BORDER: "#eadcd6",
  ROSE: "#a3496f",
  ROSE_SOFT: "#f5e1e8",
} as const;
export const FONT = '"Geist Variable", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const { INK, INK_2, BG, CARD, BORDER, ROSE, ROSE_SOFT } = PALETTE;

export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`600 80px ${FONT}`),
      document.fonts.load(`500 40px ${FONT}`),
    ]);
  } catch {
    // The fallback stack draws the same card in the system face.
  }
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The app's own face, in the illustration language of illustrations.tsx:
// round strokes, one accent, nothing that grades anyone.
export function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.lineCap = "round";
  // Stroke in proportion to the face, so the same drawing works at 72px on
  // a card and at 22pt on a page.
  ctx.lineWidth = r * 0.097;
  ctx.strokeStyle = ROSE;
  ctx.fillStyle = CARD;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ROSE;
  for (const dx of [-0.34, 0.34]) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy - 0.12 * r, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy + 0.12 * r, r * 0.34, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  // A small tuft of hair.
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 1.3, cx + r * 0.42, cy - r * 1.12);
  ctx.stroke();
  ctx.restore();
}

export async function renderCard(spec: CardSpec): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ROSE_SOFT;
  ctx.beginPath();
  ctx.arc(W - 110, 120, 280, 0, Math.PI * 2);
  ctx.fill();
  drawFace(ctx, MARGIN + 78, 210, 72);

  // Measure first, draw second: a card with six tiles needs the text higher
  // and the tiles shorter, and a card with no tiles reads better with its
  // words in the middle than as a headline over a blank page.
  const count = Math.min(spec.stats?.length ?? 0, 6);
  const compact = count > 4;
  const headlineSize = compact ? 72 : 84;
  const headlineLead = compact ? 86 : 98;
  const subSize = compact ? 36 : 40;
  const subLead = compact ? 48 : 54;
  const maxWidth = W - MARGIN * 2;

  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${headlineSize}px ${FONT}`;
  const headlineLines = wrap(ctx, spec.headline, maxWidth);
  ctx.font = `500 ${subSize}px ${FONT}`;
  const subLines = spec.sub ? wrap(ctx, spec.sub, maxWidth) : [];
  ctx.font = `500 30px ${FONT}`;
  const footnoteLines = spec.footnote ? wrap(ctx, spec.footnote, maxWidth) : [];

  const footerTop = H - 132;
  const footnoteTop = footerTop - 44 - footnoteLines.length * 40;
  const contentBottom = (footnoteLines.length ? footnoteTop : footerTop) - 48;
  const blockH = 88 + headlineLines.length * headlineLead + (subLines.length ? 8 + subLines.length * subLead : 0);
  let y = compact ? 360 : 400;
  if (count === 0) {
    // Centre the words between the face and the footer.
    const faceBottom = 282;
    y = Math.max(y, Math.round(faceBottom + (contentBottom - faceBottom - blockH) / 2) + 40);
  }

  ctx.fillStyle = ROSE;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(spec.eyebrow.toUpperCase(), MARGIN, y);
  y += 88;

  ctx.fillStyle = INK;
  ctx.font = `600 ${headlineSize}px ${FONT}`;
  for (const line of headlineLines) {
    ctx.fillText(line, MARGIN, y);
    y += headlineLead;
  }

  if (subLines.length) {
    y += 8;
    ctx.fillStyle = INK_2;
    ctx.font = `500 ${subSize}px ${FONT}`;
    for (const line of subLines) {
      ctx.fillText(line, MARGIN, y);
      y += subLead;
    }
  }

  if (count > 0) {
    y += 40;
    const gap = 24;
    const rows = Math.ceil(count / 2);
    const tileW = (maxWidth - gap) / 2;
    // Never taller than the design's 190, never past the footnote.
    const tileH = Math.max(120, Math.min(190, Math.floor((contentBottom - y - (rows - 1) * gap) / rows)));
    const scale = tileH / 190;
    spec.stats!.slice(0, 6).forEach((stat, index) => {
      const x = MARGIN + (index % 2) * (tileW + gap);
      const top = y + Math.floor(index / 2) * (tileH + gap);
      ctx.fillStyle = CARD;
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      roundedRect(ctx, x, top, tileW, tileH, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `600 ${Math.round(72 * scale)}px ${FONT}`;
      ctx.fillText(stat.value, x + 36, top + Math.round(100 * scale));
      ctx.fillStyle = INK_2;
      ctx.font = `500 ${Math.round(32 * scale)}px ${FONT}`;
      ctx.fillText(stat.label, x + 36, top + Math.round(152 * scale));
    });
  }

  if (footnoteLines.length) {
    ctx.fillStyle = INK_2;
    ctx.font = `500 30px ${FONT}`;
    let fy = footnoteTop + 30;
    for (const line of footnoteLines) {
      ctx.fillText(line, MARGIN, fy);
      fy += 40;
    }
  }

  ctx.fillStyle = BORDER;
  ctx.fillRect(MARGIN, H - 132, W - MARGIN * 2, 2);
  ctx.fillStyle = ROSE;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText("numalog.app", MARGIN, H - 72);
  ctx.fillStyle = INK_2;
  ctx.font = `500 30px ${FONT}`;
  const tagline = "a calm, private baby tracker · free, no ads";
  ctx.fillText(tagline, W - MARGIN - ctx.measureText(tagline).width, H - 72);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the card"))), "image/png");
  });
}

/** The native share sheet when it takes files, a download when it does not. */
export function shareImage(blob: Blob, name: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  return shareFile(blob, name, text);
}

/** Any file — a picture or a PDF — through the share sheet, else a download. */
export async function shareFile(blob: Blob, name: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      // Closing the sheet is a decision, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
  return "saved";
}
