import { writeFileSync } from "node:fs";
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
writeFileSync("worker/buildInfo.ts", `// Written by scripts/stamp-worker.mjs before every deploy - never edit by hand.
export const WORKER_BUILD = "${stamp}";
`);
console.log("worker build stamped:", stamp);
