// The social-share card, generated rather than hand-made so a rename is a
// re-run instead of a design session. SVG rendered by sharp at exactly the
// 1200x630 the meta tags promise. Palette matches tokens.css light mode.
import sharp from "sharp";

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#fdf5f2"/>
  <circle cx="1050" cy="90" r="220" fill="#f6e3de"/>
  <circle cx="120" cy="560" r="180" fill="#f0e7db"/>
  <!-- the moon-and-bottle mark, big and soft -->
  <g transform="translate(120,150)" stroke="#8d5f68" stroke-width="7" fill="none" stroke-linecap="round">
    <circle cx="60" cy="60" r="52"/>
    <path d="M 38 48 q 6 -14 20 -16" />
    <circle cx="44" cy="66" r="3.5" fill="#8d5f68" stroke="none"/>
    <circle cx="76" cy="66" r="3.5" fill="#8d5f68" stroke="none"/>
    <path d="M 52 82 q 8 7 16 0" />
  </g>
  <text x="120" y="360" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="#3d3436">Numalog</text>
  <text x="120" y="430" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#6d6265">Calm, private baby tracker</text>
  <text x="120" y="510" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="#8d8286">Free · No account · Your entries stay on your phone</text>
  <text x="120" y="556" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="#8d8286">numalog.app</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-baby-tracker.png");
console.log("wrote public/og-baby-tracker.png");
