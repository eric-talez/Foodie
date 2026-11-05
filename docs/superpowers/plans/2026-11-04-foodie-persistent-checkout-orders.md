# Foodie Persistent Checkout and Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn an authoritative quote into an idempotent, immutable checkout attempt and durable order timeline without yet charging a card.

**Architecture:** The pricing module remains the only calculator. The new `ordering` module snapshots its result, menu text, address, policy versions, and allocations into normalized immutable rows; an explicit order transition policy controls later payment, restaurant, and delivery workflows.

**Tech Stack:** Java 21, Spring Boot 4.1.2, JPA, PostgreSQL/Flyway, Next.js, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Every checkout command is authenticated and requires a server-generated/validated authoritative quote.
- Money is integer USD cents and historical order economics never change when menu or fee policy changes.
- Each checkout request requires `Idempotency-Key`; reusing a key with a different normalized body returns `409`.
- Order, payment, and delivery use separate state machines; this plan creates only order state and a payment placeholder.
- State changes require optimistic version and append a timeline event in the same transaction.
- Demo checkout preview remains available; no UI may claim payment or order submission is live in this plan.

## Review Focus

- Duplicate requests, retry after timeout, and concurrent requests must create at most one checkout/order.
- A menu/price/address/policy change between cart and checkout must produce a new snapshot or explicit rejection.
- Tip and total allocation arithmetic must be exact and overflow-safe.
- Foreign address, restaurant, quote, checkout, or order IDs must not leak existence.
- Invalid or stale transitions must leave both aggregate and timeline unchanged.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/ordering/
  CheckoutAttempt.java, CustomerOrder.java, OrderLine.java
  OrderState.java, CheckoutStatus.java
  OrderEconomics.java, OrderTimelineEvent.java
  CheckoutService.java, OrderTransitionPolicy.java
  CheckoutController.java, OrderController.java, OrderingDtos.java
services/api/src/main/java/com/foodie/api/outbox/
  OutboxMessage.java, OutboxRepository.java, OutboxService.java
services/api/src/main/resources/db/common/V6__create_orders.sql
apps/web/src/app/checkout/page.tsx
```

### Task 1: Create Immutable Order and Outbox Storage

**Files:**
- Create: `services/api/src/main/resources/db/common/V6__create_orders.sql`
- Create: ordering entities/enums/repositories listed above
- Create: `services/api/src/main/java/com/foodie/api/outbox/{OutboxMessage,OutboxRepository,OutboxService}.java`
- Create: `services/api/src/test/java/com/foodie/api/ordering/OrderPersistenceIntegrationTest.java`

**Interfaces:**
- Consumes: customer, restaurant, address, fee policy, menu IDs.
- Produces: immutable order/address/economics/line/modifier snapshots; mutable order state+version; append-only timeline; checkout idempotency body hash; transactional outbox with unique deduplication key.

- [ ] **Step 1: Write failing schema/constraint/immutability tests**

Pin order-number uniqueness, `(customer_id,idempotency_key)` uniqueness, nonnegative cents, `total = subtotal + service + delivery + tax + tip`, `applicationFee = commission + service + delivery + tip`, one event sequence per order, and no UPDATE/DELETE repository for snapshots/events.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=OrderPersistenceIntegrationTest`

- [ ] **Step 3: Add V6 and focused mappings**

Use `timestamptz`, UUID keys, `@Version`, explicit foreign keys, and a SHA-256 normalized request hash. Store descriptions/prices as snapshot values, not JSON-only references.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V6__create_orders.sql services/api/src/main/java/com/foodie/api/ordering services/api/src/main/java/com/foodie/api/outbox services/api/src/test/java/com/foodie/api/ordering
git commit -m "feat(ordering): add immutable checkout storage"
```

### Task 2: Produce Checkout-Grade Pricing Snapshots

**Files:**
- Modify: `services/api/src/main/java/com/foodie/api/pricing/QuoteService.java`
- Create: `services/api/src/main/java/com/foodie/api/pricing/PricedQuote.java`
- Create: `services/api/src/main/java/com/foodie/api/ordering/OrderSnapshotFactory.java`
- Extend: quote and ordering unit tests

**Interfaces:**
- Consumes: `QuoteRequest`, authenticated user, tip cents, active policy version.
- Produces: `QuoteService.priceForCheckout(QuoteRequest) -> PricedQuote`; `OrderSnapshotFactory.create(PricedQuote, tipCents)` with all exact line/modifier/address/economics values.

- [ ] **Step 1: Write failing snapshot arithmetic and stale-data tests**

Allow tip `0..10000`; assert total includes tip, application fee excludes tax/restaurant food net, restaurant gross equals `subtotal - commission + tax`, and any inactive item/address/restaurant rejects the entire snapshot.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=QuoteServiceTest,OrderSnapshotFactoryTest'`

- [ ] **Step 3: Expose one immutable pricing result without duplicating calculation**

Move only the existing calculation output boundary; keep one catalog validation loop and one money implementation.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/pricing services/api/src/main/java/com/foodie/api/ordering services/api/src/test
git commit -m "refactor(pricing): expose checkout snapshot input"
```

### Task 3: Create Idempotent Checkout Attempts

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/ordering/CheckoutService.java`
- Create: `services/api/src/main/java/com/foodie/api/ordering/CheckoutController.java`
- Create: `services/api/src/main/java/com/foodie/api/ordering/OrderingDtos.java`
- Create: `services/api/src/test/java/com/foodie/api/ordering/CheckoutServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/ordering/CheckoutApiIntegrationTest.java`

**Interfaces:**
- Consumes: `Idempotency-Key` (16–128 visible ASCII characters), cart quote inputs, tip, actor, expected address/restaurant.
- Produces: `POST /api/v1/checkout-attempts` → `CheckoutAttemptResponse(id, orderId, orderNumber, status="AWAITING_PAYMENT_SETUP", version, economics, expiresAt)`; `GET /api/v1/checkout-attempts/{id}`.

- [ ] **Step 1: Write failing first/retry/conflict/concurrency tests**

Assert same key+body returns same IDs/status; same key+different body is `409`; two concurrent requests create one row; missing/invalid key is `400`; a customer cannot access another attempt.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=CheckoutServiceTest,CheckoutApiIntegrationTest'`

- [ ] **Step 3: Implement one transaction and exact expiry**

Checkout snapshot expires after 5 minutes. Create order state `AWAITING_PAYMENT_AUTHORIZATION` and timeline event `CHECKOUT_CREATED` in the same transaction.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/ordering services/api/src/test/java/com/foodie/api/ordering
git commit -m "feat(checkout): create idempotent order attempts"
```

### Task 4: Pin Order Transition Rules and Read Models

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/ordering/OrderTransitionPolicy.java`
- Create: `services/api/src/main/java/com/foodie/api/ordering/OrderCommandService.java`
- Create: `services/api/src/main/java/com/foodie/api/ordering/OrderQueryService.java`
- Create: `services/api/src/main/java/com/foodie/api/ordering/OrderController.java`
- Create: `services/api/src/test/java/com/foodie/api/ordering/OrderTransitionPolicyTest.java`
- Create: `services/api/src/test/java/com/foodie/api/ordering/OrderApiIntegrationTest.java`

**Interfaces:**
- Consumes: `OrderCommand(orderId, expectedVersion, actor, reason)`.
- Produces: allowed transitions from the spec, customer-owned `GET /api/v1/orders` and `/orders/{id}`, package-private service methods later called by payment/restaurant/delivery modules.

- [ ] **Step 1: Write a table-driven failing transition test**

Test every allowed edge and representative forbidden reverse/skip/terminal transition; reason is mandatory for `REJECTED`, `CANCELED`, or `FAILED`.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=OrderTransitionPolicyTest,OrderApiIntegrationTest'`

- [ ] **Step 3: Implement the policy and append-only event sequence**

Do not expose a generic `setState`. Named service methods call one guarded transition function.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/ordering services/api/src/test/java/com/foodie/api/ordering
git commit -m "feat(ordering): enforce order state transitions"
```

### Task 5: Add a Non-Payment Checkout Screen

**Files:**
- Extend: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/features/checkout/checkoutApi.ts`
- Create: `apps/web/src/features/checkout/checkoutApi.test.ts`
- Create: `apps/web/src/app/checkout/page.tsx`
- Create: `apps/web/src/components/CheckoutForm.tsx`
- Create: `apps/web/src/components/CheckoutForm.test.tsx`
- Modify: `apps/web/src/components/CheckoutPreview.tsx`

**Interfaces:**
- Consumes: current cart quote, actor, address, and Task 3 endpoint.
- Produces: authenticated pilot checkout review with optional tip and durable attempt; demo continues to `/checkout-preview`; ordering button remains disabled with `Payment setup is not available yet`.

- [ ] **Step 1: Write failing tip/idempotency/persistence/accessibility tests**

Assert double click uses one idempotency key, retry reuses it until cart input changes, displayed allocation comes from server, and no success/order-placed wording appears.

- [ ] **Step 2: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/checkout src/components/CheckoutForm.test.tsx`

- [ ] **Step 3: Implement the minimum review form**

Keep the current local cart; do not add server cart persistence.

- [ ] **Step 4: Run complete validation**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): create durable checkout attempts"
```
