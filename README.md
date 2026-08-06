# Baby Tracker

A calm, local-first baby tracker designed for one tired hand and a full desktop workspace.

[Open the private live preview](https://numa-baby-tracker.mpoapostolis.chatgpt.site)

## What it tracks

- bottle feeds and nursing timers
- wet, dirty, or mixed diapers
- sleep timers with exact start and stop times
- weight, length, and head circumference
- temperature and free-form health notes
- optional notes on feeds, diapers, and growth checks
- daily summaries, timelines, seven-day patterns, and growth trends

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
