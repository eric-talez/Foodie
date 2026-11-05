# Foodie Demo Polish and Pilot Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the completed workflows into a repeatable investor/restaurant demo and a safely deployable, observable, documented South Bay pilot without enabling live money before human launch gates.

**Architecture:** The same containers run in isolated demo and pilot Cloud Run stacks in `us-west1`; each uses a separate Cloud SQL PostgreSQL database, Secret Manager secrets, identity tenant, and provider projects. Demo scenario reset is environment-guarded; pilot ordering defaults off until a signed readiness checklist is complete.

**Tech Stack:** Next.js/Node 24, Spring Boot/Java 21, PostgreSQL 18, Docker, Google Cloud Run/Cloud SQL/Secret Manager/Cloud Logging, Playwright, Stripe test/live modes

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Demo and pilot are separate deployments/data/credentials; no runtime flag can switch one stack into the other.
- Demo uses fictional data, sandbox personas, Stripe test mode, and allowlisted notification recipients.
- Pilot ordering starts disabled and no code/test command may enable live charges automatically.
- Demo reset is structurally unavailable in the pilot profile and affects only tagged fictional scenario rows.
- No secrets, tenant IDs, private hostnames, participant data, or live provider IDs enter Git, logs, fixtures, screenshots, or public assets.
- A real low-value live transaction and production changes are explicit human approval gates.
- Legal/tax/insurance/contract signoff cannot be represented as passed by a software test.

## Review Focus

- Demo reset must refuse pilot profile/database and must report a dry-run row count before mutation.
- Automated E2E must not contain auth/payment bypass code in main production sources.
- Readiness/health must distinguish process alive, database ready, and external provider degraded.
- Container/deployment configuration must keep backend secrets out of browser build layers and image history.
- Runbooks must cover duplicate webhook, no driver, capture failure, refund, dispute, PIN override, SMS failure, transfer failure, backup restore, and incident shutdown.

---

## File Structure

```text
services/api/Dockerfile
apps/web/Dockerfile
.dockerignore
deploy/cloudrun/README.md
deploy/cloudrun/{api,web}-service.yaml
deploy/cloudrun/cloudbuild.yaml
docs/operations/*.md
apps/web/src/app/why-foodie/page.tsx
apps/web/tests/e2e/roles/*.spec.ts
services/api/src/test/java/com/foodie/api/e2e/*
```

### Task 1: Add a Guarded Demo Scenario Lifecycle

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/demo/DemoScenarioService.java`
- Create: `services/api/src/main/java/com/foodie/api/demo/DemoScenarioCommand.java`
- Create: `services/api/src/main/resources/db/demo/V11__add_demo_scenarios.sql`
- Create: `services/api/src/test/java/com/foodie/api/demo/DemoScenarioServiceIntegrationTest.java`
- Create: `docs/operations/demo-runbook.md`

**Interfaces:**
- Consumes: DEMO profile, `demo-reset-enabled=true`, explicit scenario ID and confirmation text.
- Produces: CLI/operator command `demo-scenario reset --id investor-journey --confirm RESET_DEMO_SCENARIO`; first prints dry-run counts; no HTTP reset endpoint.

- [ ] **Step 1: Write failing isolation/idempotency/dry-run tests**

Assert PILOT refuses before DB mutation, untagged rows are untouched, reset restores deterministic four-role sandbox data, rerun is stable, and provider/live IDs are absent.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=DemoScenarioServiceIntegrationTest`

- [ ] **Step 3: Implement the guarded command and scenario migration**

Do not call Stripe/Auth0 reset APIs. The runbook pre-provisions sandbox accounts/personas outside Git and maps their non-secret IDs through deployment config.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/demo services/api/src/main/resources/db/demo services/api/src/test docs/operations/demo-runbook.md
git commit -m "feat(demo): add isolated scenario reset"
```

### Task 2: Polish the Investor and Restaurant Story

**Files:**
- Create: `apps/web/src/app/why-foodie/page.tsx`
- Create: `apps/web/src/components/EconomicsExample.tsx`
- Modify: `apps/web/src/app/page.tsx`, navigation, CSS
- Create: component/page tests

**Interfaces:**
- Consumes: approved demo economics `$35.00` food, `$4.20` restaurant commission, `$1.75` service, `$6.99` grouped delivery, transparent breakdown; runtime descriptor.
- Produces: concise Foodie value page and four-role guided-demo navigation, clearly labeled `Sample economics` and `Test mode` in demo.

- [ ] **Step 1: Write failing disclosure/responsive/accessibility tests**

Assert no unsupported competitor claim, no live/pilot promises, every number is labeled sample, fee lines remain separate, and mobile/keyboard headings/navigation are valid.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/app/why-foodie src/components/EconomicsExample.test.tsx`

Expected: FAIL because the economics story does not exist.

- [ ] **Step 3: Implement the story with the existing design system**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(demo): present transparent marketplace economics"
```

### Task 3: Add Test-Only Four-Role Journey Infrastructure

**Files:**
- Create: `services/api/src/test/java/com/foodie/api/e2e/TestOidcConfiguration.java`
- Create: `services/api/src/test/java/com/foodie/api/e2e/TestProviderConfiguration.java`
- Extend: `TestFoodieApiApplication.java`
- Create: `apps/web/tests/e2e/roles/{customer,restaurant,driver,operations}.spec.ts`
- Create: `apps/web/tests/e2e/full-order.spec.ts`
- Modify: `apps/web/playwright.config.ts`

**Interfaces:**
- Consumes: test-classpath-only signed JWT issuer, fake deterministic Stripe/Google/Twilio adapters, disposable PostgreSQL.
- Produces: browser journey that authorizes, accepts/captures, prepares, dispatches, delivers, reconciles, and releases a fake transfer; production main source has no bypass header/endpoint.

- [ ] **Step 1: Write the tests first and verify discovery/RED**

Run: `pnpm.cmd --filter @foodie/web exec playwright test --list`

Expected: all role tests are discovered; full-order test initially fails at missing test provider wiring.

- [ ] **Step 2: Add test-only issuer/provider beans**

They exist only under `src/test` and activate only through `spring-boot:test-run`; production packaging cannot load them.

- [ ] **Step 3: Run browser journeys**

Run: `pnpm.cmd --filter @foodie/web test:e2e`

Expected: all existing and new browser tests pass with owned process teardown.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/test apps/web/tests apps/web/playwright.config.ts
git commit -m "test(e2e): cover the four-role order journey"
```

### Task 4: Add Provider Sandbox Contract Suites

**Files:**
- Create: `services/api/src/test/java/com/foodie/api/contract/{StripeSandboxContractTest,GoogleSandboxContractTest,TwilioSandboxContractTest}.java`
- Modify: `services/api/pom.xml` to define explicit `provider-contract` profile
- Create: `docs/operations/provider-contract-tests.md`

**Interfaces:**
- Consumes: opt-in sandbox environment variables; never default test execution.
- Produces: signed Stripe authorization/capture/cancel/refund/account/transfer/webhook checks; Google validation/route checks; Twilio Messaging and SendGrid test-credential request checks.

- [ ] **Step 1: Add tag/profile guards that fail clearly when explicitly selected without config and skip otherwise**

- [ ] **Step 2: Run default suite and prove no external call**

Run: `cd services/api; .\mvnw.cmd test`

Expected: exit `0`; contract tests report excluded by profile, not silently disabled after selection.

- [ ] **Step 3: Run sandbox suite only with approved test credentials**

Run: `cd services/api; .\mvnw.cmd verify -Pprovider-contract`

Expected: exit `0` in configured sandbox; record redacted object types/counts, never IDs/secrets.

- [ ] **Step 4: Commit**

```bash
git add services/api/pom.xml services/api/src/test docs/operations/provider-contract-tests.md
git commit -m "test(integration): verify provider sandbox contracts"
```

### Task 5: Containerize and Define Isolated Cloud Run Stacks

**Files:**
- Create: `.dockerignore`
- Create: `services/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `deploy/cloudrun/README.md`
- Create: `deploy/cloudrun/api-service.yaml`
- Create: `deploy/cloudrun/web-service.yaml`
- Create: `deploy/cloudrun/cloudbuild.yaml`
- Extend: application health configuration/tests

**Interfaces:**
- Produces: non-root multi-stage images; Cloud Run `us-west1`; separate demo/pilot services, Cloud SQL PostgreSQL 18 instances/databases, service accounts, Secret Manager bindings, min one always-CPU API instance for durable workers, and independent hostnames.

- [ ] **Step 1: Write/extend health tests**

`/actuator/health/liveness` checks process only; `/readiness` checks DB/migrations and reports required provider configuration without leaking values.

- [ ] **Step 2: Build both images locally**

Run: `docker build -f services/api/Dockerfile -t foodie-api:local .`

Run: `docker build -f apps/web/Dockerfile -t foodie-web:local .`

Expected: exit `0`; secret scan of image history/config finds no provider key or `.env` content.

- [ ] **Step 3: Validate manifests without deploying**

Use `gcloud run services replace --dry-run` or the currently supported equivalent documented in the runbook for both rendered demo/pilot parameter sets. Do not execute a deploy in this task.

- [ ] **Step 4: Commit**

```bash
git add .dockerignore services/api/Dockerfile apps/web/Dockerfile deploy services/api/src
git commit -m "build(deploy): define isolated Cloud Run services"
```

### Task 6: Add Observability and Operations Runbooks

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/common/CorrelationIdFilter.java`
- Configure structured console logging and actuator metrics
- Create: `docs/operations/{monitoring,incident-response,backup-restore,order-exceptions,reconciliation}.md`
- Create: related tests

**Interfaces:**
- Produces: request correlation ID, order/provider IDs in structured fields, no PII/secrets; alerts for failed webhook/outbox, pending capture/refund/transfer, no driver, DB readiness, 5xx rate; runbooks for every spec exception.

- [ ] **Step 1: Write failing redaction/correlation/readiness tests**

Use representative address, token, PIN, client secret, and phone fixtures and assert none appears in captured logs/errors.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=CorrelationIdFilterTest,LogRedactionTest,ReadinessHealthTest'`

Expected: FAIL because correlation/redaction/readiness behavior is missing.

- [ ] **Step 3: Implement structured logging, redaction, metrics, and health groups**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write concise operator decision trees**

- [ ] **Step 6: Commit**

```bash
git add services/api/src services/api/src/main/resources docs/operations
git commit -m "feat(ops): add monitoring and recovery runbooks"
```

### Task 7: Create the Live Pilot Readiness Gate

**Files:**
- Create: `docs/operations/pilot-readiness-checklist.md`
- Create: `docs/operations/live-order-runbook.md`
- Create: `services/api/src/main/java/com/foodie/api/operations/LaunchReadinessService.java`
- Extend: operations API/UI and tests

**Interfaces:**
- Produces: read-only readiness report for technical gates; human-owned checklist entries for tax/legal/insurance/contracts/privacy; `foodie.runtime.ordering-enabled` remains false until deployment owner changes configuration after all signoffs.

- [ ] **Step 1: Write failing technical readiness tests**

Check active restaurants/drivers, Stripe capabilities/modes, tax provider, zones, compensation policy, notification allowlist/consent, webhook health, backup restore evidence, secrets mode, and no demo rows/config. Human gates remain `UNVERIFIED`, never auto-pass.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=LaunchReadinessServiceTest`

Expected: FAIL because the readiness report does not exist.

- [ ] **Step 3: Implement the read-only technical and human-gate report**

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Run complete pre-deploy verification**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `pnpm.cmd --filter @foodie/web test:e2e`

Run: `git diff --check`

Expected: all exit `0`; provider sandbox profile separately passes with approved sandbox credentials.

- [ ] **Step 6: Commit the gate**

```bash
git add docs/operations services/api/src apps/web/src
git commit -m "feat(launch): add pilot readiness gate"
```

- [ ] **Step 7: Stop for external approval before deployment/live money**

Do not deploy, enable ordering, create live accounts, or run a real charge automatically. Present the completed checklist, exact image digests, migration plan/dry-run, rollback steps, and proposed low-value live order to the user for explicit approval.
