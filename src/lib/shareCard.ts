// Draws a CardSpec (domain/shareCards.ts) onto a canvas and hands it to the
// phone's share sheet. 1080 x 1350, the portrait size every chat app and
// story format shows whole. The palette is the app's own light theme,
// hand-copied as hex because a canvas cannot read CSS variables.

import { CardSpec } from "../domain/shareCards";

const W = 1080;
const H = 1350;
const MARGIN = 96;

const INK = "#2b2326";
const INK_2 = "#6a5c60";
const BG = "#fdf5f2";
const CARD = "#fffaf8";
const BORDER = "#eadcd6";
const ROSE = "#a3496f";
const ROSE_SOFT = "#f5e1e8";
const FONT = '"Geist Variable", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`600 80px ${FONT}`),
      document.fonts.load(`500 40px ${FONT}`),
    ]);
  } catch {
    // The fallback stack draws the same card in the system face.
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
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

  let y = 400;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ROSE;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(spec.eyebrow.toUpperCase(), MARGIN, y);
  y += 88;

  ctx.fillStyle = INK;
  ctx.font = `600 84px ${FONT}`;
  for (const line of wrap(ctx, spec.headline, W - MARGIN * 2)) {
    ctx.fillText(line, MARGIN, y);
    y += 98;
  }

  if (spec.sub) {
    y += 8;
    ctx.fillStyle = INK_2;
    ctx.font = `500 40px ${FONT}`;
    for (const line of wrap(ctx, spec.sub, W - MARGIN * 2)) {
      ctx.fillText(line, MARGIN, y);
      y += 54;
    }
  }

  if (spec.stats?.length) {
    y += 40;
    const gap = 24;
    const tileW = (W - MARGIN * 2 - gap) / 2;
    const tileH = 190;
    spec.stats.slice(0, 6).forEach((stat, index) => {
      const x = MARGIN + (index % 2) * (tileW + gap);
      const top = y + Math.floor(index / 2) * (tileH + gap);
      ctx.fillStyle = CARD;
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      roundedRect(ctx, x, top, tileW, tileH, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `600 72px ${FONT}`;
      ctx.fillText(stat.value, x + 36, top + 100);
      ctx.fillStyle = INK_2;
      ctx.font = `500 32px ${FONT}`;
      ctx.fillText(stat.label, x + 36, top + 152);
    });
  }

  if (spec.footnote) {
    ctx.fillStyle = INK_2;
    ctx.font = `500 30px ${FONT}`;
    let fy = H - 200;
    for (const line of wrap(ctx, spec.footnote, W - MARGIN * 2)) {
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
export async function shareImage(blob: Blob, name: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], name, { type: "image/png" });
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
