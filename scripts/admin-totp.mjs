// Turn on the second factor for /admin — without anyone but you ever seeing
// the secret. It is generated here, on your machine, printed once as a QR for
// your authenticator app, and then it is your job to put it in Cloudflare.
//
//   node scripts/admin-totp.mjs
//
// Nothing is written to disk, and nothing leaves this terminal.

import qrcode from "qrcode-generator";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = new Uint8Array(20);
crypto.getRandomValues(bytes);

let bits = 0;
let value = 0;
let secret = "";
for (const byte of bytes) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) {
    bits -= 5;
    secret += BASE32[(value >>> bits) & 31];
  }
}
if (bits > 0) secret += BASE32[(value << (5 - bits)) & 31];

const url =
  "otpauth://totp/Numa%20admin?secret=" + secret + "&issuer=Numa&algorithm=SHA1&digits=6&period=30";

const qr = qrcode(0, "M");
qr.addData(url);
qr.make();
const size = qr.getModuleCount();
const dark = (row, col) => (row < 0 || row >= size || col < 0 || col >= size ? false : qr.isDark(row, col));

// Two rows per character cell, so the code stays square in a terminal.
const pad = "  ";
console.log("");
for (let row = -2; row < size + 2; row += 2) {
  let line = pad;
  for (let col = -2; col < size + 2; col++) {
    const top = dark(row, col);
    const bottom = dark(row + 1, col);
    line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
  }
  console.log(line);
}

console.log(`
  Scan that with Google Authenticator, 1Password, Aegis — anything.
  If the QR will not scan, type the secret in by hand:

      ${secret.match(/.{1,4}/g).join(" ")}

  Then hand the same secret to Cloudflare, and only then:

      npx wrangler secret put ADMIN_TOTP_SECRET
      npx wrangler deploy

  From that moment /admin wants the password AND a fresh 6-digit code.
  Lost the phone? Remove the secret and you are back to password only:

      npx wrangler secret delete ADMIN_TOTP_SECRET
`);
