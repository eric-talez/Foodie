# Foodie customer demo

A local customer website for fictional Santa Clara / San Jose restaurants. Choose a sample location, compare grouped and direct delivery, customize a menu item, review server pricing, and open a checkout preview. **Ordering is not live yet.** No order or payment is submitted.

## Prerequisites and installation

- Java 21 (`JAVA_HOME` must point to a JDK 21 installation); Maven is supplied by the wrapper.
- Node.js **24.22.2** and pnpm **12.17.0**, matching the root manifest.
- Docker Desktop (Linux containers) or a compatible running Docker engine, plus Docker Compose v2. PostgreSQL integration tests and E2E require Docker; a local database alone does not replace Testcontainers.
- Free local ports: PostgreSQL 5432, API 8080, web 3000. Stop your own API/web processes before E2E; the harness refuses to reuse existing servers.

From the repository root in PowerShell:

```powershell
java -version
node --version
pnpm.cmd --version
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @foodie/web exec playwright install chromium
```

The browser install is an explicit, one-time download for E2E. Package installation does not start Docker, the database, or development servers. On macOS/Linux, use `pnpm` and `./mvnw` in place of `pnpm.cmd` and `.\mvnw.cmd`.

## Run the local demo

Start Docker Desktop yourself. Set a local-only database password in the current terminal without committing it. Run these commands explicitly:

```powershell
$env:FOODIE_DB_PASSWORD = Read-Host 'Local demo database password'
docker compose up -d foodie-postgres
cd services/api
.\mvnw.cmd spring-boot:run
```

Keep the API in the foreground. In a second terminal at the repository root:

```powershell
pnpm.cmd dev
```

Open [the customer website](http://localhost:3000). API readiness is available at [the health endpoint](http://localhost:8080/actuator/health). Stop each foreground process with Ctrl+C. Then stop the local database from the root:

```powershell
docker compose down
```

`down` retains the named demo volume. No application or test command starts Compose automatically. Compose is only for the explicit local demo; integration tests and E2E use their own ephemeral PostgreSQL 18.6 containers.

## Environment

| Variable | Consumer | Default / meaning |
| --- | --- | --- |
| `JAVA_HOME` | Maven wrapper | JDK 21 path; machine-specific |
| `FOODIE_DB_URL` | API only | `jdbc:postgresql://localhost:5432/foodie` |
| `FOODIE_DB_USER` | API only | `foodie` |
| `FOODIE_DB_PASSWORD` | API / local Compose only | API defaults to empty; Compose requires a nonempty explicitly supplied value |
| `FOODIE_API_ORIGIN` | Next.js | `http://localhost:8080`; upstream for API rewrites and runtime labels, captured at build time |
| `SPRING_PROFILES_ACTIVE` | API | Unset for local `demo`; use `pilot,production` for a deployed pilot |

The browser uses same-origin `/api/v1/**` calls. No public browser environment variable or database credential is needed. E2E supplies its Next rewrite origin and obtains database credentials through `@ServiceConnection`; it does not use the Compose password or volume. Keep credentials out of Git and public assets.

Local `demo` applies the schema and fictional seeds. For a deployed pilot, set `SPRING_PROFILES_ACTIVE=pilot,production` and provide all three `FOODIE_DB_*` variables for a separate pilot database. The API rejects `production` alone, mixed runtime profiles, and a pilot configured with demo migrations or reset enabled. Set `FOODIE_API_ORIGIN` to the pilot API's HTTP(S) origin before building the web app. Use only the scheme, host, and optional port. Changing the upstream requires a rebuild because the rewrite and the runtime descriptor lookup share the origin captured at build time.

`GET /api/v1/runtime` exposes only `mode` and `orderingEnabled`. The web server uses the mode for labels, including the **Demo** badge. If the response is unavailable or invalid, it falls back to demo labels with ordering disabled. Checkout stays preview-only regardless of the reported flag. The web security headers keep scripts, styles, and API calls on the app's origin, allow the inline code required by Next.js, block framing, and deny camera and microphone access. Geolocation is allowed only on the app's origin.

## Validation

Run from the root unless a directory change is shown:

```powershell
# Frontend component/unit suite (non-watch)
pnpm.cmd --filter @foodie/web test -- --run
# Production compilation, TypeScript, and route generation
pnpm.cmd --filter @foodie/web build
# All backend tests, including real PostgreSQL integration (Docker required)
cd services/api
.\mvnw.cmd test
cd ../..
# Real browser + API + seeded PostgreSQL journey (Docker and Chromium required)
pnpm.cmd --filter @foodie/web test:e2e
# Root alias for the same E2E command
pnpm.cmd test:e2e
git diff --check
```

For an independent backend check without Docker:

```powershell
cd services/api
.\mvnw.cmd test '-Dtest=DistanceCalculatorTest,DeliveryEligibilityTest,ServiceAreaServiceTest,ServiceAreaContractTest,MoneyMathTest,QuoteServiceTest,QuoteContractTest'
```

This subset does not verify database migrations, seeded catalog HTTP behavior, or the complete application. Do not interpret it as a passing full suite.

Playwright runs Chromium with one worker and no retries. It launches `mvnw.cmd spring-boot:test-run` and a foreground Next test server, waits for readiness, and owns process teardown. `TestFoodieApiApplication` owns its PostgreSQL 18.6 bean; Spring/Testcontainers manage container shutdown. On Windows, Playwright terminates the process tree; on POSIX it allows a SIGTERM grace period. Testcontainers' resource reaper must remain enabled. Ctrl+C the runner for an ordinary interruption; avoid force-closing its terminal. Failure traces and test results are written to ignored `.superpowers/playwright-results`.

The six E2E cases exercise the actual seeded UI, including required customization, quantity changes, server money lines, preview-only checkout, mode comparison, outside coverage, Back/Forward context, keyboard navigation, corrupted storage recovery, and a simulated quote endpoint outage. Only the outage response is intercepted; the happy journey uses the real API and PostgreSQL.

**Current verification limitation:** on the implementation machine, Docker Desktop was unavailable. Frontend unit tests and the production build pass, and E2E test discovery/type checking succeeds. Full backend validation and browser journey execution remain pending a running Docker engine. The E2E API startup fails explicitly rather than using H2, mock fixtures, or skipped tests. Chromium must also be installed before browser execution.

## Architecture and seed assumptions

- `apps/web`: Next.js App Router / React / TypeScript; location discovery, restaurant detail, customizer, local cart, quote display, checkout preview. Vitest owns component tests; Playwright owns `tests/e2e`.
- `services/api`: Java 21 / Spring Boot 4.1.2 modular monolith; catalog, local service area, integer-cent pricing, structured API errors. PostgreSQL 18.6 stores data, JPA reads it, and Flyway applies the common schema and demo-only seeds per profile. Tests use Testcontainers.
- `compose.yaml`: local PostgreSQL only, with a named volume. There is no deployment or additional container orchestration.

Seeds have fixed UUIDs: four sample locations (three covered, San Francisco outside coverage), six fictional restaurants, 24 menu items, modifier choices, and one active demo fee policy. Santa Clara Central is the repeatable start point; Orchard Bowl Kitchen's Citrus Chicken Bowl costs $14.50 and requires one base. Choosing Brown rice adds no cost.

Grouped delivery covers up to four miles, costs $6.99, and displays 45–60 minutes. Direct covers up to six miles, costs $11.49, and displays 25–35 minutes. Distances are local straight-line estimates. The service fee is 5% of food, capped at $3.00; demo tax is 9% of food. Two Brown rice chicken bowls quote $29.00 food + $1.45 service + $6.99 delivery + $2.61 estimated tax = **$40.05** grouped. Tax, fees, and ETAs are demo policy, not live delivery or tax advice. The server prices IDs and quantities; saved cart labels/prices are estimates.

The cart permits one restaurant and quantities 1–20. `foodie.cart.v1` localStorage holds cart lines; official quotes stay in memory and are invalidated on changes. Refreshing checkout preview returns to cart for fresh pricing.

## Reset the demo

- Use **Clear cart** or remove only `foodie.cart.v1` in browser storage for the demo origin. Reload; corrupted saved JSON also recovers to an empty cart.
- Every E2E run gets a fresh browser context and disposable PostgreSQL seeds; no Compose reset is necessary.
- Restarting the API preserves a Compose database. Flyway seeds apply once, not on every start. To rebuild a local demo database, first stop API/web and confirm the volume contains only disposable fictional demo data. The following **explicit destructive opt-in** deletes the Compose database volume; never use it for a database containing user data:

```powershell
docker compose down --volumes
docker compose up -d foodie-postgres
```

Start the API again to apply migrations and seeds. These reset commands are operator actions and are never run automatically.

## Manual QA

1. At desktop width and a narrow mobile viewport (for example 390px), check readable cards, menu, dialog, cart, and preview with no horizontal overflow or clipped controls.
2. Choose Santa Clara Central. Verify Orchard's grouped card shows $6.99 / 45–60 min. Switch Direct and verify $11.49 / 25–35 min. Open a menu and use Back/Forward; location and mode must remain in the URL.
3. Switch back to Grouped before opening Orchard's menu. Customize Citrus Chicken Bowl. Add must remain disabled until one required base is selected. Add Brown rice, review cart pricing, set quantity to two, and confirm the five separate server lines and $40.05 grouped total.
4. Open checkout preview. In demo, confirm the **Demo** badge and **Demo pricing**. In a pilot with catalog data, confirm there is no demo wording and the quote is labeled **Estimated pricing**. Both modes must show selected items and **Ordering is not live yet**, with no payment collection or order submission control. Refresh preview and confirm it returns to cart for current pricing.
5. Choose the San Francisco outside-coverage sample. Verify a clear coverage message, no restaurant cards, and a working location recovery link.
6. Repeat location → menu → customizer → cart using Tab, arrows, Space, and Enter only. Check visible focus, dialog focus containment, Escape dismissal, restored trigger focus, and labelled quantity/removal controls.
7. Block the quote endpoint or disconnect networking after filling the cart; change quantity. Verify saved items remain, official totals disappear, checkout is disabled, and retry succeeds after restoring networking. Clear or corrupt saved cart storage, reload, and verify recovery.

## Non-goals and security pin

No accounts, authentication, subscription billing, live orders, payments, dispatch, driver/vendor portal, live geocoding/routing, or real customer address collection. No cross-tab cart synchronization or server cart persistence. The deployed pilot is preview-only.

**Next.js 16.4.5 is the reviewed stable security release as of 2026-11-04**, replacing the 16.4.0 pin that produced a known-security-vulnerability warning during the initial build. Check current advisories again before deployment.
