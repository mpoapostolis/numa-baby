import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A fixed, non-UTC zone: the app's users are east and west of Greenwich and
// the bugs that bite them (a date-only birth date parsed as UTC midnight)
// are invisible when the suite happens to run in UTC. Auckland is +12/+13
// with DST, the harshest common case.
process.env.TZ = "Pacific/Auckland";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});
