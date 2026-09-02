import { describe, expect, it } from "vitest";
import { imagesToPdf } from "@/lib/pdf";

// The hand-written PDF wrapper. A reader trusts the cross-reference table
// blindly, so the test walks it: every offset must land on "<id> 0 obj".

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

const ascii = (view: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...view.subarray(from, from + length));

describe("imagesToPdf", () => {
  it("writes a two-page PDF whose xref offsets all land on their objects", async () => {
    const pdf = await bytes(imagesToPdf([{ jpeg, width: 4, height: 6 }, { jpeg, width: 4, height: 6 }], "Mia · summary"));
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/Kids [4 0 R 7 0 R]");
    expect(text).toContain("/Filter /DCTDecode /Length 13");
    expect(text).toContain("<FEFF004D00690061002000B7002000730075006D006D006100720079>");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);

    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
    expect(ascii(pdf, startxref, 4)).toBe("xref");
    const table = text.slice(startxref);
    const entries = [...table.matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(9);
    entries.forEach((offset, index) => {
      expect(ascii(pdf, offset, `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
    // The JPEG bytes sit in the stream untouched.
    const imageAt = text.indexOf("/DCTDecode");
    const streamAt = text.indexOf("stream\n", imageAt) + "stream\n".length;
    expect(Array.from(pdf.subarray(streamAt, streamAt + jpeg.length))).toEqual(Array.from(jpeg));
  });

  it("refuses an empty document", () => {
    expect(() => imagesToPdf([], "x")).toThrow();
  });
});
