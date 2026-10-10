# Motion: online booking for a physiotherapy clinic

A full-stack Next.js application for booking physiotherapy appointments. Clients pick a treatment, a therapist and a free time; the time is held for 10 minutes while they confirm. Therapists see their week and block time off; the clinic admin manages services and the daily list. The backend, the database rules and a large Cypress suite are all in this repository.

> **Live demo:** _add your URL_ · after `npm run db:seed` every demo account uses the password `password123`
> (`anna@example.com` client, `emma@motion.test` therapist, `admin@motion.test` admin)

<!-- Add a screenshot or GIF of the booking flow: ![Booking](docs/booking.png) -->

## What it does

**Clients** choose a treatment, a therapist (or "any therapist") and a day from the next 14 days. Picking a time places a 10-minute hold with a live countdown; confirming books it and sends a confirmation email. Clients can cancel online up to 24 hours ahead.

**Therapists** see their sessions week by week, cancel a session if needed, and add time off. Time off is refused if it would clash with booked sessions.

**Admins** see every appointment for a day, cancel any of them, and add or retire services and choose who offers them.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 15 App Router: Server Components, Server Actions, Route Handlers, Middleware, `after()` |
| Language | TypeScript (strict) |
| Database | PostgreSQL 16, Drizzle ORM, SQL migrations (including a hand-written exclusion constraint) |
| Auth | Auth.js v5 with credentials, JWT sessions and three roles |
| Validation | Zod, shared by forms and the API |
| UI | React 19, Tailwind CSS 4 |
| Tests | Vitest, React Testing Library, Cypress with Testing Library and axe |
| CI | GitHub Actions: three parallel jobs, PostgreSQL service containers |

## The hard parts, and how they're solved

**No double bookings, even under a race.** Checking availability and then inserting is not safe when two people click at once. The database settles it: an exclusion constraint forbids overlapping `HELD` or `CONFIRMED` appointments for the same therapist (`drizzle/0001_booking_constraints.sql`). The service turns the resulting Postgres error into a friendly `409` and tests prove it with truly simultaneous requests.

```sql
EXCLUDE USING gist (therapist_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status IN ('HELD', 'CONFIRMED'))
```

**Holds that expire.** A hold is an appointment in state `HELD` with `hold_expires_at`. Availability ignores holds that ran out; creating a new hold first marks stale ones as `EXPIRED` in the same transaction, so they stop counting for the constraint. A client has at most one hold, so picking a new time releases the previous one.

**Safe retries.** Every hold request carries an idempotency key (unique per client). A double click, a retry after a timeout or a replayed API call returns the same hold instead of creating a second one.

**Time zones and daylight saving.** Instants are stored in UTC; working hours are wall-clock minutes in Europe/Prague. `src/lib/time.ts` converts with `Intl` only, looking up the real offset for each instant, and the tests cover both DST switches.

**A pure availability engine.** `computeSlots()` in `src/lib/availability.ts` takes working hours, busy intervals, service length, notice and "now", and returns start times. No database, so it's tested exhaustively in milliseconds; the service around it only loads data.

**Injected time.** Services never call `new Date()`; they receive `now`. That keeps them deterministic in integration tests, and in E2E mode the server reads "now" from a test clock that Cypress can freeze and move.

**Emails via a transactional outbox.** Confirmation and cancellation emails are written to `email_outbox` in the same transaction as the booking change, then delivered after the response with `after()`. Delivery uses `FOR UPDATE SKIP LOCKED`, so several workers never send the same email twice.

**Rate limiting.** Sign-in is limited to 5 attempts per 15 minutes per email, and the public availability API per IP. The counter is a single atomic upsert, so it holds with concurrent requests and multiple app instances.

**Authorization in layers.** Middleware routes each role to its own area (`src/lib/access.ts`, unit-tested as a matrix); services check again, and non-participants get 404 instead of 403. Callback URLs after sign-in are restricted to same-site paths to prevent open redirects.

**Booking state in the URL.** Treatment, therapist and day are query parameters, so every step can be refreshed, shared and server-rendered, and signing in mid-booking returns to exactly the same choices.

## Testing strategy

| Layer | Tool | Count | What it covers |
| --- | --- | --- | --- |
| Unit | Vitest | 67 | Time zones and DST, availability engine, cancellation and booking-window rules, access matrix, open-redirect guard, money parsing, validation, email texts |
| Component | Vitest + Testing Library | 14 | Countdown with fake timers, slot picking (idempotency key reuse, double-click guard, sign-in redirect, network failure), two-step cancel, form values surviving a failed submit |
| Integration | Vitest + real PostgreSQL | 29 | Services end to end: concurrent holds, hold expiry, confirmation emails in the same transaction, 24-hour rule, permissions, time-off conflicts, rate-limit window and concurrency, exactly-once email delivery |
| End-to-end | Cypress | 38 | Real browser against the production build, see below |

### Cypress suite

| Spec | Scenarios |
| --- | --- |
| `booking.cy.ts` | Full journey from a signed-out visitor to a confirmed booking and email; choices kept across sign-in; the slot disappears for others; "any therapist"; notice period and lunch break; hold expiry driven by the clock; confirming after the hold ran out; releasing a hold; losing a race to another client; recovering from a dropped connection |
| `cancellation.cy.ts` | Cancelling with email; the 24-hour rule explained on a disabled button; admin and therapist cancellations |
| `staff.cy.ts` | Therapists see only their sessions; time off removes slots from booking; time off refused over booked sessions; admin adds a service with validation; retiring a service; clients kept out |
| `auth.cy.ts` | Registration with validation; duplicate emails; role-based landing pages and forbidden areas; returning to the requested page; open-redirect attempt; lockout after 5 failed sign-ins and unlock 15 minutes later |
| `api.cy.ts` | Contract tests with `cy.request`: status codes and messages, idempotent retries, a real two-client race via `cy.task`, confirmation via the API, hidden test endpoints |
| `accessibility.cy.ts` | axe (WCAG 2.1 AA) on public, client and staff pages; skip link; complete booking on a phone viewport without horizontal scrolling |

Techniques used in the suite:

- **Deterministic data:** `cy.resetClinic()` wipes the database and loads fixtures with fixed ids through a test-only endpoint before every test.
- **Controlled time:** the server clock is frozen at Monday 4 March 2030, 08:00 and moved with `cy.advanceServerTime()`; the browser's `Date` is kept in step with `cy.clock()`.
- **Fast sign-in:** `cy.loginAs()` signs in through the Auth.js endpoint and caches each role with `cy.session()`; the form itself is tested separately.
- **State through the API:** specs create appointments directly instead of clicking through booking each time.
- **Page objects** in `cypress/support/pages`, and **accessible queries** from `@testing-library/cypress` (`findByRole`, `findByLabelText`), so the tests also guard labels and roles.
- **Network control** with `cy.intercept()` to simulate going offline mid-booking.
- **Real concurrency** from Node with `cy.task("race")`, since Cypress commands run one after another.
- **Email checks** against the outbox through `/api/test/emails`.

Test-only endpoints under `/api/test/*` and the controllable clock exist only when `E2E_TEST_MODE=1` and the request carries the shared secret; otherwise they answer 404.

## Getting started

Requirements: Node.js 22 and Docker (or PostgreSQL 16 with the `btree_gist` extension available).

```bash
npm install
cp .env.example .env              # set AUTH_SECRET, e.g. openssl rand -base64 32
docker compose up -d              # creates physio, physio_test and physio_e2e
npm run db:migrate
npm run db:seed                   # demo clinic and accounts
npm run dev
```

### Running the tests

```bash
npm test                          # unit + component
npm run test:integration          # needs the physio_test database
cp .env.e2e.example .env.e2e
npm run test:e2e                  # starts the app on :3100 against physio_e2e and runs Cypress headless
npm run cy:open                   # interactive: first run `npm run e2e:dev` in another terminal
```

The E2E database is wiped before every test, which is why it's separate from the development one.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/services` | Active services |
| `GET` | `/api/availability?serviceId&date[&therapistId]` | Free start times for a day (public, rate limited) |
| `POST` | `/api/appointments` | Hold a slot: `{ serviceId, therapistId, startsAt, idempotencyKey }` → `201` new, `200` same key, `409` taken |
| `POST` | `/api/appointments/:id/confirm` | Confirm your hold; `410` if it ran out |
| `POST` | `/api/appointments/:id/cancel` | Cancel (clients: 24 hours ahead) |
| `GET` | `/api/me/appointments` | Your upcoming and past appointments |
| `GET` | `/api/health` | Health check with a database ping |

Errors are `{ "error": string }` with a matching status; `429` responses include `Retry-After`.

## Project structure

```
src/
  app/                  pages, server components and route handlers (api/*, api/test/*)
  components/           booking UI, forms, primitives
  db/                   Drizzle schema and client
  lib/                  pure logic: time, availability, policies, access, validation
  server/
    actions/            server actions
    services/           business rules: availability, bookings, schedule, catalog, users
    email/              templates and the outbox
    clock.ts            injectable "now"
    rate-limit.ts       atomic fixed-window limiter
    test-support/       fixtures and the guard for test-only endpoints
drizzle/                SQL migrations
cypress/                specs, page objects, custom commands
tests/                  unit, component and integration tests
```

## License

MIT
