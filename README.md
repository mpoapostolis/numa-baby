# Baby Tracker

A calm, local-first baby tracker designed for one tired hand at 3am.

**Live app: [numa-baby.mpoapostolis.workers.dev](https://numa-baby.mpoapostolis.workers.dev)** — free, no account, installable as a PWA.

Built by a new dad for his own daughter, because every baby app we tried wanted a subscription or showed ads between diaper logs. Full disclosure: the codebase is 100% vibe coded (written with Claude Code). It turned out genuinely useful, so feel free to use it.

## What it tracks

- bottle feeds and nursing timers (with next-side memory)
- wet, dirty, or mixed diapers
- sleep timers with exact start and stop times
- weight, length, and head circumference
- temperature and free-form health notes
- optional notes on feeds, diapers, and growth checks
- daily summaries, timelines, seven-day patterns, and growth trends

## What it tells you

- a welcome hero with the baby's live age and a day counter
- "right now your baby may be…" — a stage list per age bracket, plus a
  rotating fact of the day; every claim links to its source (AAP,
  WHO, NHS, AAO) and nothing ships without a verified page behind it
- feed/sleep forecasts learned from your own pattern
- a growth guide built on the WHO child growth standards

Not a medical device — always follow your paediatrician's advice.

## Privacy

The current version has no account and no cloud database. Baby data stays in the browser's local storage on the device where it was entered. Private JSON backup and restore are available from the app.

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
