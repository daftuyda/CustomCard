# UmaCard

Generate shareable Umamusume profile cards from an in-game Trainer ID.

Live: <https://card.notvo.id>

![card preview](https://card.notvo.id/api/og/304265005615.png)

---

## What it does

Type a 9–12 digit Trainer ID and you get a profile card showing:

- Trainer name, club + tier (D → SS), full-body costume art of their borrowed umamusume
- Inheritance sparks (stat / aptitude / unique skill / white skill / race-win / scenario), with main-parent overlap highlighted
- Borrowed support card (name + type + rarity + LB stars)
- Trainer rank, total fans, average daily gain, parent affinity
- Per-trainer share URLs (`umacard.com/{id}`) that unfurl as image previews in Discord, Slack, iMessage, Twitter/X
- One-click PNG download or "Copy image" to clipboard

All data comes from <https://uma.moe>.

---

## Stack

- **Vite + React 18** for the SPA
- **Pure CSS** — no Tailwind, no styled-components, single dark "editorial racing program" theme
- **html-to-image** for PNG export from the browser
- **@resvg/resvg-js** + bundled Inter / Noto Sans JP fonts for server-side OG image rasterization
- **opentype.js** to convert OG text to SVG paths (resvg's Linux runtime drops `<text>` elements without it)
- **Vercel Node + Edge serverless functions** in `api/` for the OG image, the per-trainer HTML wrapper, and a CORS proxy for one uma.moe endpoint

---

## Project layout

```
api/
  og/[id].js     PNG OG image at /api/og/{id}.png — 1200×630 SVG → PNG
  og/fonts.js    Inter Bold + ExtraBold + Noto Sans JP, base64-embedded
  og/cards.js    Support-card name/type/rarity lookup
  page.js        Per-trainer HTML wrapper that injects og:image meta tags
  search.js      CORS proxy for uma.moe's /api/v3/search endpoint
public/
  icon.ico       Favicon
  _redirects     SPA fallback for Netlify/Cloudflare Pages
src/
  api/           Browser-side uma.moe client + profile aggregator
  components/    TrainerForm, ProfileCard, themes/ModernTheme
  data/          characters.json, supportCards.json, factors.json
  lib/           assets, format helpers, spark merger, lookups
  styles/        global.css
  App.jsx, App.css, main.jsx
index.html
vercel.json      SPA rewrite + functions config
```

---

## Local development

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # production build to dist/
```

Server-side functions in `api/` only run on Vercel. To smoke-test them locally, install `vercel` globally and use `vercel dev` instead.

---

## Deployment

### One-time setup

1. Push this repo to GitHub (or any provider Vercel supports).
2. Sign in at <https://vercel.com>, **Add New… → Project**, import the repo.
3. Vercel auto-detects Vite. Build command `npm run build`, output `dist`.

After step 3, Vercel auto-deploys on every push to `main` and creates preview deployments for every other branch / PR — no further config needed.

### Auto-deploy via GitHub Actions (alternative)

If you'd rather drive deployments from CI (e.g. you can't grant Vercel access to the repo), this project ships [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that runs `vercel --prod` on every push to `main`. To enable it, add three repo secrets:

- `VERCEL_TOKEN` — create at <https://vercel.com/account/tokens>
- `VERCEL_ORG_ID` — copy from `.vercel/project.json` after running `vercel link` once
- `VERCEL_PROJECT_ID` — same file

### Custom domain

Vercel project → **Settings → Domains → Add** → enter your domain, then add the DNS records Vercel shows you. HTTPS provisions automatically.

---

## How the OG embeds work

Per-trainer share URLs need crawler-friendly meta tags. Discord/Twitter/Slack don't run JS, so the SPA's client-rendered card is invisible to them. Two server-side pieces handle this:

1. [`api/page.js`](api/page.js) is a Node serverless function. `vercel.json` rewrites `/{9-12 digit id}` → `/api/page?id={id}`. The function fetches the static SPA shell, fetches the trainer name from uma.moe, and injects per-trainer `og:title` / `og:description` / `og:image` meta tags before responding. The SPA still boots normally for human visitors.
2. [`api/og/[id].js`](api/og/[id].js) is a Node serverless function at `/api/og/{id}.png`. It fetches the trainer profile, builds a 1200×630 SVG with the character art (base64-embedded so OG scrapers don't have to follow nested image references), and rasterizes it to PNG with `@resvg/resvg-js`. All text is converted to SVG paths server-side via opentype.js — resvg's Linux native binary doesn't reliably register `<text>` fonts in the Vercel runtime. Fonts are base64-embedded in [`api/og/fonts.js`](api/og/fonts.js) (~7 MB) so Vercel ships them inside the function bundle without needing `includeFiles` config.

CDN-cached for 5 minutes (300s) at the edge with stale-while-revalidate, so re-fetches are cheap.

---

## Acknowledgements

- [uma.moe](https://uma.moe) — all profile, circle, ranking, inheritance, and support-card data
- [Cygames](https://www.cygames.co.jp/) — Umamusume Pretty Derby
- [Inter](https://rsms.me/inter/) by Rasmus Andersson, [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) — fonts

Not affiliated with Cygames.
