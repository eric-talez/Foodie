# Foodie Investor Demo and South Bay Pilot Design

**Date:** 2026-11-04
**Status:** Pending approval
**Scope:** One maintainable product that supports a polished investor/restaurant demo and an invite-only, live-payment South Bay pilot

## Intent

Foodie will prove that local delivery can be more transparent for customers, less expensive for restaurants, and still pay independent delivery contractors fairly. The next phase must achieve two outcomes without creating two products:

1. a convincing investor and restaurant demo using fictional data and Stripe test mode; and
2. a controlled South Bay pilot in which invited customers, restaurants, drivers, and operators complete real orders and real card payments.

The first pilot targets Santa Clara and San Jose. Coverage is address-based and local: a customer may live anywhere in the enabled cities, but only nearby restaurants that can economically serve that address are orderable.

## Approved Product Decisions

- The pilot includes real card authorization, capture, refunds, restaurant settlement, and driver transfers.
- The restaurant is the seller and merchant of record. Foodie is the ordering and delivery platform.
- Customer payment is authorized at checkout and captured only after the restaurant accepts the order.
- A restaurant rejection or acceptance timeout cancels the authorization.
- The first pilot is invite-only: approximately 3–5 restaurants, 5–10 drivers, and 50–100 customers.
- Drivers are independent contractors. They choose availability and may accept or decline each offered delivery.
- Grouped delivery is the default value option; direct delivery costs more.
- Grouping is limited to two orders and no more than ten modeled minutes of detour.
- A grouped order is never canceled or repriced solely because a compatible second order was not found.
- The demo uses test-mode integrations; the pilot uses live-mode integrations.
- The existing Java modular monolith, Next.js application, and PostgreSQL database remain the foundation.

## Goals

- Complete one real order without manual database edits: invite, address, quote, card authorization, restaurant acceptance, capture, preparation, dispatch, pickup, delivery proof, reconciliation, and driver earnings.
- Let customers see every fee, tax, tip, delivery choice, and total before confirming payment.
- Let restaurant staff accept or reject an order, update its preparation status, and see an understandable settlement breakdown.
- Let drivers see the route summary and offered compensation before accepting, then complete pickup and delivery with auditable proof.
- Give operators one timeline for every order, payment, restaurant action, delivery action, notification, refund, and transfer.
- Make the investor demo follow the same product paths and state machines as the live pilot.
- Keep each implementation slice independently testable, reviewable, and reversible.

## Non-Goals

- Native iOS or Android applications in this phase; all roles use the responsive web application.
- Open public signup, public restaurant onboarding, or nationwide availability.
- Autonomous dispatch optimization, demand forecasting, surge pricing, or live driver-map animation.
- More than two orders in a delivery batch.
- Customer subscriptions, loyalty, promotions, advertising, reviews, or saved payment methods.
- A general accounting system, payroll system, tax-filing product, or custom identity provider.
- Microservices, Kafka, Redis, Kubernetes, GraphQL, or a separate search service.
- Automatic menu ingestion from POS vendors.
- Replacing trained pilot operations with automation before actual pilot data justifies it.

## Anti-Goals

- A polished demo backed by fake buttons or flows that cannot work in the pilot.
- A live pilot that shares customer, payment, or operational data with the demo.
- Treating a successful Stripe API response as final when a signed webhook can later disagree.
- Storing card details, identity-provider passwords, bank details, or sensitive verification documents in Foodie.
- Hiding driver compensation, restaurant commission, or customer fees in combined or ambiguous line items.
- Encoding current California compensation or tax rates as permanent constants.
- Adding abstraction layers solely for a hypothetical future provider or scale.

## Approaches Considered

### 1. Build the polished demo first, then rebuild for the pilot

This is initially fast, but it duplicates ordering and payment behavior and makes the demo misleading. It was rejected because every demo-only shortcut becomes migration work before the first live order.

### 2. Use one deployment and switch between demo and live behavior with flags

This minimizes infrastructure but creates an unacceptable chance of test orders, seeded identities, or test payment configuration reaching the live pilot. It was rejected because operational safety matters more than one extra small deployment.

### 3. One codebase, two isolated deployments, shared production paths — selected

Demo and pilot use the same source code, APIs, state machines, and role screens. Each has separate configuration, credentials, databases, identity tenants, Stripe modes, and hostnames. Demo-only seed/reset operations are structurally unavailable in the pilot profile. This preserves an honest demo while keeping the live-data boundary simple enough to audit.

## System Shape

```text
Browser / responsive PWA
        |
        v
Next.js web application
        |
        v
Spring Boot modular monolith
  | identity | catalog | servicearea | pricing |
  | ordering | payments | restaurantops       |
  | driver   | dispatch | operations | notify |
        |
        +---- PostgreSQL
        +---- Managed OIDC
        +---- Stripe Connect / Tax
        +---- Address and Routes provider
        +---- SMS/email provider
```

There remains one frontend deployable, one backend deployable, and one PostgreSQL database per environment. Modules are Java packages with explicit service interfaces, not separately deployed services. The current `catalog`, `servicearea`, and `pricing` packages are extended rather than replaced.

### Deployment isolation

| Concern | Demo | Pilot |
| --- | --- | --- |
| Hostname | demo-only | pilot-only |
| Database | fictional/resettable | real, backed up, no demo reset |
| Identity | test tenant and test personas | invited real identities |
| Stripe | test mode and test connected accounts | live mode and approved connected accounts |
| Address/routes | provider sandbox or low-quota project | production project with budget alerts |
| Notifications | allowlisted recipients | invited participant contacts |
| Seed data | explicit demo scenario | no fictional operational rows |

Environment choice is deployment configuration, never a customer-controlled request field. Live startup fails closed if test Stripe keys, demo identity issuer, or demo seed configuration is present.

## Role and Identity Model

Foodie uses a managed OpenID Connect provider and Spring Security's standard JWT resource-server validation. This is the selected direction; the exact provider is a procurement/configuration choice before the identity implementation plan. The web client keeps short-lived access tokens in memory, never local storage. Foodie stores only the stable identity subject, verified contact references, status, and role assignments.

Roles are `CUSTOMER`, `RESTAURANT_STAFF`, `DRIVER`, and `OPS_ADMIN`. An authenticated identity has no authority until it matches an active Foodie invitation. The API reads roles and restaurant/driver ownership from PostgreSQL on every protected operation; it does not trust a role sent by the browser.

- Customer invitations grant pilot access.
- Restaurant invitations bind staff to exactly one restaurant for the pilot.
- Driver invitations bind the identity to one approved driver profile.
- Operations invitations require multi-factor authentication at the identity provider.
- Disabling a Foodie membership removes authority without deleting the external identity.

Foodie does not build password reset, MFA enrollment, KYC, or bank-account forms.

## Restaurant Onboarding and Catalog

Operations creates the restaurant record and sends the initial staff invitation. Restaurant representatives complete Stripe-hosted connected-account onboarding. Foodie stores Stripe account identifiers and capability/status fields, not bank or identity documents.

A restaurant cannot receive orders until all of these are true:

- Foodie operations approved the restaurant agreement and pilot status;
- the Stripe connected account can accept charges and receive payouts;
- operating hours and a pickup address are configured;
- at least one active menu item exists;
- the restaurant is inside an active service zone; and
- tax responsibility and configuration have passed the launch gate.

Restaurant staff may edit operating hours, item availability, preparation time, and the existing menu content. The pilot does not include bulk import, POS synchronization, multi-location restaurant groups, or self-service commission changes. Fee policies are effective-dated and changed only by operations.

## Address, Service Area, and Routing

The current predefined sample locations remain demo fixtures. The pilot adds real customer address entry through a provider-hosted or provider-backed validation flow. The backend stores the normalized address, coordinates, validation result, and service-zone decision; the browser cannot declare an address eligible.

The initial implementation uses one provider project for address validation/geocoding and route-matrix calculations, behind two narrow Java interfaces:

- `AddressValidator.validate(rawAddress)` returns a normalized address and coordinates.
- `RoutePlanner.plan(stops)` returns road distance, duration, and stop order inputs.

The provider decision is made before this implementation plan; Google Address Validation and Routes are the default candidate because both needs can be met by one vendor. Provider responses are cached in PostgreSQL with an expiry appropriate to the data. Redis is not introduced.

Restaurant discovery uses road-route eligibility when available and fails closed when eligibility cannot be established. Grouped delivery allows no more than two orders and ten additional modeled minutes. Direct and grouped distance limits remain effective-dated fee-policy data and must be calibrated with pilot routes rather than copied permanently from the demo assumptions.

A grouped order waits no more than 15 minutes after restaurant acceptance for a compatible second order. If no match exists at that cutoff, Foodie dispatches it alone at the original grouped price and absorbs the unbatched cost. Operations may offer an optional direct-delivery upgrade before the cutoff, but silence or refusal never increases the price or cancels the order. The pilot measures this subsidy explicitly; pricing or availability may be changed only for future quotes.

## Pricing, Tax, and Quote Rules

All money remains integer USD cents. Each accepted quote is persisted as an immutable snapshot containing:

- menu item and modifier descriptions and prices;
- food subtotal;
- restaurant commission;
- customer service fee;
- grouped or direct delivery fee;
- tax amount and tax calculation reference;
- driver tip;
- customer total;
- expected restaurant amount, platform amount, and driver amount; and
- the effective policy versions used.

The live pilot starts from the existing balanced model: 12% restaurant commission, 5% customer service fee capped at $3.00, $6.99 grouped delivery, and $11.49 direct delivery. These are pilot hypotheses, not promises. Operations can activate a new effective-dated policy for future quotes; an existing order never changes.

Tips are selected at checkout and go 100% to the assigned driver. Post-delivery tip adjustment and customer subscriptions are deferred.

Tax calculation is a launch gate, not a hardcoded percentage. The default implementation direction is Stripe Tax on the restaurant's direct charge after a California tax professional confirms the restaurant-as-seller structure and which fees are taxable. If Foodie elects marketplace-facilitator treatment as a delivery network company, the design must be amended before live launch. No live order is enabled with the demo tax rate.

## Order, Payment, and Delivery State

The system uses three related state machines instead of one overloaded status.

### Order

`AWAITING_PAYMENT_AUTHORIZATION` → `AWAITING_RESTAURANT` → `ACCEPTED` → `PREPARING` → `READY_FOR_PICKUP` → `COMPLETED`

Terminal or exceptional outcomes are `REJECTED`, `CANCELED`, and `FAILED`. A reason code and actor are required for every non-happy-path transition.

### Payment

`CREATED` → `AUTHORIZED` → `CAPTURE_PENDING` → `CAPTURED`

Exceptional states are `CANCEL_PENDING`, `CANCELED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`, and `DISPUTED`.

### Delivery

`UNASSIGNED` → `OFFERED` → `ASSIGNED` → `AT_RESTAURANT` → `PICKED_UP` → `DELIVERED`

Exceptional states are `CANCELED` and `FAILED`.

Each aggregate has an optimistic-lock version. Commands state the expected version so duplicate clicks and simultaneous restaurant/operator actions cannot silently overwrite one another. Every accepted transition appends an order-timeline event in the same database transaction. This is an audit timeline, not event sourcing.

## Successful Order Flow

1. An invited customer signs in, validates an eligible address, selects one restaurant, and requests a server-priced quote.
2. The API creates a short-lived checkout attempt and Stripe PaymentIntent on the restaurant connected account. The restaurant is merchant of record; Foodie requests its application fee. Card collection uses Stripe-hosted Payment Element fields, so Foodie never receives card details.
3. The customer confirms the PaymentIntent. A signed Stripe webhook records authorization. The order becomes visible to the restaurant only after authorization is authoritative.
4. Restaurant staff accept or reject. The proposed pilot acceptance window is five minutes and is effective-dated configuration.
5. Acceptance requests capture. The order becomes `ACCEPTED` only after the authoritative capture event. Rejection or timeout requests authorization cancellation.
6. Restaurant staff mark preparation progress. The customer status page polls the API; WebSockets are deferred.
7. The delivery becomes dispatch-eligible at restaurant acceptance. Operations sends an offer when the predicted pickup window is approximately ten minutes away, adjusting with the restaurant's current preparation estimate. Each offer shows pickup, drop-off zone, route estimate, batching state, and guaranteed offered compensation before acceptance.
8. A driver accepts, confirms arrival and pickup, and completes delivery using the customer's short PIN and timestamps. Browser geolocation is collected as best-effort supporting evidence when permission and useful accuracy are available. Photos are not collected in the first pilot.
9. Completion records driver earnings and final order economics. A daily operator-reviewed job creates the Stripe transfer to the driver's connected account after the platform balance is available.
10. The reconciliation view matches the order snapshot to Stripe charge, application fee, refund/reversal, driver transfer, and final statuses.

No step relies on an operator changing the database. Operations may perform explicit, audited product actions for exceptions.

## Stripe Connect Money Movement

The default payment architecture is a Stripe Connect direct charge on the restaurant connected account with `capture_method=manual` and a Foodie application fee.

Restaurants use Stripe Accounts v2 with Merchant configuration, full Stripe Dashboard access, and Stripe as both payment-fee collector and connected-account loss collector. Stripe therefore owns hosted requirements collection, debits processing fees from the restaurant account, and is responsible for that connected account's negative balance under the configured model. Foodie remains responsible for its own platform balance. Drivers use Accounts v2 Recipient configuration with Stripe-hosted requirements collection, Express Dashboard access, and the `stripe_transfers` capability; they do not accept customer charges. These configurations are validated with Stripe before account creation because responsibility fields cannot be changed later.

Restaurants control their Stripe payout account and can see their full Stripe reporting. Foodie initiates order refunds through its audited operations flow and listens for every refund event, including a refund initiated directly in the restaurant's Stripe Dashboard. A dashboard-initiated refund that does not match Foodie's allocations becomes a reconciliation exception rather than being silently rewritten. Foodie controls transfers into driver connected accounts; Stripe owns the external-bank payout and requirements experience exposed through the driver's Express Dashboard.

```text
Customer card
   |
   v
Restaurant connected account (direct charge; merchant of record)
   |-- restaurant portion and tax remain attributable to restaurant
   |-- Stripe processing/connected-account fees follow signed pricing
   |
   +--> Foodie application fee
            |-- platform revenue
            |-- delivery funds and driver tip
            +--> later transfer to driver connected account
```

The application fee must cover the platform revenue, delivery funds, and driver tip that Foodie later transfers. The exact allocation and responsibility for Stripe fees, refunds, negative balances, and tax are contractual/accounting launch decisions. They are tested with Stripe sandbox transactions before live mode is enabled.

Signed webhooks are the authority for PaymentIntent, charge, refund, dispute, connected-account capability, and transfer outcomes. Every Stripe event ID is inserted once into a durable webhook inbox. Processing is transactional and repeatable; duplicate and out-of-order deliveries are expected. Browser redirects and synchronous Stripe responses provide progress only.

Checkout attempts and mutating provider requests carry server-generated idempotency keys. Stripe object IDs are unique in Foodie. Secrets and webhook signing keys are backend-only and separated by environment.

## Cancellation, Refund, and Dispute Rules

- Before restaurant acceptance: rejection, timeout, or customer cancellation cancels the authorization and charges no Foodie cancellation fee.
- After acceptance but before pickup: an operator applies the disclosed pilot cancellation policy and records the reason; any refund is explicit and auditable.
- Restaurant cancellation, non-delivery, or unrecoverable platform failure: full refund, with related application-fee and driver-transfer reversals where possible.
- Item or service issue after delivery: operations may issue a partial or full refund; restaurant and platform allocations are recorded separately.
- Disputes: record the Stripe event, freeze unresolved internal settlement for that order, and expose evidence/status to operations.

Automated exception policy beyond the safe cases above is deferred until pilot data exists.

## Driver Model, Dispatch, and Compensation

Drivers set themselves available or unavailable. Foodie does not require shifts, minimum hours, mandatory offer acceptance, exclusivity, or acceptance-rate penalties. Operations performs human-assisted dispatch for the pilot; there is no optimization engine.

The dispatcher sees eligible available drivers ordered by practical route fit. It can offer a single order or a proposed two-order batch. The driver may accept or decline. Offer expiry is configuration; 60 seconds is the proposed pilot default. If no driver accepts, operations can retry, convert a proposed batch, delay with customer communication, or cancel/refund.

For Foodie's records, compensated engaged time starts when the driver accepts an offer and ends when the delivery is completed or the assignment is canceled. The system records acceptance, arrival, pickup, drop-off, and cancellation timestamps plus route miles. Counsel must confirm this interpretation against the current California definition before live launch; a different approved interpretation changes effective-dated compensation policy, not historical records.

Each offer stores the promised base amount and route assumptions. Final earnings are the greater of:

1. the promised offer; or
2. the effective-dated California compliance floor calculated from recorded engaged time and miles,

plus 100% of the tip and any explicit adjustment. Current statutory rates are configuration with source and effective date, never code constants. Legal review must confirm the applicable Proposition 22 calculation, insurance, safety training, background checks, and contractor agreement before launch.

## Operations, Notifications, and Audit

The operations console is deliberately narrow:

- order queue and full timeline;
- restaurant and driver availability/capability status;
- payment, refund, dispute, and driver-transfer status;
- dispatch offers and assignments;
- failed webhook/outbox work with retry controls;
- audited cancellation, refund, compensation adjustment, and reassignment actions; and
- daily reconciliation and launch-readiness checks.

Customer, restaurant, driver, and operations screens poll server state at short intervals while open. Durable SMS/email notifications are sent from a PostgreSQL outbox for invitation, new order, acceptance/rejection, driver assignment, pickup, delivery, cancellation, and refund. A provider is selected before the notification implementation plan. Failed deliveries retry with capped exponential backoff and become operator-visible; they do not roll back the business transaction.

Logs use correlation IDs and provider IDs but exclude card data, access tokens, full addresses, PINs, and sensitive onboarding data. Money and authority changes produce immutable audit records containing actor, action, target, before/after state, reason, and timestamp.

## Durable Work Without Additional Infrastructure

PostgreSQL provides two small reliability primitives:

- `provider_webhook_inbox`: unique provider event, verified payload reference, processing state, attempts, and last error.
- `outbox_message`: notification, timeout, reconciliation, and transfer work created in the same transaction as its business event.

A Spring worker claims rows with database locking, processes them idempotently, and records success or a capped failure. This is enough for pilot volume. A queue or Redis is considered only after measured database contention or latency proves the need.

## Security and Privacy Boundaries

- TLS everywhere; secure headers and a restrictive Content Security Policy on the web application.
- Short-lived OIDC access tokens stay in browser memory; no tokens or card/payment details in local storage.
- API authorization checks role plus resource ownership on every command.
- Operations requires MFA; high-impact refunds and compensation changes require a reason and fresh audit entry.
- Stripe, identity, route, and notification credentials live in the deployment secret manager and never use `NEXT_PUBLIC_*`/`VITE_*` variables.
- Customer addresses and contact details are returned only to the role that needs them and only during the active order window.
- Managed database encryption and backups are required. An attorney-approved retention/deletion schedule is a live-launch gate.
- Rate limiting, bot protection, dependency/security scanning, backup restore testing, and incident contacts are deployment requirements.

## Demo Experience

The demo includes pre-provisioned sandbox personas for customer, restaurant, driver, and operations roles. Credentials are kept in a private demo runbook or identity manager, never the repository. A guided scenario shows:

1. transparent customer pricing and test-card authorization;
2. restaurant acceptance and its lower commission/settlement breakdown;
3. driver offer, delivery proof, and fair-pay breakdown; and
4. the operations timeline and reconciled unit economics.

The demo uses fictional restaurants and addresses clearly marked as sample content. Reset is an operator action available only in the isolated demo deployment and scoped to tagged demo scenarios. The pilot binary/profile contains no callable demo-reset path.

## Failure Boundaries

- Repeated checkout submission returns the same checkout attempt or a clear conflict; it never creates duplicate charges.
- A provider timeout leaves a pending state and reconciliation job; it never guesses success or failure.
- Duplicate or out-of-order webhooks are safe and observable.
- Capture failure prevents restaurant acceptance from becoming final.
- Restaurant timeout cancels the authorization through durable work even if the browser is closed.
- No eligible driver triggers an operations exception, customer communication, and eventually an audited cancel/refund decision.
- A valid delivery PIN is sufficient for self-service completion. Missing, denied, or inaccurate browser geolocation is recorded but does not block the driver. Without a valid PIN, only operations may complete delivery after confirming with the customer and recording an audited reason.
- A transfer failure does not undo a completed delivery; it remains an outstanding payable visible to operations.
- A demo integration or reset failure cannot reach pilot credentials or data.

## Testing Strategy

- Pure unit tests own money rounding, fee allocation, state transitions, compensation floors, batching limits, permissions, and idempotency decisions.
- PostgreSQL/Testcontainers integration tests own migrations, locking, unique constraints, inbox/outbox retries, and repository behavior.
- Stripe sandbox contract tests own manual authorization/capture/cancel/refund, direct-charge application fees, webhook signatures, connected-account capability changes, and driver transfers.
- Frontend component tests own fee disclosure, role-specific actions, accessibility, and pending/error states.
- End-to-end suites cover one happy path and the highest-risk failures for each role. Demo E2E uses test providers; pilot smoke tests use non-monetary readiness endpoints and an approved low-value live transaction before launch.
- Every state-changing endpoint is tested for unauthorized role, wrong resource owner, duplicate request, stale version, and invalid transition.

No live key or real participant data is used in automated tests.

## Legal, Tax, and Operational Launch Gates

Code completion does not mean the pilot is legally ready. Live ordering remains disabled until named owners sign off on:

- restaurant-as-seller and merchant-of-record agreements;
- California delivery-network-company versus marketplace-facilitator tax treatment;
- taxable treatment of food, service, delivery, direct-delivery surcharge, and tips;
- Proposition 22 compensation, mileage/time recording, health-stipend obligations, occupational accident insurance, and contractor terms;
- driver identity, motor-vehicle, background-check, insurance, and safety procedures;
- customer terms, cancellation/refund policy, privacy notice, data retention, and incident response;
- restaurant menu/price/availability responsibilities;
- Stripe fee ownership, negative balances, refunds, disputes, reserves, and payout timing; and
- local licenses, insurance, and business registrations.

Relevant starting points are the [California CDTFA Marketplace Facilitator guide](https://cdtfa.ca.gov/industry/MPFAct.htm), [CDTFA restaurant tax guide](https://cdtfa.ca.gov/industry/restaurant-owners/industry-topics.htm), [California DIR independent-contractor guidance](https://www.dir.ca.gov/dlse/FAQ_IndependentContractor.htm), [Stripe Connect charge-type guide](https://docs.stripe.com/connect/charges), [Stripe Accounts v2 responsibility configuration](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration), and [Stripe PaymentIntent capture documentation](https://docs.stripe.com/api/payment_intents/capture).

## Success Criteria

### Demo readiness

- An operator can complete the four-role sandbox scenario repeatedly without database edits.
- Every displayed customer charge and restaurant/driver allocation reconciles to the order snapshot.
- The demo clearly distinguishes sample data and test money while showing the same workflows as the pilot.
- Mobile and desktop role screens meet keyboard, labeling, focus, contrast, and responsive-layout checks.

### First live-order readiness

- Invited customer, restaurant, driver, and operations identities are approved and least-privileged.
- A live customer card is authorized, captured only after restaurant acceptance, and reconciled from signed webhooks.
- Restaurant staff, operations, and the driver complete the order without direct database or Stripe-dashboard edits.
- Delivery proof closes the order; restaurant and driver balances match the immutable order economics.
- Refund, no-driver, webhook replay, and transfer-failure drills have documented runbooks and verified recovery paths.
- Monitoring, backups, restore test, incident contacts, and legal/tax launch gates are complete.

## Architectural Calls Made for Maintainability

These are design defaults for approval, not prior user decisions:

- Use the selected shared-code/two-deployment approach.
- Use managed OIDC and hosted Stripe onboarding instead of handling passwords, KYC, or bank details.
- Keep one Spring modular monolith and one Next.js app.
- Use PostgreSQL inbox/outbox workers instead of new queue infrastructure.
- Use polling instead of WebSockets for pilot status updates.
- Use human-assisted dispatch instead of an optimizer.
- Record an immutable order economics snapshot and audit timeline, not a general ledger or event-sourced system.
- Fulfill an unmatched grouped order alone after a 15-minute matching window without repricing the customer.
- Start compensated engaged time at driver acceptance and dispatch near the predicted pickup window.
- Use Stripe Accounts v2 full-Dashboard Merchant accounts for restaurants and Recipient/Express accounts for drivers.
- Treat the customer PIN as delivery proof; browser geolocation is best-effort and an audited operations override is the fallback.
- Defer subscription, native apps, post-delivery tips, POS integration, photos, and automatic exception decisions.
- Make identity, route, notification, and deployment provider selections explicit pre-plan gates when pricing/security terms matter; do not add generic provider frameworks.

## Implementation Plan Partition

After this design is approved, implementation will be written as ten small, separately reviewable plan documents. Each plan will contain TDD-sized tasks with exact files, interfaces, commands, and commits:

1. platform safety baseline and isolated environment contracts;
2. managed identity, invitations, memberships, and role authorization;
3. restaurant onboarding, catalog operations, hours, and availability;
4. address validation, service zones, route eligibility, and live quote/tax inputs;
5. persistent checkout attempts, immutable quotes, and order state transitions;
6. Stripe Connect onboarding, authorization/capture, webhooks, refunds, and reconciliation records;
7. restaurant order acceptance and preparation workflow;
8. driver onboarding, availability, compensation rules, and connected accounts;
9. dispatch offers, two-order batching, delivery proof, operations actions, and notifications; and
10. investor demo polish, full journey verification, deployment, runbooks, and live-pilot gates.

No plan introduces a subsystem before the preceding plan exposes the exact interface it consumes. Each plan must leave working, testable software and may be reviewed or postponed without forcing unrelated changes.

## Deferred Decisions Required Before Their Plan

- Managed OIDC provider and pilot pricing/security terms — before Plan 2.
- Address/routes provider and quotas — before Plan 4.
- California tax treatment and Stripe Tax responsibility — before Plans 4 and 6.
- Notification provider and consent/opt-out wording — before Plan 9.
- Deployment host/region, managed PostgreSQL, secrets, backups, and edge protection — before Plan 10.

These decisions do not block approval of the product architecture. Their plan begins with a short evidence-backed selection gate and does not implement competing providers.
