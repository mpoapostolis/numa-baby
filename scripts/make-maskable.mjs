// Generates the app icons from public/icon-512.png.
//
// - icon-192.png: the same artwork at 192px.
// - icon-maskable-*.png: the artwork scaled to 80% (the maskable safe zone)
//   and centered on a square filled with the app's light background color.
//
// Every output is palette-quantised. The icons are flat artwork with a few
// thousand colours, and as 24-bit PNGs the four of them weighed half a
// megabyte — a third of the whole service-worker precache, downloaded by every
// first-time visitor on mobile data before they had logged a single feed.
// As indexed PNGs they weigh a tenth of that and look the same.
//
// Run via: npm run icons
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);
const source = fileURLToPath(new URL("icon-512.png", publicDir));
const background = "#f7f6f2";
const palette = { palette: true, quality: 90, compressionLevel: 9, effort: 10 };

async function write(pipeline, name) {
  const target = fileURLToPath(new URL(name, publicDir));
  const info = await pipeline.png(palette).toFile(target);
  console.log(`wrote ${target} (${info.size} bytes)`);
}

async function makeMaskable(size) {
  const artworkSize = Math.round(size * 0.8);
  const offset = Math.round((size - artworkSize) / 2);
  const artwork = await sharp(source)
    .resize(artworkSize, artworkSize, { fit: "contain" })
    .png()
    .toBuffer();

  await write(
    sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background,
      },
    }).composite([{ input: artwork, left: offset, top: offset }]),
    `icon-maskable-${size}.png`,
  );
}

await write(sharp(source).resize(192, 192, { fit: "contain" }), "icon-192.png");
await Promise.all([makeMaskable(512), makeMaskable(192)]);
