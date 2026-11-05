# Foodie Dispatch, Delivery, and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the pilot order by letting operations offer single/two-order deliveries, drivers accept and prove delivery, operations handle exceptions, notifications send durably, and driver earnings transfer safely.

**Architecture:** Human-assisted dispatch owns offers and assignments; a pure batch planner enforces two-order and detour limits. Delivery has its own optimistic state machine. Existing outbox drives expiry, notifications, and transfer work; an append-only audit log covers operator and money actions.

**Tech Stack:** Java 21, Spring Boot/JPA/RestClient, PostgreSQL/Flyway, Google Routes port, Stripe transfers, Twilio Messaging REST API, Next.js/React, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Dispatch is human-assisted; no optimizer, auto-assignment, surge price, acceptance penalty, or mandatory offer.
- An offer expires after 60 seconds and shows route summary, batching state, and guaranteed offered compensation before acceptance.
- Grouping is at most two orders, at most ten modeled minutes of detour, and at most 15 minutes matching wait after restaurant acceptance.
- Unmatched grouped orders dispatch alone at the quoted price; the customer is never repriced or canceled solely for no match.
- Compensated engaged time starts at driver acceptance and ends at delivery completion or assignment cancellation.
- Valid six-digit customer PIN is sufficient delivery proof; geolocation is optional supporting evidence.
- Driver transfers require delivered earnings, available platform balance, and explicit operator-reviewed release.

## Review Focus

- Two drivers racing for one offer, one driver racing across two offers, and offer expiry must never double-assign.
- Batch detour and stop ordering must be calculated from provider routes, not straight-line distance.
- PIN guessing, replay, secret rotation, and operations override must be rate-limited/audited.
- Delivery completion, compensation, timeline, notifications, and transfer payable must commit atomically or not at all.
- Notification/transfer provider timeouts must remain retryable without duplicate SMS or money movement.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/dispatch/
  Delivery.java, DeliveryOffer.java, DeliveryStop.java
  BatchPlanner.java, DispatchService.java, DispatchController.java
services/api/src/main/java/com/foodie/api/delivery/
  DeliveryService.java, DeliveryPinService.java, DriverDeliveryController.java
services/api/src/main/java/com/foodie/api/operations/
  AuditLog.java, OperationsController.java, OperationsQueryService.java
services/api/src/main/java/com/foodie/api/notification/
  NotificationSender.java, TwilioNotificationSender.java
  SendGridNotificationSender.java, NotificationWorker.java
services/api/src/main/resources/db/common/V10__create_dispatch_operations.sql
apps/web/src/app/driver/offers, apps/web/src/app/driver/deliveries
apps/web/src/app/ops
```

### Task 1: Persist Delivery, Offers, Earnings, Notifications, and Audit

**Files:**
- Create: `services/api/src/main/resources/db/common/V10__create_dispatch_operations.sql`
- Create: dispatch/delivery/operations/notification entities/enums/repositories
- Create: `services/api/src/test/java/com/foodie/api/dispatch/DispatchPersistenceIntegrationTest.java`

**Interfaces:**
- Produces: delivery state `UNASSIGNED|OFFERED|ASSIGNED|AT_RESTAURANT|PICKED_UP|DELIVERED|CANCELED|FAILED`; expiring offer; ordered stops; optional batch of one/two orders; immutable earning; transfer status; notification delivery; append-only audit.

- [ ] **Step 1: Write failing database invariant tests**

Assert one active delivery per order, max two orders/stops per batch, one accepted offer per delivery and active assignment per driver, unique provider idempotency IDs, immutable earnings/audit, and nonnegative cents/time/distance.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=DispatchPersistenceIntegrationTest`

- [ ] **Step 3: Add V10 and focused mappings**

Use database constraints plus row locks; do not rely only on controller checks.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V10__create_dispatch_operations.sql services/api/src/main/java/com/foodie/api/{dispatch,delivery,operations,notification} services/api/src/test
git commit -m "feat(dispatch): persist delivery operations"
```

### Task 2: Plan Eligible Single and Two-Order Deliveries

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/dispatch/BatchPlanner.java`
- Create: `services/api/src/main/java/com/foodie/api/dispatch/DispatchCandidateService.java`
- Create: `services/api/src/test/java/com/foodie/api/dispatch/BatchPlannerTest.java`
- Create: `services/api/src/test/java/com/foodie/api/dispatch/DispatchCandidateServiceTest.java`

**Interfaces:**
- Consumes: accepted/preparing orders, route plans, available approved drivers, predicted pickup times.
- Produces: ranked read-only `DispatchCandidate` values and `BatchProposal` only when size=2 and each order's added duration ≤600 seconds.

- [ ] **Step 1: Write failing route/order/window/boundary tests**

Cover exactly 600 vs 601 seconds, incompatible pickup windows/restaurants/zones, already assigned order/driver, 15-minute cutoff, route provider failure, and deterministic tie ordering.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=BatchPlannerTest,DispatchCandidateServiceTest'`

Expected: FAIL because the planner and candidate query do not exist.

- [ ] **Step 3: Implement the pure batch planner and candidate query service**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/dispatch services/api/src/test/java/com/foodie/api/dispatch
git commit -m "feat(dispatch): plan bounded delivery batches"
```

### Task 3: Offer and Accept Deliveries Concurrency-Safely

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/dispatch/DispatchService.java`
- Create: `services/api/src/main/java/com/foodie/api/dispatch/DispatchController.java`
- Create: `services/api/src/main/java/com/foodie/api/dispatch/DispatchDtos.java`
- Create: `services/api/src/main/java/com/foodie/api/dispatch/OfferExpiryWorker.java`
- Create: service/API/concurrency tests

**Interfaces:**
- Produces: OPS `GET /api/v1/ops/dispatch/candidates`, `POST /offers`; DRIVER `GET /api/v1/driver/offers`, `POST /offers/{id}/accept|decline`; exact 60-second expiry.

- [ ] **Step 1: Write failing visibility/race/idempotency/expiry tests**

Assert the driver sees rounded pickup/drop-off zone, miles/minutes, stops, offered cents, and no customer name/full address before acceptance. Concurrent acceptance yields one winner and one `409`.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=DispatchServiceTest,DispatchApiIntegrationTest,DispatchConcurrencyTest'`

- [ ] **Step 3: Implement row-locked offer commands and expiry outbox work**

Decline never changes future eligibility or records an acceptance-rate score.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/dispatch services/api/src/test/java/com/foodie/api/dispatch
git commit -m "feat(dispatch): offer deliveries to drivers"
```

### Task 4: Complete Pickup and Delivery with PIN Proof

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/delivery/DeliveryPinService.java`
- Create: `services/api/src/main/java/com/foodie/api/delivery/DeliveryService.java`
- Create: `services/api/src/main/java/com/foodie/api/delivery/DriverDeliveryController.java`
- Create: `services/api/src/main/java/com/foodie/api/delivery/CustomerDeliveryController.java`
- Create: delivery/PIN/API tests

**Interfaces:**
- Consumes: `FOODIE_DELIVERY_PIN_SECRET_V1`, delivery ID/key version, expected state/version, optional `{latitude,longitude,accuracyMeters}`.
- Produces: customer PIN endpoint; driver `arrive`, `pickup`, and `deliver(pin,evidence)` commands; OPS `complete-override` with customer-confirmation reason.

- [ ] **Step 1: Write failing PIN/state/ownership/attempt-limit tests**

Derive a zero-padded six-digit HMAC-SHA256 PIN; verify constant-time. Five wrong attempts in 15 minutes locks self-service and alerts operations. Missing/denied/inaccurate geolocation does not block a valid PIN; PIN replay fails after delivery.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=DeliveryPinServiceTest,DeliveryServiceTest,DeliveryApiIntegrationTest'`

- [ ] **Step 3: Implement named state transitions and least-data DTOs**

Reveal the full delivery address to the assigned driver only after acceptance and until terminal state.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/delivery services/api/src/test/java/com/foodie/api/delivery
git commit -m "feat(delivery): verify pickup and PIN delivery"
```

### Task 5: Record Compensation and Release Driver Transfers

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/delivery/DriverEarningsService.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/DriverTransferService.java`
- Extend: `OperationsController.java`, Stripe webhook processor
- Create: earnings/transfer/reconciliation tests

**Interfaces:**
- Consumes: acceptance/completion/cancel timestamps, actual route miles, promised amount, tip, active-at-acceptance compensation policy.
- Produces: immutable earnings on terminal delivery; OPS reviewed `POST /api/v1/ops/driver-transfers/{earningId}/release`; Stripe transfer to driver recipient; reconciliation status.

- [ ] **Step 1: Write failing floor/tip/cancel/idempotency/balance tests**

Assert tip is 100%, policy is frozen, cancellation end time counts, one earning/transfer per assignment, insufficient platform balance remains payable, and retry reuses transfer idempotency key.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=DriverEarningsServiceTest,DriverTransferServiceTest'`

Expected: FAIL because earnings and transfer release are not implemented.

- [ ] **Step 3: Implement atomic earnings creation and explicit transfer release**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/{delivery,payments,operations} services/api/src/test
git commit -m "feat(payments): record and release driver earnings"
```

### Task 6: Send Durable Pilot Notifications

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/notification/NotificationSender.java`
- Create: `services/api/src/main/java/com/foodie/api/notification/TwilioNotificationSender.java`
- Create: `services/api/src/main/java/com/foodie/api/notification/SendGridNotificationSender.java`
- Create: `services/api/src/main/java/com/foodie/api/notification/NotificationService.java`
- Create: `services/api/src/main/java/com/foodie/api/notification/NotificationWorker.java`
- Create: notification tests

**Interfaces:**
- Consumes: outbox events for invitation, new order, accept/reject, assignment, pickup, delivery, cancel/refund; recipient consent/status.
- Produces: Twilio Messaging SMS with `FOODIE_TWILIO_ACCOUNT_SID`, backend-only auth token, sender; SendGrid email with backend-only key/sender; capped retry and operator-visible terminal failure.

- [ ] **Step 1: Write failing template/privacy/deduplication/retry tests**

No full address, PIN, payment data, or sensitive link in SMS/email. Same event+recipient+channel+template sends once. Retry backoff caps at 15 minutes and 8 attempts; opt-out/invalid destination stops retry.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=NotificationServiceTest,TwilioNotificationSenderContractTest,SendGridNotificationSenderContractTest,NotificationWorkerTest'`

Expected: FAIL because durable notification senders and worker do not exist.

- [ ] **Step 3: Implement SMS and email senders with Spring `RestClient`**

Use Twilio Messaging for urgent status SMS and Twilio SendGrid for invitation and receipt email. Read `FOODIE_SENDGRID_API_KEY` and sender address only on the backend.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/notification services/api/src/test/java/com/foodie/api/notification
git commit -m "feat(notification): send durable pilot SMS"
```

### Task 7: Build Driver and Operations Workspaces

**Files:**
- Create: `apps/web/src/features/{dispatch,delivery,operations}/*Api.ts`
- Create: `apps/web/src/app/driver/offers/page.tsx`
- Create: `apps/web/src/app/driver/deliveries/[id]/page.tsx`
- Create: `apps/web/src/app/ops/page.tsx`
- Create: `apps/web/src/app/ops/orders/[id]/page.tsx`
- Create: focused driver/ops components and tests

**Interfaces:**
- Consumes: Tasks 2–6 APIs.
- Produces: driver offer/active-delivery flow; ops queues, dispatch, timeline, webhook/outbox failures, refunds, overrides, earnings, and transfer release.

- [ ] **Step 1: Write failing role/privacy/race/polling/accessibility tests**

Assert offer compensation is visible before accept; address hidden until assignment; PIN input locks correctly; every high-impact ops action requires confirmation/reason; polling preserves focus/input.

- [ ] **Step 2: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/dispatch src/features/delivery src/features/operations src/app/driver src/app/ops`

- [ ] **Step 3: Implement small status pages with 5-second polling**

No maps, drag-and-drop dispatch board, WebSockets, or custom charting.

- [ ] **Step 4: Run complete validation**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 5: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): add driver and operations workspaces"
```
