# Accounts, personal pools and admin

Frontend: GitHub Pages. Google Identity Services loads only when the account dialog opens. The default locale remains Vietnamese. Google client configuration is public in `counter/google-auth-config.json`; no client secret is used.

The Google ID token is kept in page memory, never localStorage/D1. Reloading the page requires signing in again. Requests use an Authorization bearer header (no third-party cookies). The Worker verifies RS256 signatures against Google's cached JWKS plus issuer, audience, subject, issued-at and expiration. The browser binds each sign-in response to a fresh nonce.

D1 stores one `user_food_profiles` row per Google subject with the pool JSON, revision and timestamps. A first GET does not create a row. PUT saves using compare-and-swap; a stale editor receives 409 and must reload. DELETE removes the caller's active profile. Personal pools are never globally published. Only the subject is stored, not email/name/avatar or bearer tokens.

Custom dishes: up to 50; name 1–60 characters; whole-thousand VND price 10–500; vegetarian flag. Stable UUID identifies each custom dish. Built-in IDs use the existing image IDs. Empty pools and unknown built-in IDs are rejected. API bodies are bounded to 32 KiB and profile routes have a separate IP rate limiter (60/minute).

Selection uses the same price-weight model on the currently eligible personal pool. If requested mean lies outside that pool's minimum/maximum prices, use the closest feasible mean and display it. No eligible vegetarian dishes disables spinning. Gold remains determined by price. Reel card slots and transforms never rebase after pool changes.

Admin URL: `https://shishiba389.github.io/-n-g-c-ng-c/#admin` (hash route works with static Pages). Every admin API request checks the verified Google identity. The initial owner is matched against the `ADMIN_GOOGLE_EMAIL` Worker secret; it must be an exact verified @gmail.com address. Account data is keyed by Google subject, not email.

`GET /admin/summary` returns estimated spins, saved profile count, custom dish count, profiles updated within 24h and D1 query latency. It is fetched on entry and manual refresh only, with no polling and no extra per-spin writes. Saved profile count is explicitly not total sign-ins. Infrastructure traffic, errors, CPU and billing remain in the Cloudflare dashboard; these are not duplicated in D1.

## Validation

- `node tests/accounts.mjs`: bundled Worker in Miniflare with real RSA-signed test tokens and mocked Google JWKS. Tests wrong audience, expired/tampered tokens, admin rejection, profile isolation, stale writes, validation, deletion and CORS.
- `node tests/personal-pool.cjs`: empty/single-item pools, catalog IDs, price extremes and target mean behavior.
- `node tests/selection.cjs`: existing 700k-draw probability regression.
- `npx tsc --noEmit` and `npm run build:pages`.

The installed local workerd supports compatibility through 2026-05-22, so the API tests use that date. Production retains 2026-09-08.

## Operations

Migration: `counter/migrations/0002_profiles.sql`. Set `ADMIN_GOOGLE_EMAIL` via Wrangler secrets before deploying. Local development secrets belong in ignored `counter/.dev.vars`. Deploy the Worker before the frontend. Account routes are separate from `/spins`, preserving old clients.
