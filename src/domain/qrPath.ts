// Turning a QR module matrix into one SVG path. Kept out of the component so
// the risky part — the geometry — can be tested against the matrix it came
// from, rather than trusted by eye.

export type IsDark = (row: number, col: number) => boolean;

/**
 * Merge each row's dark modules into horizontal runs and emit them as one
 * path. A 33x33 code is ~1,000 modules; one path instead of a thousand rects
 * keeps both the DOM and the paint cheap.
 *
 * @param quiet modules of blank margin added on every side (4 is the spec
 *              minimum for a reliable scan)
 */
export function qrPath(isDark: IsDark, count: number, quiet: number): string {
  const runs: string[] = [];
  for (let row = 0; row < count; row++) {
    let start = -1;
    for (let col = 0; col <= count; col++) {
      const dark = col < count && isDark(row, col);
      if (dark && start === -1) start = col;
      if (!dark && start !== -1) {
        const width = col - start;
        runs.push(`M${start + quiet} ${row + quiet}h${width}v1h-${width}z`);
        start = -1;
      }
    }
  }
  return runs.join("");
}

/** Rebuild the module matrix a path draws — the inverse of qrPath, for tests. */
export function matrixFromPath(path: string, count: number, quiet: number): boolean[][] {
  const grid = Array.from({ length: count }, () => Array<boolean>(count).fill(false));
  const runPattern = /M(\d+) (\d+)h(\d+)v1h-\3z/g;
  let match: RegExpExecArray | null;
  while ((match = runPattern.exec(path)) !== null) {
    const col = Number(match[1]) - quiet;
    const row = Number(match[2]) - quiet;
    for (let i = 0; i < Number(match[3]); i++) grid[row][col + i] = true;
  }
  return grid;
}
