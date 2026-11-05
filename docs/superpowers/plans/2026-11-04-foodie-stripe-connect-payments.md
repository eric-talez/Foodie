# Foodie Stripe Connect Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onboard restaurant merchant accounts, authorize customer cards, capture only after restaurant acceptance, process authoritative webhooks, and reconcile refunds using Stripe test mode before any live enablement.

**Architecture:** Stripe Accounts v2 direct charges make each restaurant the merchant of record. The backend owns PaymentIntent/account/tax calls and signed webhook processing; Stripe Payment Element owns card entry. PostgreSQL payment and webhook-inbox rows separate provider state from order state.

**Tech Stack:** `stripe-java@34.0.0`, Stripe Accounts v2, Stripe Tax, PaymentIntents, `@stripe/stripe-js@10.2.1`, `@stripe/react-stripe-js@7.0.1`, Spring Boot, PostgreSQL, Next.js

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Restaurant accounts use Accounts v2 Merchant configuration, full Dashboard, and Stripe as fee/loss collector.
- Direct charges use `capture_method=manual`; authorization is final only after a verified webhook.
- Application fee equals the immutable order snapshot's commission + service fee + delivery fee + tip.
- Foodie never receives or stores card details, bank details, KYC documents, client secrets in logs, or Stripe secret keys in the browser.
- Every provider mutation uses a stable server idempotency key; every Stripe event ID is accepted once.
- Pilot startup fails if test keys are configured; demo startup fails if live keys are configured.
- Live ordering remains disabled until tax/legal/account responsibility gates are signed off.

## Review Focus

- Synchronous Stripe success followed by delayed/duplicate/out-of-order webhooks must converge safely.
- Capture failure must never mark an order accepted.
- Cancel/refund/application-fee refund combinations must reconcile without double reimbursement.
- One restaurant's PaymentIntent/account must never be retrieved or mutated under another restaurant header.
- Webhook signature failure, oversized body, unknown event, poison event, and retry exhaustion must be visible and safe.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/payments/
  StripeConfiguration.java, StripeGateway.java
  RestaurantPaymentAccount.java, Payment.java, PaymentState.java
  PaymentService.java, PaymentController.java
  StripeWebhookController.java, StripeWebhookProcessor.java
  RefundService.java, ReconciliationService.java
services/api/src/main/java/com/foodie/api/tax/StripeTaxCalculator.java
services/api/src/main/resources/db/common/V7__create_payments.sql
apps/web/src/components/payment/PaymentForm.tsx
```

### Task 1: Add Payment and Webhook Persistence

**Files:**
- Modify: `services/api/pom.xml`
- Create: `services/api/src/main/resources/db/common/V7__create_payments.sql`
- Create: payment entities/enums/repositories
- Create: `services/api/src/test/java/com/foodie/api/payments/PaymentPersistenceIntegrationTest.java`

**Interfaces:**
- Consumes: restaurant and order IDs.
- Produces: unique restaurant Stripe account, unique order payment, unique PaymentIntent/charge/refund IDs, separate payment state/version, signed-event inbox with `RECEIVED|PROCESSING|PROCESSED|FAILED`, attempt count, payload JSON, and SHA-256.

- [ ] **Step 1: Write failing schema/uniqueness/state tests**

Assert cents are nonnegative, one payment per order, one event per Stripe ID, payload is inaccessible through public DTOs, and state/timestamp/version persist independently from order.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=PaymentPersistenceIntegrationTest`

- [ ] **Step 3: Add exact stable SDK and V7**

Add `com.stripe:stripe-java:34.0.0`. Do not use beta/alpha artifacts or global mutable `Stripe.apiKey`; inject a configured `StripeClient`.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/pom.xml services/api/src/main/resources/db/common/V7__create_payments.sql services/api/src/main/java/com/foodie/api/payments services/api/src/test/java/com/foodie/api/payments
git commit -m "feat(payments): persist accounts and payment state"
```

### Task 2: Onboard Restaurant Merchant Accounts

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/payments/StripeConfiguration.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/StripeGateway.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/StripePaymentGateway.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/RestaurantPaymentAccountService.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/RestaurantPaymentAccountController.java`
- Create: `services/api/src/test/java/com/foodie/api/payments/RestaurantPaymentAccountServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/payments/StripeAccountContractTest.java`

**Interfaces:**
- Consumes: scoped restaurant actor and configured Stripe mode.
- Produces: `POST /api/v1/restaurant/me/payment-account`, `/onboarding-link`, and `GET /status`; Accounts v2 Merchant configuration with `dashboard=full`, fees/losses collector `stripe`, card-payments requested.

- [ ] **Step 1: Write failing account configuration and ownership tests**

Assert exact immutable controller responsibilities, one Stripe account per restaurant, safe retry, allowlisted HTTPS return/refresh URLs, capability refresh, and no raw provider error/body in API or logs.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=RestaurantPaymentAccountServiceTest,StripeAccountContractTest'`

- [ ] **Step 3: Implement hosted onboarding only**

Foodie stores account ID and capability/status fields. It never collects bank/KYC fields.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/payments services/api/src/test/java/com/foodie/api/payments services/api/src/main/resources
git commit -m "feat(payments): onboard restaurant merchant accounts"
```

### Task 3: Calculate Live Tax and Create Manual-Capture Authorizations

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/tax/StripeTaxCalculator.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/PaymentService.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/PaymentController.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/PaymentDtos.java`
- Create: `services/api/src/test/java/com/foodie/api/tax/StripeTaxCalculatorTest.java`
- Create: `services/api/src/test/java/com/foodie/api/payments/PaymentServiceTest.java`

**Interfaces:**
- Consumes: active checkout attempt, restaurant connected account, saved address, immutable allocations, `Idempotency-Key`.
- Produces: Stripe Tax calculation reference; `POST /api/v1/checkout-attempts/{id}/payment` → `{paymentId, clientSecret, connectedAccountId, publishableKey, status}`; PaymentIntent manual capture and exact application fee.

- [ ] **Step 1: Write failing tax/authorization/allocation tests**

Assert connected-account context, address/menu line mapping, tax reference persisted into a fresh snapshot, amount/application fee equality, metadata only contains Foodie IDs, expired attempt rejection, and same command returns same PaymentIntent.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=StripeTaxCalculatorTest,PaymentServiceTest'`

- [ ] **Step 3: Implement provider calls behind the narrow gateway**

Never accept amount, application fee, tax, connected account, or currency from the browser. Set currency `usd` and capture method `manual` exactly.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/tax services/api/src/main/java/com/foodie/api/payments services/api/src/test
git commit -m "feat(payments): authorize direct restaurant charges"
```

### Task 4: Process Signed Webhooks Idempotently

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/payments/StripeWebhookController.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/StripeWebhookProcessor.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/StripeEventMapper.java`
- Create: `services/api/src/test/java/com/foodie/api/payments/StripeWebhookControllerTest.java`
- Create: `services/api/src/test/java/com/foodie/api/payments/StripeWebhookProcessorIntegrationTest.java`

**Interfaces:**
- Consumes: raw request body (max 1 MiB), `Stripe-Signature`, mode-specific webhook secret.
- Produces: `POST /api/v1/webhooks/stripe`; authoritative handling for PaymentIntent authorization/capture/cancel/failure, refund, dispute, account capability, and transfer events.

- [ ] **Step 1: Write failing signature/duplicate/order/retry tests**

Assert invalid signature stores nothing; duplicate event is 2xx/no-op; capture before authorization converges by provider-object retrieval; unknown event is acknowledged/recorded; processor failure records retryable failure without acknowledging business success.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=StripeWebhookControllerTest,StripeWebhookProcessorIntegrationTest'`

- [ ] **Step 3: Implement verify-first inbox processing**

Commit inbox insertion before asynchronous processing; use row locking and idempotent transition functions. Do not log raw payload.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/payments services/api/src/test/java/com/foodie/api/payments
git commit -m "feat(payments): process authoritative Stripe webhooks"
```

### Task 5: Add Capture, Cancel, Refund, and Reconciliation Services

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/payments/RefundService.java`
- Create: `services/api/src/main/java/com/foodie/api/payments/ReconciliationService.java`
- Extend: `PaymentService.java`, `PaymentController.java`, payment tests

**Interfaces:**
- Produces: package-level `requestCapture(orderId)`, `requestCancel(orderId, reason)` for Plan 7; OPS `POST /api/v1/ops/orders/{id}/refunds`; `GET /api/v1/ops/orders/{id}/reconciliation`.

- [ ] **Step 1: Write failing idempotency/allocation/pending tests**

Cover full/partial refund bounds, application-fee refund, already canceled/captured, dashboard-initiated refund mismatch, provider timeout pending state, dispute freeze, and reason/MFA requirement.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=PaymentServiceTest,RefundServiceTest,ReconciliationServiceTest'`

- [ ] **Step 3: Implement explicit provider commands and reconciliation read model**

No generic money-adjustment endpoint. A provider timeout remains pending until webhook/reconciliation resolves it.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/payments services/api/src/test/java/com/foodie/api/payments
git commit -m "feat(payments): reconcile captures and refunds"
```

### Task 6: Collect Card Details with Payment Element

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/features/payment/paymentApi.ts`
- Create: `apps/web/src/components/payment/PaymentForm.tsx`
- Create: `apps/web/src/components/payment/PaymentForm.test.tsx`
- Modify: `apps/web/src/app/checkout/page.tsx`
- Create: `apps/web/src/app/orders/[id]/page.tsx`
- Add: API/component tests

**Interfaces:**
- Consumes: Task 3 response and Auth0 access token.
- Produces: Stripe Elements initialized with publishable key plus `stripeAccount`; confirmation redirect to customer order status; no client-side success before API/webhook status becomes `AUTHORIZED`.

- [ ] **Step 1: Install exact stable Stripe browser packages**

Run: `pnpm.cmd --filter @foodie/web add @stripe/stripe-js@10.2.1 @stripe/react-stripe-js@7.0.1 --save-exact`

- [ ] **Step 2: Write failing loading/double-submit/provider-error/pending tests**

Assert card DOM never belongs to Foodie, submit is disabled until Elements ready, repeated confirmation reuses payment, redirect cannot forge success, and polling shows pending/failure/accessibility states.

- [ ] **Step 3: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/payment src/components/payment/PaymentForm.test.tsx`

- [ ] **Step 4: Implement Payment Element and server-status polling**

Do not add saved cards, wallets configuration UI, or post-payment tip edits.

- [ ] **Step 5: Run complete validation**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 6: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): authorize cards with Stripe Elements"
```
