# Baby Tracker

A calm, local-first baby tracker designed for one tired hand at 3am.

**Live app: [numa-baby.mpoapostolis.workers.dev](https://numa-baby.mpoapostolis.workers.dev)** — free, no account, installable as a PWA.

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

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run lint
npm test
```

## Stack

- React 19
- Vite 8
- TypeScript
- Lucide icons
- localStorage persistence
- Workbox service worker via `vite-plugin-pwa`
- Cloudflare static-assets deployment with SPA fallback

## Deploy

```bash
npm run build
```

Use `npm run build` as the Cloudflare build command and `dist` as the output directory. No Node server or database is required; `wrangler.jsonc` also contains the SPA fallback configuration for CLI deployments.

## License

[MIT](LICENSE) — use it, fork it, ship it for your own tiny human.
