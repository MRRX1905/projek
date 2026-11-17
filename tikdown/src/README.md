# TikDown — RAWGRAB Utility 001

Raw neo-brutalist TikTok downloader. Paste a video link you have permission to save, fetch the files the provider actually returns, download them to your device.

## Run (no build step)

This generator is **Perchance native** — `main.pjs` + `index.html` + `src/` ES modules. It mirrors the React/Vite spec 1:1 without a bundler:

| Spec component | Implementation |
|---|---|
| `Header` | `src/components/Header.js` |
| `Hero` | static markup in `index.html` + live labels via `StatusBar.js` |
| `DownloaderForm` | `src/components/DownloaderForm.js` |
| `VideoResult` | `src/components/VideoResult.js` |
| `DownloadOptions` | `src/components/DownloadOptions.js` |
| `HowItWorks` | static markup in `index.html` |
| `StatusBar` | `src/components/StatusBar.js` |
| `Footer` | `src/components/Footer.js` |
| Provider adapter | `src/tiktokProvider.js` (`resolveVideo` / `getDownloadOptions` / `getProviderStatus`) |
| Validation | `src/validation.js` |
| Store | `src/state.js` |
| Orchestrator (`App.tsx`) | `src/app.js` |

Just open the generator (or `page_refresh` in the editor) — `src/app.js` boots automatically.

## Provider (no credentials needed)

- **Primary: TikWM** `https://www.tikwm.com/api/?url=` — maintained free API, no key. Returns `play` (no watermark), `wmplay` (watermark), `music`, `cover`, `title`, `author`, `duration`, `size`. Verified working 2026-10-27 from a real browser (code 0 + CORS-open `video/mp4` CDN).
- **Fallback: TikTok official oEmbed** `https://www.tiktok.com/oembed?url=` — metadata only, no files. Surfaced as "METADATA ONLY", never as fake download buttons.
- **Demo mode**: explicit `LOAD DEMO SAMPLE` button. Public-domain sample file, banner-labeled `DEMO MODE — SAMPLE METADATA`, never presented as TikTok content.

Only download qualities the provider actually returns are offered. Expired CDN links (403/410) prompt a RE-FETCH. Downloads are fetched as blobs with a 60 s timeout, 100 MB cap and content-type check, then saved via `<a download>`; if the blob fetch fails a clearly-labeled "open directly" link is offered.

## Validation rules

Host allowlist: `tiktok.com` (+ `www`, `m`, `vm`, `vt` and any `*.tiktok.com`). Path must contain a video shape (`/@user/video/<id>`, `/video/<id>`, `/v/<id>`, `/t/<code>`, short-code). Rejected with specific messages: empty, malformed, non-TikTok host, profile/homepage, sound/hashtag/live pages, missing video ID. Whitespace is trimmed; Enter submits; duplicate submits while checking/saving are dropped.

## Status values

`SYSTEM STATUS` mirrors the store: `READY` (idle), `CHECKING…`, `READY` / `READY (META ONLY)`, `FAULT`, `SAVING FILE…`. `PROVIDER` shows the last real probe (`UNCHECKED` → `TIKWM · ONLINE` / `DEGRADED` / `UNREACHABLE`) — never claims ONLINE without a check.

## Security notes

- No secrets in frontend code or `main.pjs` (none needed). `superFetch` (platform CORS proxy) is used only as a network fallback, never for credentials.
- Provider URLs only (`https:`); non-http(s) refused. Response cap 2 MB JSON / 100 MB file. 15 s lookup timeout, 60 s download timeout.
- Submitted links are used for lookup only and are not persisted anywhere (no `localStorage` of URLs).
- Private / deleted / region-blocked videos fail with plain errors by design. Respect creators, copyright, privacy and TikTok's terms.

## Windows local run (Vite eject outline)

To run this outside Perchance with Node on Windows:

1. Install Node LTS, then `npm create vite@latest tikdown -- --template react-ts && cd tikdown && npm install`.
2. Copy `src/validation.js` → `src/lib/validation.ts`, `src/tiktokProvider.js` → `src/lib/provider.ts` (add types), and port each `src/components/*.js` to a `.tsx` component 1:1 (state in `src/state.ts` via Zustand or React context).
3. Keep the provider calls server-side: add a tiny Express route `GET /api/resolve?url=` that re-runs the same allowlist validation, enforces SSRF guards (resolve DNS, reject private ranges, no redirects to private IPs), 15 s timeout, 2 MB cap, 1 req/s per-IP rate limit — then forwards to TikWM/oEmbed and returns the normalized video JSON. The frontend must call your `/api/resolve`, never TikWM directly, and stream files via `/api/file?u=<provider-url>` after re-validating the host against `*.tiktokcdn*.com`.
4. `npm run dev` → open `http://localhost:5173`. `npm run build` for production.

## Test checklist

- Valid video link → metadata + real download buttons; each button saves the correct file.
- Empty / malformed / youtube.com / profile-only / hashtag link → specific inline error, no request sent.
- Provider rate-limit message → `RATE_LIMITED` error with wait-and-retry advice.
- Double-click FETCH → single request (second submit dropped).
- RE-FETCH after expiry → fresh links. Demo sample → labeled banner + working sample download.
- Desktop 1920 + mobile 390: no horizontal overflow, buttons full-width, facts readable.

## Status report

- **FUNCTIONAL**: validation, live TikWM lookup, oEmbed fallback, honest download options, blob downloads with expiry/size/type handling, demo mode, status strip, responsive + a11y, privacy/terms/contact notices.
- **NEEDS CREDENTIALS**: nothing — both providers are keyless. A custom Node backend (outline above) is optional hardening, not required.
- **DEMO**: demo-sample mode only (explicit, labeled). No real TikTok content is ever faked.
