// The paediatrician summary as a PDF, drawn the way the share cards are
// drawn — on a canvas, in the app's typeface and palette — and wrapped as
// one A4 page per picture (lib/pdf.ts). It is a picture of a page rather
// than vector text, which is the trade the whole approach rests on: no PDF
// library in the bundle, and a page that looks exactly like the card and
// the screen, at 216 dpi, in every viewer including the one inside
// WhatsApp.

import { VisitDocument, VisitFigure, VisitSection } from "../domain/visitDocument";
import { FONT, PALETTE, drawFace, loadFonts, roundedRect, wrap } from "./shareCard";
import { PdfPage, imagesToPdf } from "./pdf";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const SCALE = 3;
const { INK, INK_2, INK_3, BG, CARD, BORDER, ROSE, ROSE_SOFT } = PALETTE;

/** A page's worth of drawing, in points, on a canvas at SCALE. */
function pageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE.width * SCALE);
  canvas.height = Math.round(PAGE.height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

function jpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer))) : reject(new Error("Could not draw the page"))),
      "image/jpeg",
      0.92,
    );
  });
}

function caps(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.letterSpacing = `${size * 0.08}px`;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
}

function paragraph(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, color: string, lead = size * 1.45): number {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px ${FONT}`;
  for (const line of wrap(ctx, text, width)) {
    ctx.fillText(line, x, y);
    y += lead;
  }
  return y;
}

function tiles(ctx: CanvasRenderingContext2D, figures: VisitFigure[], y: number, width: number): number {
  const gap = 8;
  const columns = Math.min(3, figures.length);
  const tileW = (width - gap * (columns - 1)) / columns;
  const tileH = 54;
  figures.forEach((figure, index) => {
    const x = MARGIN + (index % columns) * (tileW + gap);
    const top = y + Math.floor(index / columns) * (tileH + gap);
    ctx.fillStyle = CARD;
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 0.8;
    roundedRect(ctx, x, top, tileW, tileH, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText(figure.value, x + 12, top + 27);
    if (figure.unit && figure.value !== "—") {
      const valueWidth = ctx.measureText(figure.value).width;
      ctx.fillStyle = INK_2;
      ctx.font = `500 9.5px ${FONT}`;
      ctx.fillText(figure.unit, x + 12 + valueWidth + 3, top + 27);
    }
    ctx.fillStyle = INK_2;
    ctx.font = `500 8.5px ${FONT}`;
    ctx.fillText(figure.label, x + 12, top + 43);
  });
  return y + Math.ceil(figures.length / columns) * (tileH + gap) - gap;
}

function section(ctx: CanvasRenderingContext2D, block: VisitSection, y: number, width: number): number {
  caps(ctx, block.heading, MARGIN, y, 8, INK_2);
  y = tiles(ctx, block.figures, y + 8, width);
  return paragraph(ctx, block.note, MARGIN, y + 16, width, 9, INK_2, 12.5) + 8;
}

function table(ctx: CanvasRenderingContext2D, doc: VisitDocument, y: number, width: number): number {
  const columns = [
    { label: "Day", width: 0, align: "left" as const },
    { label: "Feeds", width: 70, align: "right" as const },
    { label: doc.volumeUnit, width: 70, align: "right" as const },
    { label: "Wet", width: 70, align: "right" as const },
    { label: "Dirty", width: 70, align: "right" as const },
  ];
  const fixed = columns.slice(1).reduce((sum, column) => sum + column.width, 0);
  columns[0].width = width - fixed;
  const rowH = 15.5;
  const cell = (text: string, column: (typeof columns)[number], x: number, baseline: number) => {
    const at = column.align === "left" ? x + 6 : x + column.width - 6 - ctx.measureText(text).width;
    ctx.fillText(text, at, baseline);
  };

  // Header row.
  ctx.font = `600 7.5px ${FONT}`;
  ctx.letterSpacing = "0.5px";
  ctx.fillStyle = INK_2;
  let x = MARGIN;
  for (const column of columns) {
    cell(column.label.toUpperCase(), column, x, y + 10);
    x += column.width;
  }
  ctx.letterSpacing = "0px";
  y += 14;
  ctx.fillStyle = BORDER;
  ctx.fillRect(MARGIN, y, width, 0.8);

  doc.days.forEach((day, index) => {
    const top = y + index * rowH;
    if (index % 2 === 1) {
      ctx.fillStyle = BG;
      ctx.fillRect(MARGIN, top, width, rowH);
    }
    const baseline = top + 10.5;
    ctx.font = `500 9.5px ${FONT}`;
    ctx.fillStyle = INK;
    cell(day.label, columns[0], MARGIN, baseline);
    if (day.blank) {
      ctx.fillStyle = INK_3;
      ctx.font = `italic 500 9.5px ${FONT}`;
      ctx.fillText("not logged", MARGIN + columns[0].width + 6, baseline);
    } else {
      let cx = MARGIN + columns[0].width;
      for (const [column, text] of [[columns[1], day.feeds], [columns[2], day.ml], [columns[3], day.wet], [columns[4], day.dirty]] as const) {
        cell(text, column, cx, baseline);
        cx += column.width;
      }
    }
  });
  const bottom = y + doc.days.length * rowH;
  ctx.fillStyle = BORDER;
  ctx.fillRect(MARGIN, bottom, width, 0.8);
  return bottom;
}

function drawPage(ctx: CanvasRenderingContext2D, doc: VisitDocument) {
  const width = PAGE.width - MARGIN * 2;

  // The card's soft circle, faded for paper.
  ctx.fillStyle = ROSE_SOFT;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(PAGE.width - 40, 30, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawFace(ctx, MARGIN + 22, 66, 22);
  caps(ctx, doc.eyebrow, MARGIN + 58, 52, 8.5, ROSE);
  ctx.fillStyle = INK;
  ctx.font = `600 24px ${FONT}`;
  ctx.letterSpacing = "-0.4px";
  ctx.fillText(doc.title, MARGIN + 58, 78);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = INK_2;
  ctx.font = `500 9.5px ${FONT}`;
  ctx.fillText(doc.sub, MARGIN + 58, 95);

  // Coverage pill.
  let y = 118;
  ctx.font = `500 9.5px ${FONT}`;
  const coverageLines = wrap(ctx, doc.coverage, width - 24);
  const pillH = 12 + coverageLines.length * 13;
  ctx.fillStyle = BG;
  roundedRect(ctx, MARGIN, y, width, pillH, 7);
  ctx.fill();
  ctx.fillStyle = INK;
  coverageLines.forEach((line, index) => ctx.fillText(line, MARGIN + 12, y + 16 + index * 13));
  y += pillH + 18;

  for (const block of doc.sections) y = section(ctx, block, y, width);

  caps(ctx, "Day by day", MARGIN, y, 8, INK_2);
  y = table(ctx, doc, y + 6, width);

  // Footer, pinned to the page bottom.
  const footY = PAGE.height - MARGIN - 18;
  ctx.fillStyle = BORDER;
  ctx.fillRect(MARGIN, footY - 14, width, 0.8);
  ctx.fillStyle = ROSE;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText("numalog.app", MARGIN, footY);
  ctx.fillStyle = INK_3;
  ctx.font = `500 7.5px ${FONT}`;
  const noteLines = wrap(ctx, doc.footnote, 330);
  noteLines.forEach((line, index) => {
    ctx.fillText(line, PAGE.width - MARGIN - ctx.measureText(line).width, footY - (noteLines.length - 1 - index) * 10);
  });
}

/** The summary as a PDF file, ready for the share sheet or a download. */
export async function visitPdf(doc: VisitDocument): Promise<Blob> {
  await loadFonts();
  const { canvas, ctx } = pageCanvas();
  drawPage(ctx, doc);
  const page: PdfPage = { jpeg: await jpeg(canvas), width: canvas.width, height: canvas.height };
  return imagesToPdf([page], doc.title);
}
