/// <reference types="@cloudflare/workers-types" />
// The operator's window onto the sync service: how many families exist, how
// many phones are paired, whether anyone synced today. Served entirely from
// the Worker so none of it reaches the parent-facing bundle or the service
// worker cache.
//
// Deliberately AGGREGATE ONLY. Every row in `activities` is a health record
// about somebody's baby, and an operations dashboard is not a reason to read
// one. Nothing here selects `payload`, and nothing here selects a device
// label — labels are derived from a baby's name.
//
// Auth: a password held as a Worker secret (never in the database — the
// database is the thing being protected), compared in constant time, then
// exchanged for a short-lived HMAC-signed cookie so the password is sent once.

import { Client } from "@libsql/client/web";

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE = "nb_admin";

function timingSafeEqual(a: string, b: string): boolean {
  // Compare over a fixed length so a wrong password cannot be found one
  // character at a time by watching how long the answer takes.
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function mintSession(secret: string, now: number): Promise<string> {
  const expires = String(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
  return `${expires}.${await hmac(secret, expires)}`;
}

async function sessionValid(secret: string, cookie: string | null, now: number): Promise<boolean> {
  if (!cookie) return false;
  const value = cookie.split("; ").find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature) return false;
  if (Number(expires) * 1000 < now) return false;
  return timingSafeEqual(signature, await hmac(secret, expires));
}

function noStore(body: string, contentType: string, status = 200, extra: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
      // An operations page must never be indexed, framed, or referred out.
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      ...extra,
    },
  });
}

export async function handleAdminLogin(
  secret: string,
  request: Request,
  now: number,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const supplied = typeof body.password === "string" ? body.password : "";
  if (!timingSafeEqual(supplied, secret)) {
    // One message, one status, whether the password was empty or merely wrong.
    return noStore(JSON.stringify({ error: "Wrong password." }), "application/json", 401);
  }
  const session = await mintSession(secret, now);
  return noStore(JSON.stringify({ ok: true }), "application/json", 200, {
    "set-cookie": `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
  });
}

export function adminLogout(): Response {
  return noStore(JSON.stringify({ ok: true }), "application/json", 200, {
    "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
}

export async function handleAdminStats(
  client: Client,
  secret: string,
  request: Request,
  now: number,
): Promise<Response> {
  if (!(await sessionValid(secret, request.headers.get("cookie"), now))) {
    return noStore(JSON.stringify({ error: "Not signed in." }), "application/json", 401);
  }

  const [totals, families, daily, invites] = await Promise.all([
    client.execute(`
      select
        (select count(*) from families) as families,
        (select count(*) from devices) as devices,
        (select count(*) from activities) as entries,
        (select count(*) from activities where deleted = 1) as tombstones,
        (select count(*) from family_meta) as profiles
    `),
    // Per family: size and recency only. No payloads, no labels, and the id
    // is truncated so the page is useful without being a directory of who.
    client.execute(`
      select
        substr(f.id, 1, 8) as family,
        substr(f.created_at, 1, 10) as created,
        (select count(*) from devices d where d.family_id = f.id) as devices,
        (select count(*) from activities a where a.family_id = f.id) as entries,
        (select substr(max(a.updated_at), 1, 10) from activities a where a.family_id = f.id) as last_entry
      from families f
      order by f.created_at desc
    `),
    // Entries per day over the last fortnight — the one line that answers
    // "is this still being used".
    client.execute(`
      select substr(updated_at, 1, 10) as day, count(*) as entries
      from activities
      where updated_at >= datetime('now', '-14 days')
      group by day order by day
    `),
    client.execute(`
      select
        count(*) as total,
        sum(case when used_at is not null then 1 else 0 end) as used,
        sum(case when used_at is null and expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') then 1 else 0 end) as open
      from invites
    `),
  ]);

  return noStore(
    JSON.stringify({
      totals: totals.rows[0],
      invites: invites.rows[0],
      families: families.rows,
      daily: daily.rows,
      generatedAt: new Date(now).toISOString(),
    }),
    "application/json",
  );
}

// One self-contained page: no bundle, no framework, no third-party script,
// and the same Petal & Porcelain palette so it does not feel like a different
// product bolted on.
export function adminPage(): Response {
  return noStore(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Baby Tracker — service</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fdf5f2; --card: #fffdfc; --ink: #221a1d; --ink-2: #6b5a60;
    --line: #ecdcd6; --signal: #8d2f57;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #120c0f; --card: #1c1418; --ink: #f4e9ec; --ink-2: #b3a0a7; --line: #33262b; --signal: #f0a8c0; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--ink);
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 900px; margin: 0 auto; display: grid; gap: 20px; }
  h1 { font-size: 1.4rem; margin: 0; font-weight: 600; }
  .muted { color: var(--ink-2); font-size: .8125rem; margin: 0; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; }
  .stat b { display: block; font-size: 1.9rem; font-weight: 600; line-height: 1.1; }
  .stat span { color: var(--ink-2); font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-size: .7rem; text-transform: uppercase; letter-spacing: .06em;
    color: var(--ink-2); font-weight: 500; padding: 6px 8px; }
  td { padding: 8px; border-top: 1px solid var(--line); font-size: .875rem; }
  input, button { font: inherit; border-radius: 10px; border: 1px solid var(--line); padding: 12px 14px; }
  input { width: 100%; background: var(--bg); color: var(--ink); font-size: 16px; }
  button { background: var(--signal); color: #fff; border: 0; font-weight: 500; cursor: pointer; min-height: 48px; }
  .row { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .bars { display: flex; align-items: flex-end; gap: 3px; height: 64px; }
  .bars i { flex: 1; background: var(--signal); opacity: .75; border-radius: 3px 3px 0 0; min-height: 2px; }
  .err { color: #b3261e; font-size: .8125rem; margin: 8px 0 0; }
  .hide { display: none; }
</style>
</head>
<body>
<main>
  <div class="row">
    <div>
      <h1>Baby Tracker · service</h1>
      <p class="muted">Aggregate only — no entry contents, no device names.</p>
    </div>
    <button id="out" class="hide" style="background:transparent;color:var(--ink-2);border:1px solid var(--line)">Sign out</button>
  </div>

  <form id="login" class="card">
    <label class="muted" for="pw">Admin password</label>
    <input id="pw" type="password" autocomplete="current-password" style="margin-top:8px" />
    <button style="margin-top:12px;width:100%">Sign in</button>
    <p id="err" class="err hide"></p>
  </form>

  <div id="dash" class="hide" style="display:none">
    <div class="card"><div class="grid" id="totals"></div></div>
    <div class="card">
      <p class="muted" style="margin-bottom:10px">Entries synced per day · last 14 days</p>
      <div class="bars" id="bars"></div>
    </div>
    <div class="card" style="overflow-x:auto">
      <p class="muted" style="margin-bottom:6px">Families</p>
      <table><thead><tr><th>Family</th><th>Created</th><th>Devices</th><th>Entries</th><th>Last entry</th></tr></thead>
      <tbody id="fams"></tbody></table>
    </div>
    <p class="muted" id="stamp"></p>
  </div>
</main>
<script>
const $ = (id) => document.getElementById(id);
async function load() {
  const res = await fetch("/api/admin/stats");
  if (!res.ok) return false;
  const d = await res.json();
  $("totals").innerHTML = [
    ["Families", d.totals.families], ["Devices", d.totals.devices],
    ["Entries", d.totals.entries], ["Profiles", d.totals.profiles],
    ["Deleted", d.totals.tombstones], ["Open invites", d.invites.open ?? 0],
  ].map(([k, v]) => '<div class="stat"><b>' + v + '</b><span>' + k + '</span></div>').join("");
  const max = Math.max(1, ...d.daily.map((x) => x.entries));
  $("bars").innerHTML = d.daily.map((x) =>
    '<i style="height:' + Math.round((x.entries / max) * 100) + '%" title="' + x.day + ': ' + x.entries + '"></i>').join("");
  $("fams").innerHTML = d.families.map((f) =>
    '<tr><td>' + f.family + '</td><td>' + f.created + '</td><td>' + f.devices +
    '</td><td>' + f.entries + '</td><td>' + (f.last_entry || "—") + '</td></tr>').join("");
  $("stamp").textContent = "Generated " + d.generatedAt;
  $("login").style.display = "none";
  $("dash").style.display = "grid";
  $("dash").className = "";
  $("out").className = "";
  return true;
}
$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch("/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: $("pw").value }),
  });
  if (res.ok) { $("pw").value = ""; await load(); return; }
  $("err").textContent = "Wrong password.";
  $("err").className = "err";
});
$("out").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  location.reload();
});
load();
</script>
</body>
</html>`,
    "text/html; charset=utf-8",
  );
}
