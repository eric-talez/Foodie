# Foodie Restaurant Onboarding and Catalog Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operations create pilot restaurants and let scoped restaurant staff manage hours, preparation settings, menu content, modifiers, and availability without database edits.

**Architecture:** Extend the existing catalog entities rather than creating a parallel vendor model. Mutations live in a focused `restaurantops` package, call existing catalog repositories/entities, and enforce restaurant ownership through `CurrentActor`.

**Tech Stack:** Java 21, Spring Boot 4.1.2, Spring Data JPA, PostgreSQL/Flyway, Next.js 16.4.5, React 19.3.0, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Operations creates pilot restaurant records; public self-service restaurant signup is out of scope.
- Restaurant staff is scoped to exactly one restaurant and may never change commission, tax policy, payment status, or another restaurant.
- Restaurant status is `DRAFT`, `IN_REVIEW`, `ACTIVE`, or `SUSPENDED`; this plan permits only `DRAFT` and `IN_REVIEW` because payment/tax gates arrive later.
- Menu prices use nonnegative integer USD cents; IDs are server-generated UUIDs.
- Existing demo catalog GET endpoints and deterministic seed data must remain compatible.
- No POS import, multi-location group, image upload, or bulk spreadsheet flow.

## Review Focus

- Every mutation must reject a valid restaurant-staff user scoped to a different restaurant.
- Removing/deactivating a category, item, group, or option must not break historical quote/order snapshots.
- Modifier minimum/maximum values must remain valid after replacement.
- Duplicate slugs and category/item display orders must produce deterministic errors/order.
- An inactive or closed restaurant must not become orderable merely because its menu is active.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/restaurantops/
  RestaurantOperationsService.java
  RestaurantOperationsController.java
  OpsRestaurantController.java
  MenuManagementService.java
  MenuManagementController.java
  RestaurantOperationsDtos.java
apps/web/src/app/restaurant/settings/page.tsx
apps/web/src/app/restaurant/menu/page.tsx
apps/web/src/components/restaurant/RestaurantSettingsForm.tsx
apps/web/src/components/restaurant/MenuEditor.tsx
```

### Task 1: Add Restaurant Operational State and Hours

**Files:**
- Create: `services/api/src/main/resources/db/common/V4__add_restaurant_operations.sql`
- Modify: `services/api/src/main/java/com/foodie/api/catalog/Restaurant.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantStatus.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantHours.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantHoursRepository.java`
- Create: `services/api/src/test/java/com/foodie/api/restaurantops/RestaurantOperationsPersistenceTest.java`

**Interfaces:**
- Consumes: existing `restaurant` rows.
- Produces: restaurant `status`, IANA `time_zone`, `prep_minutes` (5–120), pickup address fields, optimistic version, and at most one open/close interval per weekday for the pilot.

- [ ] **Step 1: Write the failing migration/entity test**

Assert existing demo rows migrate as `DRAFT`, `America/Los_Angeles`, 20 minutes, and preserve coordinates; invalid time/prep/hour ranges fail.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=RestaurantOperationsPersistenceTest`

- [ ] **Step 3: Add V4 and focused entity methods**

Use methods such as `restaurant.updateOperations(...)` and `restaurant.submitForReview()`; do not add public setters.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V4__add_restaurant_operations.sql services/api/src/main/java services/api/src/test
git commit -m "feat(restaurant): add operating profile and hours"
```

### Task 2: Create Restaurants Through an Operations API

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/OpsRestaurantController.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantOperationsService.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantOperationsDtos.java`
- Modify: `services/api/src/main/java/com/foodie/api/catalog/RestaurantRepository.java`
- Create: `services/api/src/test/java/com/foodie/api/restaurantops/OpsRestaurantApiIntegrationTest.java`

**Interfaces:**
- Consumes: MFA-authenticated OPS actor and `CreateRestaurantRequest(name, slug, description, city, cuisine, pickupAddress, latitude, longitude, timeZone, prepMinutes)`.
- Produces: `POST /api/v1/ops/restaurants`, `GET /api/v1/ops/restaurants`, and a `DRAFT` restaurant; optional initial `RESTAURANT_STAFF` invitation uses Plan 2's `InvitationService`.

- [ ] **Step 1: Write failing authorization/validation/idempotency tests**

Assert customer/restaurant/ops-without-MFA are forbidden; invalid slug/address/coordinates/timezone/prep are rejected; duplicate slug returns `409`; a supplied idempotency key does not duplicate a restaurant or invitation.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=OpsRestaurantApiIntegrationTest`

- [ ] **Step 3: Implement the minimum transactional command**

Normalize slug once with lowercase ASCII letters, digits, and hyphens; do not silently rewrite an invalid requested slug.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/restaurantops services/api/src/main/java/com/foodie/api/catalog/RestaurantRepository.java services/api/src/test/java/com/foodie/api/restaurantops
git commit -m "feat(ops): add restaurant onboarding command"
```

### Task 3: Add Scoped Settings and Menu Commands

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/RestaurantOperationsController.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/MenuManagementService.java`
- Create: `services/api/src/main/java/com/foodie/api/restaurantops/MenuManagementController.java`
- Modify: `services/api/src/main/java/com/foodie/api/catalog/{MenuCategory,MenuItem,ModifierGroup,ModifierOption}.java`
- Modify: relevant catalog repositories
- Create: `services/api/src/test/java/com/foodie/api/restaurantops/MenuManagementServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/restaurantops/RestaurantOperationsApiIntegrationTest.java`

**Interfaces:**
- Consumes: scoped restaurant actor and optimistic `version`.
- Produces: `GET/PATCH /api/v1/restaurant/me/settings`; `POST /categories`; `POST /categories/{id}/items`; `PATCH /items/{id}`; `PATCH /items/{id}/availability`; `PUT /items/{id}/modifier-groups`; `POST /submit-review`.

- [ ] **Step 1: Write failing command and cross-restaurant tests**

Pin exact bounds: names 1–160, descriptions 0–500, price 0–100000 cents, quantity-independent modifiers 0–20 options, min/max within option count, prep 5–120. Stale versions return `409` and never partially update.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=MenuManagementServiceTest,RestaurantOperationsApiIntegrationTest'`

- [ ] **Step 3: Implement commands by extending current entities**

Modifier replacement is one transaction for one item. Deactivate omitted old groups/options rather than deleting rows; preserve historical references.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/catalog services/api/src/main/java/com/foodie/api/restaurantops services/api/src/test/java/com/foodie/api/restaurantops
git commit -m "feat(restaurant): manage menu and availability"
```

### Task 4: Build Restaurant Settings and Menu Screens

**Files:**
- Extend: `apps/web/src/lib/types.ts`
- Extend: `apps/web/src/lib/api.ts` or create `apps/web/src/features/restaurant/restaurantApi.ts`
- Create: `apps/web/src/app/restaurant/settings/page.tsx`
- Create: `apps/web/src/app/restaurant/menu/page.tsx`
- Create: `apps/web/src/components/restaurant/RestaurantSettingsForm.tsx`
- Create: `apps/web/src/components/restaurant/MenuEditor.tsx`
- Create: colocated component/API tests
- Modify: `apps/web/src/components/AccountMenu.tsx`

**Interfaces:**
- Consumes: Plan 2 authenticated fetch and Task 3 endpoints.
- Produces: keyboard-accessible restaurant settings/menu workflow with explicit save, stale-version recovery, and availability toggles.

- [ ] **Step 1: Write failing role/loading/validation/conflict tests**

Assert no optimistic UI success before server confirmation, errors retain form input, required modifier validation is announced, and non-restaurant users get a role-safe page.

- [ ] **Step 2: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/components/restaurant src/app/restaurant`

- [ ] **Step 3: Implement the smallest two-route editor**

No drag-and-drop or image upload. Use numeric display-order controls and existing form/button styles.

- [ ] **Step 4: Run full slice verification**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `cd services/api; .\mvnw.cmd test`

Run: `git diff --check`

- [ ] **Step 5: Commit**

```bash
git add apps/web README.md
git commit -m "feat(web): add restaurant catalog workspace"
```
