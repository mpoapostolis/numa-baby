// The announcement composer, on your machine only.
//
//   npm run broadcast
//
// WHY THIS IS NOT A PAGE IN THE ADMIN DASHBOARD. Sending an announcement puts
// a line on every subscribed lock screen, in rooms with sleeping babies, and
// it cannot be recalled. A button that does that should take a deliberate act
// to reach — starting a program on your own laptop — rather than sitting one
// stray tap away from the numbers you look at every day. The DANGEROUS half
// still lives in the Worker behind the admin password, audit log and lockout,
// because that is the only place a real boundary can be; this is the part
// that decides how easy it is to press.
//
// Nothing here is a second way in. It signs in with the same password, over
// the same endpoint, and gets the same session cookie any browser would.
//
// The password is read once, into this process, and never reaches the page:
// the browser talks to 127.0.0.1, this process talks to the Worker. That also
// sidesteps CORS entirely — an admin endpoint that answered a cross-origin
// request from localhost would be a hole cut in the dashboard for the
// convenience of a tool.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.BROADCAST_TARGET ?? "https://numalog.app";
const PORT = Number(process.env.BROADCAST_PORT ?? 8788);

/**
 * Asked on the terminal, with the typing hidden.
 *
 * Two things here are scar tissue. The echo is silenced through readline's
 * own _writeToOutput and never by reassigning rl.output.write — rl.output IS
 * process.stdout, so that replaced the process's stdout with a no-op for
 * good and every later console.log vanished, the address to open among them.
 * And the prompt is passed to question() rather than written before the
 * interface exists, because a terminal-mode interface redraws the line it
 * starts on and ate it.
 *
 * It also re-asks instead of giving up. A blank first answer is how this
 * reads when stdin is not what anyone expected, and "no password, no
 * composer" as the whole story is not a program being helpful.
 */
function askPassword(attempt = 0) {
  if (process.env.ADMIN_PASSWORD) return Promise.resolve(process.env.ADMIN_PASSWORD);
  if (!process.stdin.isTTY) {
    console.error(
      "\n  Nothing to type into: stdin is not a terminal.\n" +
        "  Run it with the password in the environment instead:\n\n" +
        "    ADMIN_PASSWORD='…' npm run broadcast\n",
    );
    return Promise.resolve("");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let hide = false;
  rl._writeToOutput = (chunk) => { if (!hide) rl.output.write(chunk); };

  let gaveUp = false;
  return new Promise((resolve) => {
    // Ctrl-D never calls the callback, and a promise that never settles is a
    // program that hangs with nothing on screen to explain itself.
    rl.on("close", () => { gaveUp = true; resolve(""); });
    rl.question(`Admin password for ${TARGET}: `, (answer) => {
      hide = false;
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    hide = true;
  }).then((answer) => {
    // Re-ask only for a genuinely empty ANSWER. A closed input has nothing
    // left to re-ask, and looping on it just prints the prompt at a wall.
    if (answer || gaveUp || attempt >= 2) return answer;
    console.log("  Nothing typed. Try again, or Ctrl-C to stop.");
    return askPassword(attempt + 1);
  });
}

let password = "";
let cookie = "";

/** Sign in and keep the session cookie in this process. */
async function signIn() {
  const response = await fetch(`${TARGET}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Sign-in failed (${response.status})`);
  }
  // Keep only the session cookie's name=value pairs, not their attributes.
  cookie = (response.headers.getSetCookie?.() ?? [])
    .map((line) => line.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Signed in but no session cookie came back.");
}

/** One call to the Worker, signing in first, and once more if the session
    expired while the composer was left open. */
async function callWorker(path, init = {}, retry = true) {
  if (!cookie) await signIn();
  const response = await fetch(`${TARGET}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });
  if (response.status === 401 && retry) {
    cookie = "";
    return callWorker(path, init, false);
  }
  return response;
}

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

/** Pass one Worker response straight through, so an error message written
    once in worker/broadcast.ts is the message the composer shows. */
async function relay(res, response) {
  const body = await response.text();
  res.writeHead(response.status, { "content-type": "application/json" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await readFile(join(here, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const [broadcast, stats] = await Promise.all([
        callWorker("/api/admin/broadcast").then((r) => r.json()),
        callWorker("/api/admin/stats").then((r) => r.json()).catch(() => ({})),
      ]);
      return json(res, 200, { ...broadcast, phones: stats.push?.phones ?? null, target: TARGET });
    }

    if (req.method === "GET" && url.pathname === "/api/recipients") {
      // Names and ages. They exist nowhere else in the tooling and they stay
      // on this machine — see the note at the top of worker/broadcast.ts.
      return relay(res, await callWorker("/api/admin/recipients"));
    }

    if (req.method === "POST" && url.pathname === "/api/send") {
      const body = await readJson(req);
      return relay(res, await callWorker("/api/admin/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
    }

    if (req.method === "POST" && url.pathname === "/api/stop") {
      return relay(res, await callWorker("/api/admin/broadcast/stop", { method: "POST" }));
    }

    json(res, 404, { error: "No such thing here." });
  } catch (error) {
    json(res, 502, { error: String(error.message ?? error) });
  }
});

password = await askPassword();
if (!password) {
  console.error("No password, no composer.");
  process.exit(1);
}

// 127.0.0.1, never 0.0.0.0: this holds a live admin session, and it has no
// business being reachable from the coffee shop's network.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Announcement composer → ${TARGET}`);
  console.log(`  http://127.0.0.1:${PORT}\n`);
  console.log("  The password stays in this process. Ctrl-C ends the session.\n");
});
