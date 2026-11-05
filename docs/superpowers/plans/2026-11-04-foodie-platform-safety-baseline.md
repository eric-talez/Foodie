# Foodie Platform Safety Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing demo safe to extend by isolating demo and pilot data/configuration and resolving the known web security pin before any live feature is added.

**Architecture:** Keep the current Next.js, Spring Boot, and PostgreSQL deployables. Split Flyway locations by environment, fail closed on conflicting runtime settings, and expose only a small public runtime descriptor so the UI cannot mislabel demo and pilot behavior.

**Tech Stack:** Next.js 16.4.5, React 19.3.0, Java 21, Spring Boot 4.1.2, PostgreSQL 18.6, Flyway, Vitest, JUnit 5/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Preserve one Next.js application, one Spring Boot modular monolith, and one PostgreSQL database per environment.
- Demo and pilot must have separate databases, credentials, identity tenants, Stripe modes, and hostnames.
- Environment choice is server/deployment configuration and is never accepted from a browser request.
- Pilot startup must fail closed when demo seed/reset configuration is enabled.
- Do not edit the contents or version numbers of already-applied `V1` and `V2`; only move them to environment-specific Flyway locations.
- Keep secrets backend-only; no secret may use a `NEXT_PUBLIC_*` variable.
- Do not add a queue, Redis, Kubernetes, or a deployment provider in this plan.

## Review Focus

- A fresh pilot database must contain schema but zero fictional restaurants, locations, menus, or fee policies.
- An existing demo database with V1/V2 applied must still validate after the migration files move.
- Missing or contradictory runtime-mode/profile settings must stop startup with a useful error.
- The browser must not be able to select or override runtime mode.
- Security headers must not break same-origin `/api/**` calls or existing keyboard-accessible UI behavior.

---

## File Structure

```text
apps/web/package.json                         # patched Next.js pin
apps/web/next.config.ts                       # same-origin rewrite and security headers
apps/web/src/lib/runtime.ts                   # validated public runtime descriptor
apps/web/src/lib/runtime.test.ts
services/api/src/main/java/com/foodie/api/environment/
  RuntimeMode.java                            # DEMO or PILOT
  FoodieEnvironmentProperties.java            # bound server settings
  EnvironmentSafetyValidator.java             # fail-closed startup rules
  RuntimeController.java                      # public non-secret descriptor
services/api/src/main/resources/
  application.yml
  application-demo.yml
  application-pilot.yml
  db/common/V1__create_catalog.sql
  db/demo/V2__seed_demo_data.sql
```

### Task 1: Patch the Existing Web Runtime

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `@foodie/web` package and its current unit/build commands.
- Produces: exact stable pin `next@16.4.5`; unchanged React and Node/pnpm pins; README no longer reports 16.4.0 as unresolved.

- [ ] **Step 1: Capture the current component/build baseline**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Expected: both exit `0`; record exact counts in the task report.

- [ ] **Step 2: Upgrade only Next.js and regenerate the lockfile**

Run: `pnpm.cmd --filter @foodie/web add next@16.4.5 --save-exact`

Expected: only the Next.js dependency graph changes; do not upgrade React or test tools.

- [ ] **Step 3: Verify the patched runtime**

Run the two Step 1 commands again. Expected: both exit `0`, with no security warning for the superseded 16.4.0 pin.

- [ ] **Step 4: Update the README security note**

State that 16.4.5 is the reviewed stable security release as of 2026-11-04 and that advisories must be checked again before deployment.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml README.md
git commit -m "build(web): update patched Next.js release"
```

### Task 2: Split Common and Demo Database Migrations

**Files:**
- Move: `services/api/src/main/resources/db/migration/V1__create_catalog.sql` → `services/api/src/main/resources/db/common/V1__create_catalog.sql`
- Move: `services/api/src/main/resources/db/migration/V2__seed_demo_data.sql` → `services/api/src/main/resources/db/demo/V2__seed_demo_data.sql`
- Modify: `services/api/src/main/resources/application.yml`
- Create: `services/api/src/main/resources/application-demo.yml`
- Create: `services/api/src/main/resources/application-pilot.yml`
- Modify: `services/api/src/test/java/com/foodie/api/TestFoodieApiApplication.java`
- Create: `services/api/src/test/java/com/foodie/api/environment/FlywayLocationIntegrationTest.java`

**Interfaces:**
- Consumes: unchanged V1/V2 SQL contents and current Testcontainers database.
- Produces: demo Flyway locations `classpath:db/common,classpath:db/demo`; pilot location `classpath:db/common`; tests activate `demo` explicitly.

- [ ] **Step 1: Write failing integration tests for both migration sets**

`FlywayLocationIntegrationTest.demoAppliesSchemaAndFictionalSeeds()` asserts six restaurants and four sample locations. `pilotAppliesSchemaWithoutFictionalRows()` launches a second isolated PostgreSQL container with the pilot location and asserts the same tables exist with zero restaurants, locations, and fee policies.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=FlywayLocationIntegrationTest`

Expected: FAIL because environment-specific locations do not exist.

- [ ] **Step 3: Move migrations without changing SQL and configure profiles**

Keep the default local profile `demo`. Require explicit `SPRING_PROFILES_ACTIVE=pilot` for pilot. Do not add cleanup or reset behavior.

- [ ] **Step 4: Run the focused and existing seed tests**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=FlywayLocationIntegrationTest,SeedDataIntegrationTest'`

Expected: PASS; existing demo checksums remain unchanged because SQL contents are identical.

- [ ] **Step 5: Commit the migration boundary**

```bash
git add services/api/src/main/resources services/api/src/test
git commit -m "refactor(db): isolate demo seed migrations"
```

### Task 3: Enforce the Runtime Safety Contract

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/environment/RuntimeMode.java`
- Create: `services/api/src/main/java/com/foodie/api/environment/FoodieEnvironmentProperties.java`
- Create: `services/api/src/main/java/com/foodie/api/environment/EnvironmentSafetyValidator.java`
- Create: `services/api/src/main/java/com/foodie/api/environment/RuntimeController.java`
- Modify: `services/api/src/main/resources/application-demo.yml`
- Modify: `services/api/src/main/resources/application-pilot.yml`
- Create: `services/api/src/test/java/com/foodie/api/environment/EnvironmentSafetyValidatorTest.java`
- Create: `services/api/src/test/java/com/foodie/api/environment/RuntimeControllerTest.java`

**Interfaces:**
- Consumes: active Spring profile.
- Produces: `RuntimeMode { DEMO, PILOT }`; properties `foodie.runtime.mode`, `foodie.runtime.ordering-enabled`, `foodie.runtime.demo-reset-enabled`; `GET /api/v1/runtime` → `{mode:"DEMO"|"PILOT", orderingEnabled:boolean}`.

- [ ] **Step 1: Write failing validator and controller tests**

Assert PILOT rejects `demo-reset-enabled=true`, a profile/mode mismatch fails, both modes default ordering to disabled, and the public DTO contains no datasource, hostname, key, or provider field. DEMO may enable ordering later only with test providers; provider-mode enforcement belongs to Plan 6.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=EnvironmentSafetyValidatorTest,RuntimeControllerTest'`

Expected: FAIL because the environment package does not exist.

- [ ] **Step 3: Implement the minimum records, validator, and endpoint**

`EnvironmentSafetyValidator.validate(RuntimeMode mode, boolean orderingEnabled, boolean demoResetEnabled, Set<String> activeProfiles)` throws `IllegalStateException` with a non-secret remediation message. Run it during application startup before accepting traffic.

- [ ] **Step 4: Run focused tests**

Expected: the Step 2 command exits `0`.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/environment services/api/src/main/resources services/api/src/test/java/com/foodie/api/environment
git commit -m "feat(api): enforce runtime environment safety"
```

### Task 4: Display and Protect the Runtime Boundary

**Files:**
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/src/lib/runtime.ts`
- Create: `apps/web/src/lib/runtime.test.ts`
- Modify: `apps/web/src/components/SiteHeader.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `GET /api/v1/runtime` from Task 3.
- Produces: `getRuntime(): Promise<{mode:"DEMO"|"PILOT"; orderingEnabled:boolean}>`; visible `Demo` badge only in DEMO; CSP, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.

- [ ] **Step 1: Write failing runtime parser/header tests**

Assert malformed payloads fail closed as DEMO with ordering disabled, PILOT never shows demo wording, and headers contain the exact policies above while preserving `/api/**` rewrite behavior.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/lib/runtime.test.ts src/app/page.test.tsx`

Expected: FAIL because `runtime.ts` and the badge behavior do not exist.

- [ ] **Step 3: Implement the parser, badge, and headers**

The runtime response affects labels only; it never enables a browser-only ordering path.

- [ ] **Step 4: Verify the complete baseline**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

Expected: all exit `0`.

- [ ] **Step 5: Document startup profiles**

- [ ] **Step 6: Commit**

```bash
git add apps/web services/api README.md
git commit -m "feat(platform): surface isolated runtime mode"
```
