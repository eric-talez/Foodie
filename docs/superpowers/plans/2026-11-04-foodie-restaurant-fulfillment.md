# Foodie Restaurant Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let approved restaurants receive authorized orders, accept or reject within five minutes, capture only after acceptance, and report preparation progress.

**Architecture:** A restaurant-scoped fulfillment service owns decisions and preparation status. Acceptance writes a durable payment command to the existing outbox; the signed Stripe capture webhook advances the order to `ACCEPTED`. A database worker handles capture/cancel requests and acceptance timeouts idempotently.

**Tech Stack:** Java 21, Spring Boot/JPA scheduling, PostgreSQL/Flyway/outbox, Next.js/React, Stripe gateway from Plan 6, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- A restaurant sees and mutates only its own orders.
- An order becomes visible to the restaurant only after authoritative payment authorization.
- Acceptance window is effective-dated configuration; initial pilot value is exactly 5 minutes.
- Acceptance never marks the order `ACCEPTED` until capture is confirmed by webhook.
- Rejection and timeout enqueue authorization cancellation; reason/actor/timestamp are audited.
- Closed/inactive restaurants cannot receive new orders; existing accepted orders remain operable.
- Status polling is used; do not add WebSockets.

## Review Focus

- Restaurant accept and timeout racing at the deadline must produce one decision and one provider command.
- Duplicate accept/reject/prep clicks must be idempotent or return a clear stale-version conflict.
- Capture failure must surface to restaurant, customer, and operations without showing `ACCEPTED`.
- A restaurant must not skip from accepted to ready or reverse preparation states.
- Worker retry/restart must not duplicate capture/cancel calls.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/restaurantops/
  RestaurantActivationService.java
  RestaurantFulfillment.java, RestaurantFulfillmentState.java
  RestaurantOrderService.java, RestaurantOrderController.java
  AcceptanceTimeoutWorker.java, PaymentCommandWorker.java
services/api/src/main/resources/db/common/V8__add_restaurant_fulfillment.sql
apps/web/src/app/restaurant/orders/page.tsx
apps/web/src/app/restaurant/orders/[id]/page.tsx
apps/web/src/components/restaurant/RestaurantOrderQueue.tsx
apps/web/src/components/restaurant/RestaurantOrderDetail.tsx
```

### Task 1: Gate Restaurant Activation

**Files:**
- Create: `services/api/src/main/resources/db/common/V8__add_restaurant_fulfillment.sql`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantActivationService.java`
- Extend: `OpsRestaurantController.java`, restaurant tests

**Interfaces:**
- Consumes: restaurant profile, active menu, hours, active zone, Stripe account capabilities, tax readiness.
- Produces: `POST /api/v1/ops/restaurants/{id}/activate` and `/suspend`; activation returns structured missing gates and requires OPS MFA/reason/version.

- [ ] **Step 1: Write failing readiness/authorization/version tests**

Assert every gate independently blocks activation, all gates activate once, suspension preserves existing order access, and no restaurant staff can activate itself.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=RestaurantActivationServiceTest`

- [ ] **Step 3: Add V8 fulfillment fields and readiness service**

V8 adds restaurant-order decision/deadline/preparation timestamps and effective acceptance-timeout policy; it does not duplicate order money snapshots.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V8__add_restaurant_fulfillment.sql services/api/src/main/java/com/foodie/api/restaurantops services/api/src/test
git commit -m "feat(restaurant): gate pilot activation"
```

### Task 2: Expose the Authorized Restaurant Order Queue

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/{RestaurantFulfillment,RestaurantFulfillmentState,RestaurantFulfillmentRepository}.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantOrderService.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantOrderController.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantOrderDtos.java`
- Create: `services/api/src/test/java/com/foodie/api/restaurantops/RestaurantOrderQueryIntegrationTest.java`

**Interfaces:**
- Consumes: authoritative `AUTHORIZED` payment event and restaurant actor.
- Produces: fulfillment state `AWAITING_DECISION`, `GET /api/v1/restaurant/orders`, and `/orders/{id}` with item snapshots, customer first name/initial only, delivery zone, tip-hidden, total, deadline, and payment status.

- [ ] **Step 1: Write failing visibility/scope/privacy tests**

Assert unauthorized/pending/other-restaurant orders are absent, full customer address/contact/card/tip is absent, and deadline is derived once when authorization arrives.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=RestaurantOrderQueryIntegrationTest`

- [ ] **Step 3: Create fulfillment exactly once from payment event**

Use a unique order FK and the order's policy snapshot for the five-minute deadline.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/restaurantops services/api/src/test/java/com/foodie/api/restaurantops
git commit -m "feat(restaurant): expose authorized order queue"
```

### Task 3: Accept, Reject, Capture, and Time Out Safely

**Files:**
- Extend: `RestaurantOrderService.java`, `RestaurantOrderController.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/PaymentCommandWorker.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/AcceptanceTimeoutWorker.java`
- Modify: `services/api/src/main/java/com/foodie/api/payments/StripeWebhookProcessor.java`
- Create: service/worker/concurrency tests

**Interfaces:**
- Produces: `POST /api/v1/restaurant/orders/{id}/accept` and `/reject` with `expectedVersion`; outbox `CAPTURE_PAYMENT` or `CANCEL_PAYMENT`; capture webhook calls `OrderCommandService.paymentCaptured(orderId)`.

- [ ] **Step 1: Write failing race/idempotency/retry tests**

Cover accept-vs-timeout, accept twice, reject twice, provider timeout, worker restart, out-of-order capture, capture failure, and stale version. Exactly one decision event and provider command must survive.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=RestaurantDecisionServiceTest,AcceptanceTimeoutWorkerTest,PaymentCommandWorkerTest'`

- [ ] **Step 3: Implement row-locked decisions and capped worker retries**

Workers claim with `FOR UPDATE SKIP LOCKED`, exponential backoff capped at 15 minutes, and expose terminal failure to operations after 8 attempts.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/restaurantops services/api/src/main/java/com/foodie/api/payments services/api/src/test
git commit -m "feat(restaurant): capture accepted orders safely"
```

### Task 4: Track Preparation Progress

**Files:**
- Extend: `RestaurantOrderService.java`, `RestaurantOrderController.java`, DTOs
- Extend: order/fulfillment tests

**Interfaces:**
- Consumes: accepted/captured order and restaurant actor.
- Produces: named commands `startPreparation(orderId, version)`, `updateReadyEstimate(orderId, version, minutes)`, `markReady(orderId, version)` and corresponding endpoints/timeline events.

- [ ] **Step 1: Write failing transition/boundary tests**

Estimate range is 5–120 minutes. Only `ACCEPTED → PREPARING → READY_FOR_PICKUP` is allowed; duplicate current-state command is idempotent; skips/reversals/canceled/payment-failed orders reject.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=RestaurantPreparationServiceTest`

Expected: FAIL because preparation commands do not exist.

- [ ] **Step 3: Implement the minimal named preparation transitions**

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/restaurantops services/api/src/test
git commit -m "feat(restaurant): track order preparation"
```

### Task 5: Build the Restaurant Fulfillment Workspace

**Files:**
- Create: `apps/web/src/features/restaurant/ordersApi.ts`
- Create: `apps/web/src/app/restaurant/orders/page.tsx`
- Create: `apps/web/src/app/restaurant/orders/[id]/page.tsx`
- Create: `apps/web/src/components/restaurant/RestaurantOrderQueue.tsx`
- Create: `apps/web/src/components/restaurant/RestaurantOrderDetail.tsx`
- Add: component/API tests

**Interfaces:**
- Consumes: Tasks 2–4 endpoints.
- Produces: 5-second polling queue, visible deadline, accept/reject confirmation, payment-confirming state, prep/ready controls, and actionable failures.

- [ ] **Step 1: Write failing queue/deadline/double-click/stale-version/accessibility tests**

Assert no optimistic accepted state, deadline expiration disables acceptance, rejection requires reason, polling does not reset focused controls, and errors are announced.

- [ ] **Step 2: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/restaurant src/components/restaurant`

- [ ] **Step 3: Implement with polling and existing styles only**

No sound, push notification, kitchen printer, or WebSocket.

- [ ] **Step 4: Run full validation**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 5: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): add restaurant fulfillment workspace"
```
