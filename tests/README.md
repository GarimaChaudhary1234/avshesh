# Tests

Run everything (resets the local stack, mock AI, no AWS cost):

```
bash tests/run-all.sh
```

| Folder | What it checks | How it runs |
|---|---|---|
| `backend/src/test` | pure logic: ward polygons, profit rule, route order, limiter, catalog, AI answer parsing, photo cleanup, translation bundles, S3 storage against a fake client | `cd backend && ./mvnw test` |
| `tests/api` | the HTTP API: login and tokens, role x endpoint matrix, validation, uploads, pool rules, concurrency, OTP, ratings, municipal rules, abuse limits, phone proof, password reset, cookie login + CSRF, payment disputes, capacity, rating weights, home location, share kept out of the dump, the municipal hierarchy (commissioner, ward officers, activity, switching officers off) | `node tests/api/run.mjs` on a fresh database |
| `tests/api/no-otp.mjs` | the default setup: a new account can scan and list at once, without an SMS code | against a second backend started with `PHONE_VERIFICATION_REQUIRED=false` |
| `tests/api/shared-limit.mjs` | limits are shared by two backend instances through Redis | started by `run-all.sh` with a second backend container |
| `tests/api/audit.mjs` | the figures are consistent across the whole database: every impact event comes from one finished stop, payments and margins follow the written-down rates, statuses of listings, stops, pickups and pools agree, and the API numbers (public impact, every ward, the city, dealer earnings, household homes, ward overviews) equal what the tables add up to | against the running stack; `run-all.sh` runs it after the API tests and after the browser tests, and it can be run by hand on any stack (also the rich demo) |
| `tests/e2e` | real browser (Edge or Chrome): the three user journeys, sessions, registration, 360 px phone layout, accessibility, double clicks, big photos, Hindi/Odia, phone proof, password reset, payment dispute, install and offline listing queue, map location picker, dump-share cards, municipal desktop layout, commissioner and ward screens | `cd tests/e2e && npm install && node run.mjs` on a fresh database |

The API and browser tests change data. Reset the stack before running them again:
`docker compose down -v && SCANNER=mock docker compose up -d`.
Set `JWT_SECRET` (the same value as the backend) to also check expired-token handling.

The frontend translations are checked by `cd frontend && npm run i18n` (also run by `run-all.sh`).
API tests register users from fake network addresses by talking to the backend on port 8080 (nginx overwrites `X-Forwarded-For`).
Not covered by any test: real SMS through SNS, browsers other than Edge, Hindi/Odia wording quality.
Address search is replaced by a fixed list (`GEO_PROVIDER=static`) and map tiles by a blank image in tests, so they never call public servers.
The main test stack runs with `PHONE_VERIFICATION_REQUIRED=true` so that the phone-proof flow is tested; the app itself defaults to off.
`tests/api/rich-demo.mjs` is run by hand against a stack with the default (rich) demo data: `docker compose down -v && docker compose up -d && node tests/api/rich-demo.mjs`.
