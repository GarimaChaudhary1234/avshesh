# Avshesh: architecture

Avshesh turns neighbourhood waste into income. A household photographs waste, an AI identifies it, and
the listing joins a **Mohalla Pool**. A pickup is scheduled only when the pooled load is profitable for a
scrap dealer or compost center. Waste nobody buys goes to the **municipal corporation**, and hazardous
waste goes to authorised **drop-off points**.

## 1. Overview

```
 React (Vite + Tailwind)  ─REST/JSON, JWT cookie─▶  Spring Boot API  ──▶  PostgreSQL
   household / dealer /                             │
   compost / municipal / public impact              ├──▶ Amazon Bedrock (Nova Lite)   photo → item code
                                                    ├──▶ Redis                        shared rate limits
                                                    ├──▶ SMS (log now, SNS)           phone codes, pickup alerts
                                                    └──▶ local disk (S3 later)        scan photos
```

| Layer | Local (Docker Compose) | AWS (planned) |
|---|---|---|
| Frontend | nginx serving the Vite build, proxies `/api` to the backend (`localhost:8088`) | Amplify or App Runner |
| Backend | Spring Boot 4, Java 17 (`localhost:8080`) | App Runner (image from ECR) |
| Database | PostgreSQL 16 (`localhost:5433`) | RDS PostgreSQL |
| AI | `SCANNER=mock` (user names the item) or `SCANNER=bedrock` | Bedrock, via an IAM role (no keys) |
| Photos | `uploads/` volume | S3 (`S3PhotoStorage`, profile `aws`; unit-tested with a fake client only) |
| Notifications | in-app inbox + SMS to the log (`LogSmsSender`) | inbox + SMS through SNS (`avshesh.sms.sender=sns`, **untested**: needs a real AWS account) |
| Shared limits | Redis 7 container | ElastiCache (**untested**) |
| Metrics | Prometheus endpoint on internal port 8081 (not published) | CloudWatch alarms, see `infra/cloudwatch-alarms.yaml` (**untested draft**) |

Run it: `docker compose up --build -d`, then open <http://localhost:8088>. Copy `.env.example` to `.env`
to switch the scanner to Bedrock.

## 2. Roles and access

| Role | Can do | Enforced by |
|---|---|---|
| `HOUSEHOLD` | scan, list waste, join pools, rate dealers, request municipal pickup | `@HouseholdOnly` |
| `KABADIWALA` (scrap dealer), `COMPOST` | business profile, rate card, accept pools, collect, earnings | `@CollectorOnly` |
| `MUNICIPAL` | verify dealers, manage staff, requests and drop-off points of **their ward** | `@MunicipalOnly` + `MunicipalScope` |
| public | impact dashboard, catalog, scan mode | open routes in `SecurityConfig` |

- Login is phone + password (BCrypt). The API issues an HS256 JWT with claims `uid` and `role`.
- Municipal accounts cannot self-register. A ward officer has a `ward_id`; a commissioner has none and sees every ward.
- A new dealer starts `PENDING`. Only `VERIFIED` dealers who are accepting pickups appear in pool matching or in the live rate shown to households.
- Services also re-check the role from the database, so a stale token cannot widen access.
- Roles are enforced twice: by URL in `SecurityConfig` (before the request body is read) and by `@HouseholdOnly` / `@CollectorOnly` / `@MunicipalOnly` on the controllers.
- There is no default JWT secret. If `JWT_SECRET` is empty a random one is created at startup (logins do not survive a restart); the `aws` profile refuses to start without one.
- Abuse limits (in memory, per backend instance): 8 wrong logins per phone and 40 per client in 15 minutes, 5 wrong OTPs per stop in 15 minutes, 30 scans per household per hour (each scan is a paid AI call), 60 new accounts per client per hour.
- nginx sets the client address itself (`X-Forwarded-For $remote_addr`), so the limits cannot be dodged by sending a fake header, and adds CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`.
- Uploaded photos are checked by their first bytes (JPEG, PNG, GIF, WEBP), not by file name or the header the client sent.
- Docker publishes the backend and the database on `127.0.0.1` only; the app is reached through nginx.
- The whole application runs in one business time zone (`Asia/Kolkata`, override with `APP_TIMEZONE`), because pickup times are entered in local time and stored without a zone.

## 3. Backend modules

A modular monolith: one deployable, with module boundaries kept clean so a module can be extracted later
(the AI scan is the obvious first candidate). Modules talk **only through small interfaces**; entities and
repositories never leave their module.

```
common/       ApiException (coded, localized by GlobalExceptionHandler), GeoUtil, RateLimiter (in-memory | Redis | falls back), RequestIdFilter, Hashing
security/     SecurityConfig (JWT in an HttpOnly cookie + CSRF), CookieToBearerFilter, JwtConfig, TokenService, LimiterConfig, @CurrentUserId, role annotations
user/         accounts, phone proof (SMS code), password reset, language, collector profile and verification   (UserDirectory, AccountSignals, CollectorProfileUpdater, CollectorVerifier)
sms/          SmsSender (log | SNS)
ward/         real ward boundaries and point-in-polygon                 (WardLocator, WardDirectory)
scan/         waste catalog, WasteScanner (Mock / Bedrock)              (ItemCatalog)
ratecard/     dealer rates, best local rate                             (RateLookup)
listing/      household listings, home screen                           (ListingLookup, ListingLifecycle, PickupInfoProvider)
pool/         Mohalla Pool lifecycle, profit rule, vehicle capacity, matching   (PoolMembership, ProfitPolicy, CapacityPolicy)
pickup/       accept, route order, OTP, payment, payment confirmation and disputes, earnings   (RouteOrderer, OtpGenerator)
rating/       household → dealer ratings, weighted against rating fraud  (RatingLookup)
municipal/    requests, staff, drop-off points, ward overview, payment disputes   (PaymentDisputes)
impact/       impact events and public numbers (SQL sums)                (ImpactRecorder, ImpactReader, ImpactMetrics)
notification/ Notifier: in-app inbox, localized text, SMS for chosen events
storage/      PhotoStorage: temporary area + kept area, hourly cleanup of abandoned scans (local now, S3 later)
seed/         demo data (profile `local` only)
```

Inversions worth knowing:
- `pool` defines `PoolMembership` and `listing` implements it, so pool logic never imports listing.
- `listing` defines `PickupInfoProvider` and `pickup` implements it, so listing never imports pickup.
- `ProfitPolicy`, `RouteOrderer`, `OtpGenerator`, `WasteScanner`, `ImpactMetrics` are strategies that can be swapped without touching callers.

## 4. Where waste goes

`Category` decides the route (`Handling`):

| Category | Items (examples) | Handling |
|---|---|---|
| `DRY` | PET bottle, newspaper, cardboard, iron, aluminium, glass | sold to a scrap dealer through a pool |
| `WET` | food waste | composted through a pool |
| `GENERAL` | dust, sweepings, soiled/mixed, sanitary, thermocol | municipal pickup request (not poolable) |
| `HAZARDOUS` | battery, bulb, medicine, e-waste | nearest authorised drop-off points |

The AI may only answer with a code from the catalog, so every result has a known category and price range.

## 5. Mohalla Pool

1. A listing carries the household's location and ward.
2. `PoolService.assignPool` takes a per-waste-type advisory lock (so households listing at the same moment share a pool instead of each making one), then joins the nearest open pool of that waste type whose centre is within 400 m (`POOL_JOIN_RADIUS_KM`), or starts a new pool centred on this home. A pool is therefore not tied to a map cell: two neighbours on either side of a street are never split.
3. `PoolMatcher` looks at every verified, active collector of the right kind whose service radius covers the pool centre.
4. `MarginMinusTravelPolicy`: `profit = Σ kg × (sell − buy) − 2 × distance × cost per km` (the dealer's own rates and vehicle cost).
5. The pool is `READY` when some dealer's profit reaches their minimum trip profit (and the load reaches their minimum, for compost).
   The status shown to households is derived live, so a pool is never shown as READY when every dealer is paused. The stored status is only a cache.
6. The dealer accepts: the pool row is locked, the dealer's eligibility is checked again right now, the pickup must not start before the day every household is ready, homes are ordered nearest-first, an OTP is issued per home, every household is notified.
7. At the door: OTP (5 wrong guesses lock the stop for 15 minutes), real weight (refused if far above the listed weight), payment. Each finished stop counts immediately in the dealer's earnings. When all stops are done the pool is `DONE` and impact events are recorded with the ward.

## 6. Wards and the municipal corporation

- Real ward boundaries are loaded into the `wards` table at startup by `WardImporter` from `backend/src/main/resources/data/bhubaneswar-wards.tsv` (67 wards of Bhubaneswar Municipal Corporation).
- Point-in-polygon (ray casting, holes supported) assigns a ward to every user, pool, impact event, request and drop-off point from its coordinates.
- To use another city, set `WARDS_FILE` and `WARDS_CITY` to a file in the same format (see its header comments).
- A ward officer sees and changes only their ward: requests, staff, drop-off points, dealers, overview. A request is scheduled by assigning an **active staff member of the same ward** and a date.

**Data licence.** Ward boundaries come from [Data{Meet} Municipal_Spatial_Data](https://github.com/datameet/Municipal_Spatial_Data)
(Bhubaneswar/Wards.GeoJSON), originally scraped from bhubaneswarone.in, licensed
[CC BY-SA 2.5 India](http://creativecommons.org/licenses/by-sa/2.5/in/). `bhubaneswar-wards.tsv` is a
derivative (officer names and phone numbers removed, coordinates rounded) and is shared under the same licence.

## 7. Database (Flyway)

| Migration | Adds |
|---|---|
| V1 | users, collectors, rate_cards, pools, listings, pickups, pickup_stops, impact_events |
| V2 | users.password_hash |
| V3 | MUNICIPAL role, collector profile and verification, collection_points, municipal_requests |
| V4 | wards, ward_id columns, municipal_staff, ratings |
| V5 | one open pool per map cell (replaced in V6) |
| V6 | pool centre (lat/lng) and radius-based joining |
| V7 | phone verification codes, users.phone_verified / language / registration address hash |
| V8 | notifications inbox |
| V9 | payment confirmation and disputes on pickup stops |
| V10 | vehicle capacity on collectors |
| V11 | rating weights (anti-fraud) |
| V12 | index on impact_events.ward_id |
| V13 | users.active (switch an account off), municipal_activity (what officers did) |

## 8. Main API (`/api/v1`)

```
POST /auth/register   POST /auth/login   POST /auth/logout   POST /auth/password/forgot|reset   GET /impact   GET /catalog   GET /scan/mode      (public)
POST /scan            POST /listings            GET /listings/mine   GET /home   GET /pools/mine
POST /municipal-requests   GET /municipal-requests/mine   GET /collection-points/nearby
POST /ratings         GET /ratings/mine   POST /listings/{id}/payment
GET /me   PUT /me/language   POST /me/phone/send-code|verify   GET /me/notifications   POST /me/notifications/read
PUT /me/location   GET /geo/search   GET /geo/ward (public)
GET /municipal/wards   GET /municipal/wards/{id}   GET /municipal/activity   GET|POST /municipal/officers   PUT /municipal/officers/{id}   GET /me/ward
GET /municipal/disputes   POST /municipal/disputes/{stopId}/resolve
GET|PUT /collector/profile   GET|PUT /collector/rate-card   GET /collector/pools   GET /collector/rating
POST /pools/{id}/accept   GET /collector/pickups   POST /pickups/stops/{id}/complete   GET /collector/earnings
GET /municipal/overview   GET|PUT /municipal/requests   GET|POST|PUT /municipal/staff
GET|POST|PUT /municipal/collection-points   GET /municipal/collectors   POST /municipal/collectors/{id}/verification
```

## 9. How the second round of features works

- **Phone proof is optional and OFF by default** (`PHONE_VERIFICATION_REQUIRED=false`): a real SMS service costs money and, in India, needs DLT registration, so by default a new account can use the app at once. Turn it on once an SMS service is connected; the description below is for that mode. Password reset still needs an SMS service, so locally it works only with the on-screen code.
- **Phone proof (when required).** A new account gets a 6-digit SMS code (BCrypt-hashed, valid 10 minutes, limited per phone, per client and per number of guesses). Listing, scanning, accepting pickups and rating need a verified phone (403 `PHONE_NOT_VERIFIED`). Password reset uses the same mechanism and never reveals whether a number has an account. In local mode (`SMS_DEV_CODES=true`) the API returns the code so that nothing real is sent; **never enable that in production**.
- **Payments.** After a stop is completed the household confirms or disputes the payment. A dispute needs a note and goes to the ward officer, who resolves it with a note. Nothing moves money: the app only records what happened.
- **Limits** are shared through Redis (Lua scripts on sorted sets, Redis clock). If Redis is down the app falls back to per-instance in-memory counting instead of failing, so the limits are weaker until Redis returns. Login failures are counted per (client address, phone), so a stranger cannot lock the real owner out.
- **Languages.** English, Hindi, Odia. Frontend: react-i18next with flat keys; `npm run i18n` merges `src/i18n/parts/*.json` (each key holds three texts) and fails on a missing language, a different placeholder, or a key used in code but not defined. Backend: message bundles per language, chosen by `Accept-Language`; SMS and inbox texts use the language saved on the account. **The Hindi and Odia texts were written by an AI model and have not been reviewed by native speakers.**
- **Capacity.** A dealer's vehicle capacity (default per vehicle type, editable) marks a pool "too heavy" and blocks accepting it; accepting also checks the dealer's planned kilograms for that day.
- **Cookie login.** The JWT lives in an HttpOnly, SameSite=Strict cookie. Change requests authenticated by the cookie alone also need the `X-XSRF-TOKEN` header (double-submit). API clients may still send `Authorization: Bearer`, which needs no CSRF token. The cookie is turned into a bearer token *after* the CSRF filter on purpose (see `CookieToBearerFilter`): Spring Security exempts every request that already has a bearer token from CSRF checks.
- **Installable app.** A service worker caches only the app's own files; API answers are never cached. A listing made offline is queued in `localStorage` (not IndexedDB), without its photo (scanning needs the network), and is sent when the network returns. Drafts the server refuses are dropped.
- **Rating fraud.** A rating from the same registration network as the dealer counts 25 %, and three or more ratings within 30 days from one network count 50 %. This is a heuristic: a family on one Wi-Fi is penalised too.
- **Photos.** Scan photos are temporary; only a photo used by a listing is kept. The others are deleted after 24 hours (hourly job).
- **Operations.** Structured JSON logs with a request id (`X-Request-Id`); `/api/v1/health` is public; Prometheus metrics only on the internal port 8081 (not published by compose); `scripts/backup.sh` and `scripts/restore.sh` (tested locally); `infra/cloudwatch-alarms.yaml` is an **untested draft**.
- **Home location.** Register and the account page (`/account`) use a map pin (Leaflet, OpenStreetMap tiles) plus address search. Search goes through our backend (`/api/v1/geo/search`, Nominatim, cached, one call per second, rate limited; `GEO_PROVIDER=static` for tests); `/api/v1/geo/ward` shows the ward of a pin. `PUT /me/location` re-derives the ward, is refused while an open listing, scheduled pickup or open municipal request exists (`LocationLock`), is limited to 3 moves a day, and is not available to municipal accounts. A verified dealer who moves stays verified even if the new ward has another officer.
- **Share kept out of the dump.** Dashboards show kept kg divided by an estimated waste total (people x `avshesh.impact.kg-per-person-per-day`, default 0.45, **an assumption**) since the first pickup (ward/city) or for this month (household). Households use the ward average people per household (4 if unknown). Only waste handled through Avshesh counts as kept out. CO2 is still shown in kg only, because the factors are placeholders.
- **Municipal hierarchy.** Commissioner (a municipal account with no ward) > ward officers (one ward each, several allowed) > collection staff (records the officer assigns to requests; they do not log in). The commissioner has a city overview, a list of all wards, a page per ward (numbers, officers, staff, dealers, officer activity) and an officers page to create, move to another ward, and switch off or on. A ward officer sees only their ward; the city screens answer 403 `COMMISSIONER_ONLY`. A switched-off account cannot log in, and its existing token stops working within about 5 seconds (`ActiveUserFilter` remembers the answer for 5 s). Officer actions are written to `municipal_activity` as a code plus a detail; the screen turns the code into a sentence in the user's language. Actions of a commissioner on a ward's data are recorded without a ward.
- **Figures and where they come from.** The source of truth is the finished stops: what the dealer weighed (`actual_kg`), the rates written down on the stop (`buy_rate`, `sell_rate`) and from them the payment (`amount_paid`) and the margin (`profit`). Each finished stop makes exactly one impact event (`impact_events.stop_id`, unique) holding kg, CO2 (dry 1.5, wet 0.5 kg per kg: **placeholder factors**), compost made (25 % of wet kg), payment, ward and pickup. Everything shown is a sum of those rows: the public impact, the wards, the city, a ward officer's overview, a dealer's earnings and a household's home screen. Two different counts are kept apart: **pickups** are trips (one dealer round, however many homes) and **collections** are homes collected from (stops). `node tests/api/audit.mjs` recomputes all of it from the tables (`scripts/audit.sql` holds the database rules, about 35) and `run-all.sh` runs it twice.
- **Demo data.** `DemoDataSeeder` creates the small starting point (ward 15). `DemoDataExtras` (on by default, off with `DEMO_RICH=false`, local profile only) adds officers and workers in wards 12, 30 and 2, dealers and compost centers (some waiting for approval), about 20 more households, finished/scheduled/ready/half-full pools, payments (one disputed), ratings, municipal requests in every status and the activity log, all through the normal services. The landmark of each ward was chosen so that it and its neighbours lie inside that ward.
- **Desktop.** Households and dealers always get the phone layout. A municipal officer on a wide screen gets a left sidebar and a page capped at 48 rem.
- **AWS.** `infra/aws/app-resources.yaml` (photo bucket with a 1-day `tmp/` expiry, backend IAM role) and `infra/aws/RUNBOOK.md` (RDS, ECR, App Runner, settings). **Neither has been run.** The frontend image renders its nginx config from `BACKEND_URL` / `BACKEND_HOST`, so it can proxy to a backend on another domain.
- **WhatsApp** is not built. `SmsSender` is the single extension point: a WhatsApp Business sender would implement it (message templates must be approved by Meta first).

## 10. Known limits

- Demo dealers, shops, staff and drop-off points are made up. Only the ward boundaries are real.
- A pool is centred on the first home that started it and joins homes within 400 m. Daily capacity is a simple sum of planned kilograms, not a route plan.
- Muzaffarnagar and most Indian cities have no public ward boundaries; only the cities in Data{Meet} do. A new city needs a ward file, default coordinates and a search viewbox.
- Address search uses the free public Nominatim and OSM tile servers: fine for a prototype, not for production traffic.
- Households outside every known ward have no ward: only a commissioner sees their requests.
- Real SMS through SNS, ElastiCache, the S3 lifecycle rule and the CloudWatch template have never been run against AWS. They are written from documentation. SNS accounts start in a sandbox that only sends to verified numbers.
- Ratings from a dealer's own network are down-weighted, but a determined cheater with many networks is not stopped.
- Offline support covers opening the app and queueing a finished listing. Everything else needs the network.
- The public impact numbers are SQL sums (about 0.25 s with 100,000 events on a laptop); the ward column is indexed (V12). Past a few million events, pre-aggregate.
- CO₂ factors, compost yield and the default travel cost are placeholder assumptions, not measured values.
- Payments are recorded as CASH/UPI but not processed.
- The self-drop-off listing mode is stored but has no recycling-center directory behind it yet.
- The Bedrock scanner is a prompt over a general model, not a trained classifier: expect occasional mistakes.

## 11. Tests

Everything is run by `bash tests/run-all.sh` (see [tests/README.md](tests/README.md)).

- `backend/src/test` (JUnit, 51 tests): real ward polygons (no overlaps, holes, the demo mohalla is in ward 15), geo math, the profit rule, route order, the rate limiter, the waste catalog, parsing of AI answers, photo cleanup, translation bundles (same keys and placeholders in en/hi/or).
- `tests/api` (Node, 208 checks plus a two-instance Redis limit check): login and token attacks (forged, expired, tampered, `alg=none`), a role x endpoint matrix, ownership (IDOR), malformed input, uploads, the full pool/pickup/OTP/payment flow, two dealers accepting at once, ten households listing at once, a pool split across a map-cell edge, time zones, ward isolation, ratings, abuse limits, phone proof, password reset, cookie login and CSRF, payment disputes, capacity, rating weights, languages. `load.mjs` is a separate load check (80 homes, 12 dealers, parallel requests).
- `tests/e2e` (Playwright on real Edge/Chrome): the three user journeys, plus sessions, wrong-role addresses, registration, a 360 px phone with an accessibility scan of every page, double clicks, a 4000 px photo, offline and server errors.
