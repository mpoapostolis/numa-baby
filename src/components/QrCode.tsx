// The invite code as a QR: the other phone points its camera at it, the
// system camera opens the join link, and the app picks the code out of the
// URL. No in-app scanner, so no camera permission is ever asked for.
//
// Drawn as one SVG path of merged runs rather than a rect per module — see
// qrPath, which is unit-tested against the matrix it renders.

import qrcode from "qrcode-generator";
import { qrPath } from "../domain/qrPath";

type QrCodeProps = {
  value: string;
  /** Rendered size in CSS pixels. The SVG scales; the module grid does not. */
  size?: number;
  label: string;
};

// Error correction M survives a smudged screen or a phone held at an angle
// without inflating the module count the way H does.
const EC_LEVEL = "M";
// A four-module quiet zone is the spec minimum for a reliable scan.
const QUIET = 4;

export function QrCode({ value, size = 176, label }: QrCodeProps) {
  const qr = qrcode(0, EC_LEVEL);
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const span = count + QUIET * 2;

  const path = qrPath((row, col) => qr.isDark(row, col), count, QUIET);

  return (
    <svg
      className="qr-code"
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      {/* The light field is painted, never left transparent: a dark theme
          behind a QR inverts it and no scanner will read it. */}
      <rect width={span} height={span} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
