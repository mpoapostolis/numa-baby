import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Baby Tracker application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Baby Tracker — Calm, private baby logging<\/title>/i);
  assert.match(html, /aria-label="Loading Baby Tracker"/i);
  assert.match(html, /og-baby-tracker\.png/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.doesNotMatch(html, />Numa</i);
});

test("keeps local-first tracking and the desktop workspace in the product source", async () => {
  const [page, css, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /function ActiveTimerCard/);
  assert.match(page, /Started at/);
  assert.match(page, /aria-live="polite"/);
  assert.match(css, /Full desktop workspace/);
  assert.match(css, /grid-template-columns:\s*252px minmax\(0, 1fr\)/);
  assert.match(manifest, /short_name:\s*"Baby Tracker"/);
});
