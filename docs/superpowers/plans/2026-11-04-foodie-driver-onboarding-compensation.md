# Foodie Driver Onboarding and Compensation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operations approve invited drivers, let drivers complete hosted payout onboarding and control availability, and calculate auditable minimum compensation from effective-dated policy.

**Architecture:** A `driver` module owns profiles, compliance checklist status, availability, Stripe Recipient accounts, and pure compensation calculations. It reuses Foodie memberships for authority and Stripe configuration/gateway patterns from payments without letting drivers accept customer charges.

**Tech Stack:** Java 21, Spring Boot/JPA, PostgreSQL/Flyway, Stripe Accounts v2 Recipient configuration, Next.js/React, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Drivers are invited independent contractors; no shifts, minimum hours, mandatory acceptance, exclusivity, or acceptance-rate penalty.
- Drivers may set themselves available/unavailable at any time outside an active accepted delivery.
- Accounts v2 Recipient configuration uses Express Dashboard and `stripe_transfers`; drivers never receive customer charges.
- Foodie stores checklist/status references, not driver's bank, KYC, license image, insurance document, or background-report contents.
- Compensation equals `max(promised offer, effective compliance floor) + 100% tip + explicit adjustment`.
- Legal rates are effective-dated data with source; no current California rate is hardcoded in Java.

## Review Focus

- Expired/missing compliance items or Stripe capability must prevent availability.
- A driver cannot read/change another driver or become available while suspended.
- Compensation rounding for seconds and milli-miles must never underpay by truncation.
- Policy changes must not alter a completed delivery's stored earnings.
- Stripe onboarding retries must not create multiple recipient accounts.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/driver/
  DriverProfile.java, DriverStatus.java, DriverAvailability.java
  DriverCompensationPolicy.java, DriverCompensationCalculator.java
  DriverOnboardingService.java, DriverController.java, OpsDriverController.java
  DriverPaymentAccountService.java
services/api/src/main/resources/db/common/V9__create_drivers.sql
apps/web/src/app/driver/profile/page.tsx
apps/web/src/components/driver/DriverProfile.tsx
```

### Task 1: Persist Driver Profiles, Compliance, and Policies

**Files:**
- Create: `services/api/src/main/resources/db/common/V9__create_drivers.sql`
- Create: driver entities/enums/repositories listed above
- Modify: identity membership mapping to add nullable `driver_id` scope with FK
- Create: `services/api/src/test/java/com/foodie/api/driver/DriverPersistenceIntegrationTest.java`

**Interfaces:**
- Produces: status `INVITED|ONBOARDING|APPROVED|SUSPENDED`; availability boolean/timestamp/version; checklist booleans+expiry dates; recipient account fields; effective policy fields `minimumWageCentsPerHour`, `earningsMultiplierBasisPoints`, `mileageCentsPerMile`, `source`, `effectiveFrom/To`.

- [ ] **Step 1: Write failing constraint/scope/policy-overlap tests**

Assert one profile per user, driver membership requires driver scope, policy ranges do not overlap, no pilot policy is seeded automatically, and suspended/unapproved driver cannot become available.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=DriverPersistenceIntegrationTest`

- [ ] **Step 3: Add V9 and mappings**

Store only references/status/expiry for external verification; no document blob or sensitive identifier columns.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V9__create_drivers.sql services/api/src/main/java/com/foodie/api/driver services/api/src/main/java/com/foodie/api/identity services/api/src/test
git commit -m "feat(driver): persist onboarding and pay policies"
```

### Task 2: Onboard and Approve Invited Drivers

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/driver/DriverOnboardingService.java`
- Create: `services/api/src/main/java/com/foodie/api/driver/OpsDriverController.java`
- Create: `services/api/src/main/java/com/foodie/api/driver/DriverController.java`
- Create: `services/api/src/main/java/com/foodie/api/driver/DriverDtos.java`
- Create: service/API integration tests

**Interfaces:**
- Consumes: OPS MFA actor, driver invitation, checklist dates/status, expected version.
- Produces: `POST/GET /api/v1/ops/drivers`, `POST /{id}/approve|suspend`; driver `GET /api/v1/driver/me`, `POST /availability`.

- [ ] **Step 1: Write failing invitation/readiness/ownership/idempotency tests**

Assert approve requires claimed invitation, all checklist items current, Stripe transfer capability, and reason; availability rejects invalid status/checklist; repeat same state is safe.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=DriverOnboardingServiceTest,DriverApiIntegrationTest'`

Expected: FAIL because the onboarding commands and endpoints do not exist.

- [ ] **Step 3: Implement transactional onboarding, approval, suspension, and availability commands**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/driver services/api/src/test/java/com/foodie/api/driver
git commit -m "feat(driver): add invited driver approval"
```

### Task 3: Add Stripe Recipient Onboarding

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/driver/DriverPaymentAccountService.java`
- Extend: `DriverController.java`, Stripe gateway
- Create: `services/api/src/test/java/com/foodie/api/driver/DriverPaymentAccountServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/driver/StripeRecipientContractTest.java`

**Interfaces:**
- Produces: driver `POST /payment-account`, `/onboarding-link`, and `GET /payment-account/status`; Accounts v2 Recipient configuration, `dashboard=express`, `stripe_transfers` requested.

- [ ] **Step 1: Write failing exact-configuration/retry/scope tests**

Assert no Merchant/card-payments configuration, one account per driver, hosted collection only, safe return URLs, and capability webhooks update the driver record.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=DriverPaymentAccountServiceTest,StripeRecipientContractTest'`

Expected: FAIL because recipient onboarding is not implemented.

- [ ] **Step 3: Implement recipient onboarding through the existing configured Stripe client**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/driver services/api/src/main/java/com/foodie/api/payments services/api/src/test
git commit -m "feat(driver): onboard payout recipients"
```

### Task 4: Calculate Effective-Dated Driver Compensation

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/driver/DriverCompensationCalculator.java`
- Create: `services/api/src/main/java/com/foodie/api/driver/DriverCompensation.java`
- Create: `services/api/src/test/java/com/foodie/api/driver/DriverCompensationCalculatorTest.java`
- Extend: ops policy endpoints/tests

**Interfaces:**
- Consumes: `calculate(policy, promisedCents, engagedSeconds, engagedDistanceMilliMiles, tipCents, adjustmentCents)`.
- Produces: immutable breakdown `timeFloorCents`, `mileageFloorCents`, `complianceFloorCents`, `promisedCents`, `basePaidCents`, `tipCents`, `adjustmentCents`, `totalCents`, `policyId`.

- [ ] **Step 1: Write failing boundary/rounding/overflow tests**

Formula: ceiling of `(minimumWageCentsPerHour * earningsMultiplierBasisPoints * engagedSeconds) / (10000 * 3600)` plus ceiling of `(mileageCentsPerMile * milliMiles) / 1000`; then max with promised. Reject negative inputs and arithmetic overflow.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=DriverCompensationCalculatorTest`

- [ ] **Step 3: Implement using `long`/`Math.*Exact` and ceiling division**

No floating-point money or distance arithmetic.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/driver services/api/src/test/java/com/foodie/api/driver
git commit -m "feat(driver): calculate auditable compensation"
```

### Task 5: Build Driver Profile and Availability UI

**Files:**
- Create: `apps/web/src/features/driver/driverApi.ts`
- Create: `apps/web/src/app/driver/profile/page.tsx`
- Create: `apps/web/src/components/driver/DriverProfile.tsx`
- Create: component/API tests
- Modify: `AccountMenu.tsx`

**Interfaces:**
- Consumes: Tasks 2–3 APIs.
- Produces: onboarding status, hosted Stripe link, checklist expiry/readiness, and explicit Available/Unavailable control.

- [ ] **Step 1: Write failing role/loading/retry/availability/accessibility tests**

Assert unavailable reasons are specific, no document upload exists, repeated toggle cannot race, and status is server-confirmed.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/driver src/components/driver`

Expected: FAIL because the driver profile UI does not exist.

- [ ] **Step 3: Implement the smallest driver profile and availability page**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Run complete validation**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 6: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): add driver onboarding profile"
```
