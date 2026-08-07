// Generates maskable PWA icons from public/icon-512.png.
// The artwork is scaled to 80% (the maskable safe zone) and centered on a
// square filled with the app's light background color (#f7f6f2).
// Run via: npm run icons
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);
const source = fileURLToPath(new URL("icon-512.png", publicDir));
const background = "#f7f6f2";

async function makeMaskable(size) {
  const artworkSize = Math.round(size * 0.8);
  const offset = Math.round((size - artworkSize) / 2);
  const artwork = await sharp(source)
    .resize(artworkSize, artworkSize, { fit: "contain" })
    .png()
    .toBuffer();
  const target = fileURLToPath(new URL(`icon-maskable-${size}.png`, publicDir));

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: artwork, left: offset, top: offset }])
    .png()
    .toFile(target);

  console.log(`wrote ${target}`);
}

await Promise.all([makeMaskable(512), makeMaskable(192)]);
