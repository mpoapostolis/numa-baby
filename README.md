# Numalog

A calm, local-first baby tracker designed for one tired hand at 3am.

**Live app: [numalog.app](https://numalog.app)** — free, no account, installable as a PWA. (The original address, [numa-baby.mpoapostolis.workers.dev](https://numa-baby.mpoapostolis.workers.dev), keeps working — every family that started there can stay there.)

Built by a new dad for his own daughter, because every baby app we tried wanted a subscription or showed ads between diaper logs. Full disclosure: the codebase is 100% vibe coded (written with Claude Code). It turned out genuinely useful, so feel free to use it.

## What it tracks

- bottle feeds and nursing timers (with next-side memory)
- wet, dirty, or mixed diapers
- a burping stopwatch for the stretch after a feed
- weight, length, and head circumference
- temperature and free-form health notes
- optional notes on feeds, diapers, and growth checks
- daily summaries, timelines, seven-day patterns, and growth trends

## What it tells you

- a welcome hero with the baby's live age and a day counter
- "right now your baby may be…" — a stage list per age bracket, plus a
  rotating fact of the day; every claim links to its source (AAP,
  WHO, NHS, AAO) and nothing ships without a verified page behind it
- a care guide that answers "what do I do today" for the baby's exact
  age — feeding, nappy output, tummy time, burping — and a standing
  "when to call someone" list with exact thresholds
- feed forecasts learned from your own pattern
- a growth guide built on the WHO child growth standards

Not a medical device — always follow your paediatrician's advice.

## Privacy

No account is required. By default baby data stays in the browser's local storage on the device where it was entered, and JSON backup and restore are available from the app.

Two things do leave the device, and both are stated in the app:

- **Family Sync (opt-in).** Turning it on stores your entries in your family's own space in a hosted database, so a second phone can share the log. Leave the family and the phone keeps its data and stops syncing.
- **Anonymous usage statistics.** The app loads Google Analytics to count page views. It never receives your baby's entries — those are not sent anywhere except through Family Sync, if you enable it.

## Family Sync service

The optional sync API is a Cloudflare Worker (`worker/index.ts`) backed by a
Turso (libSQL) database. The worker assumes its schema already exists; create
it with:

```bash
turso db shell <database> < worker/schema.sql
```

Set `TURSO_DATABASE_URL` in `wrangler.jsonc` and the token as a secret:

```bash
turso db tokens create <database> | npx wrangler secret put TURSO_AUTH_TOKEN
```

## Moving to a new domain

Read this before pointing a new domain at the app.

`localStorage` belongs to an **origin**. `numa-baby.workers.dev` and a new
domain are two different origins, so **a redirect does not move anybody's log —
it hides it.** Their entries stay in the old origin's storage and the redirect
guarantees they can never load the page that could read them. Not lost, not
reachable: the worst of both.

So:

1. Add the new domain as a **second custom domain on the same Worker**. Do not
   redirect, and do not retire the old address — every existing user's log
   lives there.
2. Add the new origin to `PRODUCTION_ORIGINS` in
   [src/domain/handoff.ts](src/domain/handoff.ts) and deploy. That one line is
   what turns the move on: with a single entry there is nowhere to move a log
   to, so the app never offers.
3. Anyone landing on the new address now sees *"Bring my log from
   numa-baby.workers.dev"* on the setup screen and in Settings → Backups.

The move itself never touches the network. The new address sends the person to
`OLD/handoff#to=<new origin>` — a top-level navigation, because an iframe would
be given partitioned storage and see nothing — the old address shows them what
is about to be handed over and to whom, and on confirmation sends them back to
`NEW/#numa-handoff=<the backup, gzipped>`. Fragments are never sent to a
server. The receiving side then runs the ordinary backup-import path: the same
validation, the same confirmation, the same rollback copy. Nothing is deleted
from the old address.

The security of all of it is the allowlist in that one file. The old address
will hand a complete infant health record to whatever origin it is asked to, so
the target is matched exactly — no wildcards, no subdomain matching, no "starts
with" — and production and development addresses are kept in separate bands, or
a link to `PROD/handoff#to=http://localhost:3000` would post someone's records
to whatever is running on their own machine.

## The operator dashboard

`/admin` shows what the sync service is doing: how many families exist, how
many are still logging, how deep usage goes, the pairing funnel, and the
messages people have sent through the app. It is **aggregate only** — no entry
contents, no baby names, no device labels. Family ids are truncated.

It exists only if you give it a password. Without one, `/admin` and every
`/api/admin/*` route answer `404`:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

One optional secret tightens it further, and can be removed again:

```bash
# Only these addresses may even see the page; everyone else gets a 404.
npx wrangler secret put ADMIN_ALLOW_IPS   # e.g. 203.0.113.7, 198.51.100.4
```

Guessing is what the lockout stops, not the password's own strength. The budget
is spent **before** the password is looked at, in one atomic statement, so a
thousand simultaneous guesses draw a thousand different numbers and only the
first few are ever compared — counting failures afterwards would have let all
thousand through. Five tries per address per quarter hour, twenty across the
whole endpoint, and the door shuts. Each subsequent lock on the same address
doubles, up to a day.

Which raises the obvious objection: a stranger can spend that budget on purpose
and shut *you* out of your own dashboard. So a browser that has signed in here
before is remembered for a year, and **a remembered browser skips the locks
entirely** — it still has to know the password, it just never queues. Sign in
once on your laptop and once on your phone and no lockout, yours or anyone
else's, will ever hold you up again.

Every attempt, right or wrong, is listed on the dashboard with its address and
country, alongside the browsers that skip the queue.

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run check   # typecheck, lint, unit tests, build, build-output checks
npm test        # unit tests only, a few seconds
```

CI runs the same `check` on every push and pull request.

## Stack

- React 19
- Vite 8
- TypeScript
- Lucide icons
- localStorage persistence
- Workbox service worker via `vite-plugin-pwa`
- A Cloudflare Worker (`worker/`) serving `dist/` as static assets, with a
  real 404 page rather than an SPA fallback — every content page and the
  handoff route are emitted as their own files

## Deploy

```bash
npm run deploy
```

Builds `dist/` (typecheck, Vite, the prerendered pages) and runs `wrangler
deploy` against `wrangler.jsonc`. The Family Sync database is optional for
the static app but the Worker expects its bindings; see above.

## License

[MIT](LICENSE) — use it, fork it, ship it for your own tiny human.
