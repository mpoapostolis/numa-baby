// The smallest PDF that carries a picture: one JPEG per A4 page, nothing
// else. Written by hand because a PDF library costs more bytes than the
// whole app shell, and a page drawn on a canvas — the same canvas the share
// cards use — only needs a wrapper to become a file a doctor can open.
//
// Structure (PDF 1.4): catalog → pages → one page object per picture, each
// with a content stream that scales its image XObject to the page, plus an
// Info dictionary for the title. The cross-reference table at the end
// needs the byte offset of every object, so the file is assembled as byte
// chunks and the offsets recorded as they are written.

export type PdfPage = { jpeg: Uint8Array; width: number; height: number };

const A4 = { width: 595.28, height: 841.89 };

/** A PDF text string as UTF-16BE hex, so any name survives intact. */
function pdfText(value: string): string {
  let hex = "FEFF";
  for (const unit of Array.from(value, (c) => c.charCodeAt(0))) hex += unit.toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

export function imagesToPdf(pages: PdfPage[], title: string): Blob {
  if (pages.length === 0) throw new Error("A PDF needs at least one page");
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (piece: string | Uint8Array) => {
    const bytes = typeof piece === "string" ? encoder.encode(piece) : piece;
    chunks.push(bytes);
    length += bytes.length;
  };
  const begin = (id: number) => {
    offsets[id] = length;
    write(`${id} 0 obj\n`);
  };
  const end = () => write("\nendobj\n");

  // Object ids: 1 catalog, 2 pages, 3 info, then per page: page, contents, image.
  const pageIds = pages.map((_, index) => 4 + index * 3);

  write("%PDF-1.4\n%âãÏÓ\n");
  begin(1); write("<< /Type /Catalog /Pages 2 0 R >>"); end();
  begin(2); write(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`); end();
  begin(3); write(`<< /Title ${pdfText(title)} /Producer (Numalog) >>`); end();

  pages.forEach((page, index) => {
    const [pageId, contentId, imageId] = [pageIds[index], pageIds[index] + 1, pageIds[index] + 2];
    const content = `q ${A4.width} 0 0 ${A4.height} 0 0 cm /Im${index} Do Q`;
    begin(pageId);
    write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    end();
    begin(contentId);
    write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    end();
    begin(imageId);
    write(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
    write(page.jpeg);
    write("\nendstream");
    end();
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id += 1) write(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
