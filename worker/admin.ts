/// <reference types="@cloudflare/workers-types" />
// The operator's door and the room behind it.
//
// This file is only the routing and the order of the gates; the lock itself
// lives in adminAuth.ts, the questions asked of the database in adminStats.ts,
// and the page in adminPage.ts.

import { Client } from "@libsql/client/web";
import {
  audit,
  browserIsKnown,
  callerOf,
  clearAttempts,
  createSession,
  destroySession,
  ensureAdminTables,
  GLOBAL_MAX_ATTEMPTS,
  ipAllowed,
  IP_MAX_ATTEMPTS,
  KNOWN_COOKIE,
  KNOWN_TTL_SECONDS,
  randomId,
  reserveAttempt,
  sessionValid,
  SESSION_TTL_SECONDS,
  trustBrowser,
  verifyPassword,
  type Caller,
} from "./adminAuth";
import { adminPageHtml } from "./adminPage";
import { collectStats } from "./adminStats";

export type AdminEnv = {
  /** Unset means the page does not exist at all. */
  ADMIN_PASSWORD?: string;
  /** Set it and every other address is told there is nothing here. */
  ADMIN_ALLOW_IPS?: string;
};

const COOKIE_FLAGS = "Path=/; HttpOnly; Secure; SameSite=Strict";

/**
 * The page has no dependencies, so it is allowed no connections: the only
 * script and style that may run are the two carrying this nonce.
 *
 * `style-src-attr` is not decoration. A nonce covers `<style>` and never
 * `style=""`, and under CSP3 style-src-attr falls back to style-src — so
 * without that line the browser silently drops every bar height on the page
 * and all ten charts render flat, with nothing in the console to say why. The
 * attribute values are numbers this worker computes; no database text ever
 * reaches them.
 */
export function adminCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function headers(extra: HeadersInit = {}): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    ...extra,
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: headers({ "content-type": "application/json", ...extra }),
  });
}

/** The answer to "there is nothing here", used both for an unconfigured
    password and for an address that is not on the list — an attacker learns
    the same thing from both, which is nothing. */
function notFound(): Response {
  return new Response("Not found", { status: 404, headers: headers() });
}

function tooManyTries(remainingMs: number): Response {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return json({ error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` }, 429, {
    "retry-after": String(Math.ceil(remainingMs / 1000)),
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------

async function login(
  client: Client,
  env: AdminEnv,
  request: Request,
  caller: Caller,
  now: number,
): Promise<Response> {
  const secret = env.ADMIN_PASSWORD as string;
  const ipScope = `ip:${caller.ip}`;

  await ensureAdminTables(client);

  // A browser that has signed in here before does not stand in the queue.
  //
  // This is the answer to the obvious objection to any lockout: a stranger can
  // spend the budget deliberately and shut the owner out of their own
  // dashboard, which turns a defence into a denial of service anyone can
  // trigger for the price of a few requests. They still can — and it stops
  // mattering, because the owner's laptop and phone are not in that queue.
  // Being known skips the locks. It does not skip the password.
  const known = await browserIsKnown(client, request, now);

  if (!known) {
    // The budget is spent HERE, before a single character is compared, and each
    // scope moves its counter in one atomic statement. A thousand simultaneous
    // guesses therefore draw a thousand different numbers and only the first
    // few go on to be checked. Counting failures after the check — the obvious
    // way to write this — would have let all thousand through.
    //
    // The address is asked first and ALONE. Spending both budgets together
    // would let one locked-out address keep draining the shared one: twenty
    // requests from a single machine already refused at the door would shut
    // every other door in the building.
    //
    // Not audited: a refusal costs nothing to send, so writing a row for each
    // one would hand an attacker a way to grow the table for free. The lock
    // itself is on the dashboard, and so are the attempts that caused it.
    const byAddress = await reserveAttempt(client, ipScope, now, IP_MAX_ATTEMPTS, true);
    if (!byAddress.allowed) return tooManyTries(byAddress.retryAfterMs);
    const overall = await reserveAttempt(client, "global", now, GLOBAL_MAX_ATTEMPTS, false);
    if (!overall.allowed) return tooManyTries(overall.retryAfterMs);
  }

  const body = await readBody(request);
  const password = typeof body.password === "string" ? body.password : "";

  if (!(await verifyPassword(secret, password))) {
    await audit(client, known ? "login_bad_known" : "login_bad", caller, now);
    // One message, one status, and no count of tries left — a counter is a map
    // of how hard to push.
    return json({ error: "Wrong password." }, 401);
  }

  const [session, trusted] = await Promise.all([
    createSession(client, caller, now),
    // Remembered from the first correct password onwards, so this browser is
    // never held up by a lock again — including one somebody else caused.
    known ? Promise.resolve(null) : trustBrowser(client, caller, now),
  ]);
  await Promise.all([
    clearAttempts(client, ipScope, true),
    clearAttempts(client, "global", false),
    audit(client, "login_ok", caller, now),
  ]);

  const response = json({ ok: true });
  response.headers.append("set-cookie", `nb_admin=${session}; ${COOKIE_FLAGS}; Max-Age=${SESSION_TTL_SECONDS}`);
  if (trusted) {
    response.headers.append(
      "set-cookie",
      `${KNOWN_COOKIE}=${trusted}; ${COOKIE_FLAGS}; Max-Age=${KNOWN_TTL_SECONDS}`,
    );
  }
  return response;
}

// ---------------------------------------------------------------------------

export async function handleAdmin(
  client: Client,
  env: AdminEnv,
  request: Request,
  url: URL,
  now: number,
): Promise<Response> {
  try {
    return await route(client, env, request, url, now);
  } catch (error) {
    // If the database cannot be reached, the budget cannot be spent — and an
    // attempt that was never paid for must never be checked. Failing shut is
    // the only safe direction here, and the reason says nothing.
    console.error("admin error", url.pathname, error);
    return json({ error: "The service is not answering. Try again shortly." }, 503);
  }
}

async function route(
  client: Client,
  env: AdminEnv,
  request: Request,
  url: URL,
  now: number,
): Promise<Response> {
  // No password configured means no dashboard — a secret nobody set must
  // never become an open door.
  if (!env.ADMIN_PASSWORD) return notFound();

  const caller = callerOf(request);
  // Deliberately before anything else, and deliberately silent: a blocked
  // address gets a 404 without a database round trip, so it cannot fill the
  // audit table or cost anything by trying.
  if (!ipAllowed(env.ADMIN_ALLOW_IPS, caller.ip)) return notFound();

  if (url.pathname === "/admin" && request.method === "GET") {
    const nonce = randomId();
    return new Response(adminPageHtml(nonce), {
      headers: headers({
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": adminCsp(nonce),
      }),
    });
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    return await login(client, env, request, caller, now);
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    const body = await readBody(request);
    await ensureAdminTables(client);
    // "Everywhere" empties the session table, so it is the one thing here that
    // a stranger must not be able to reach: without a live session this can
    // only delete the row matching a cookie the caller already holds, which
    // is to say their own, which is to say nothing.
    const signedIn = await sessionValid(client, request, now);
    await destroySession(client, request, signedIn && body.all === true);
    return json({ ok: true }, 200, { "set-cookie": `nb_admin=; ${COOKIE_FLAGS}; Max-Age=0` });
  }

  // Everything past here needs a live session.
  await ensureAdminTables(client);
  if (!(await sessionValid(client, request, now))) {
    return json({ error: "Not signed in." }, 401);
  }

  if (url.pathname === "/api/admin/stats" && request.method === "GET") {
    return json(await collectStats(client, now));
  }

  // The one write the dashboard makes: a message can be ticked off. Nothing
  // here deletes anything — not a message, and certainly not a family's log.
  if (url.pathname === "/api/admin/feedback" && request.method === "POST") {
    const body = await readBody(request);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return json({ error: "Which message?" }, 400);
    await client.execute({
      sql: "UPDATE feedback SET handled = ? WHERE id = ?",
      args: [body.handled ? 1 : 0, id],
    });
    return json({ ok: true });
  }

  return notFound();
}
