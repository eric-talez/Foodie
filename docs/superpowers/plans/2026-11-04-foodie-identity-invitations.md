# Foodie Identity and Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-only Auth0 authentication and server-owned role/resource authorization for customers, restaurant staff, drivers, and operations.

**Architecture:** Auth0 Universal Login issues short-lived RS256 access tokens; Spring Security validates them as a resource server. Foodie stores verified identities, invitations, and memberships in PostgreSQL, and every protected command resolves authority from the database rather than browser claims.

**Tech Stack:** Auth0 Universal Login, `@auth0/auth0-react@2.30.0`, Spring Boot OAuth2 Resource Server 4.1.2, PostgreSQL, Flyway, Vitest, JUnit/Testcontainers

**Spec:** `docs/superpowers/specs/2026-11-04-foodie-demo-and-south-bay-pilot-design.md`

## Global Constraints

- Authentication is invite-only; an Auth0 identity has no Foodie authority until an active invitation is claimed.
- Roles are `CUSTOMER`, `RESTAURANT_STAFF`, `DRIVER`, and `OPS_ADMIN`.
- The API reads role and resource scope from PostgreSQL on every protected operation.
- Ops access requires a boolean custom claim `https://foodie.app/mfa=true` in addition to an active `OPS_ADMIN` membership.
- Access tokens remain in browser memory and must never be written to local/session storage, logs, or URLs.
- Foodie does not store passwords or call the Auth0 Management API.
- Existing catalog, location, restaurant discovery, quote, runtime, and health endpoints remain anonymously readable for the demo.

## Review Focus

- A valid Auth0 token without a claimed invitation must receive `403`, not implicit enrollment.
- Claiming an expired, revoked, already-claimed, wrong-email, or wrong-tenant invitation must be safe and idempotent.
- Restaurant staff must not gain access to another restaurant by changing a path/body ID.
- Ops membership without the MFA claim must be denied.
- Missing Auth0 browser configuration must leave anonymous demo browsing intact and protected actions disabled.

---

## File Structure

```text
services/api/src/main/java/com/foodie/api/identity/
  UserAccount.java, Invitation.java, Membership.java
  Role.java, InvitationStatus.java
  CurrentActor.java, ActorContext.java
  InvitationService.java, IdentityController.java, OpsInvitationController.java
services/api/src/main/java/com/foodie/api/security/SecurityConfiguration.java
services/api/src/main/resources/db/common/V3__create_identity.sql
apps/web/src/features/auth/AuthProvider.tsx
apps/web/src/features/auth/useAuthenticatedFetch.ts
apps/web/src/components/AccountMenu.tsx
apps/web/src/app/account/page.tsx
```

### Task 1: Persist Invitations and Memberships

**Files:**
- Create: `services/api/src/main/resources/db/common/V3__create_identity.sql`
- Create: `services/api/src/main/java/com/foodie/api/identity/{UserAccount,Invitation,Membership,Role,InvitationStatus}.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/{UserAccountRepository,InvitationRepository,MembershipRepository}.java`
- Create: `services/api/src/test/java/com/foodie/api/identity/IdentityPersistenceIntegrationTest.java`

**Interfaces:**
- Consumes: existing `restaurant(id)` for optional restaurant scope.
- Produces: unique OIDC subject, normalized unique active invitation email+role+scope, immutable claimed user, active membership, invitation expiry/revocation, and optimistic-lock versions.

- [ ] **Step 1: Write the failing PostgreSQL constraint test**

Assert one identity subject per user, one claim per invitation, one active role/scope membership, nullable restaurant scope only for non-restaurant roles, and rejection of an expired claim.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test -Dtest=IdentityPersistenceIntegrationTest`

Expected: FAIL because V3 and repositories do not exist.

- [ ] **Step 3: Add V3 and focused JPA mappings**

Use UUID keys, lowercase normalized email, `timestamptz`, explicit checks, foreign keys, and `@Version`. Do not add driver profile fields yet.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/resources/db/common/V3__create_identity.sql services/api/src/main/java/com/foodie/api/identity services/api/src/test/java/com/foodie/api/identity
git commit -m "feat(identity): persist invitations and memberships"
```

### Task 2: Validate Tokens and Resolve the Current Actor

**Files:**
- Modify: `services/api/pom.xml`
- Create: `services/api/src/main/java/com/foodie/api/security/SecurityConfiguration.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/ActorContext.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/CurrentActor.java`
- Modify: `services/api/src/main/resources/application-demo.yml`
- Modify: `services/api/src/main/resources/application-pilot.yml`
- Create: `services/api/src/test/java/com/foodie/api/security/SecurityConfigurationTest.java`
- Create: `services/api/src/test/java/com/foodie/api/identity/CurrentActorTest.java`

**Interfaces:**
- Consumes: validated `JwtAuthenticationToken` with `sub`, verified `email`, optional Foodie MFA claim.
- Produces: `ActorContext(UUID userId, String subject, Set<Role> roles, UUID restaurantId, UUID driverId, boolean mfa)`; `CurrentActor.require(Role)` and `requireRestaurant(UUID)`.

- [ ] **Step 1: Write failing anonymous/authenticated authorization tests**

Pin anonymous allowlist to `GET /actuator/health`, `GET /api/v1/runtime`, catalog/location/search endpoints, restaurant menu GET, and quote POST. Everything else requires a valid issuer/audience token.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=SecurityConfigurationTest,CurrentActorTest'`

- [ ] **Step 3: Add the Boot-managed resource-server starter and implementation**

Configure `FOODIE_AUTH_ISSUER` and `FOODIE_AUTH_AUDIENCE`; reject tokens missing verified email. `CurrentActor` must query active memberships, enforce MFA for OPS, and never trust a role claim.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/pom.xml services/api/src/main/java/com/foodie/api/security services/api/src/main/java/com/foodie/api/identity services/api/src/main/resources services/api/src/test
git commit -m "feat(security): enforce database-backed roles"
```

### Task 3: Create and Claim Invitations

**Files:**
- Create: `services/api/src/main/java/com/foodie/api/identity/InvitationService.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/IdentityController.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/OpsInvitationController.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/IdentityDtos.java`
- Create: `services/api/src/main/java/com/foodie/api/identity/BootstrapOpsInvitation.java`
- Create: `services/api/src/test/java/com/foodie/api/identity/InvitationServiceTest.java`
- Create: `services/api/src/test/java/com/foodie/api/identity/IdentityApiIntegrationTest.java`

**Interfaces:**
- Consumes: current verified subject/email and OPS actor.
- Produces: `POST /api/v1/me/invitations/{id}/claim`, `GET /api/v1/me`, `POST /api/v1/ops/invitations`, `DELETE /api/v1/ops/invitations/{id}`; invitations expire after 7 days.

- [ ] **Step 1: Write failing claim/idempotency/authorization tests**

Assert first valid claim creates/reuses `UserAccount` and one membership; repeating returns the same membership; mismatched email, expiry, revocation, claimed-by-other, missing MFA, and wrong restaurant scope are rejected without partial writes.

- [ ] **Step 2: Run RED**

Run: `cd services/api; .\mvnw.cmd test '-Dtest=InvitationServiceTest,IdentityApiIntegrationTest'`

- [ ] **Step 3: Implement transactional claim and operations commands**

Normalize email with `Locale.ROOT`. The one-time bootstrap accepts `FOODIE_BOOTSTRAP_OPS_EMAIL` only when no membership exists and `foodie.bootstrap.ops-enabled=true`; it creates an invitation, never a membership, and pilot documentation requires disabling it after claim.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

```bash
git add services/api/src/main/java/com/foodie/api/identity services/api/src/test/java/com/foodie/api/identity
git commit -m "feat(identity): add invite-only membership claims"
```

### Task 4: Add Auth0 to the Web Application

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/features/auth/AuthProvider.tsx`
- Create: `apps/web/src/features/auth/useAuthenticatedFetch.ts`
- Create: `apps/web/src/features/auth/AuthProvider.test.tsx`
- Create: `apps/web/src/features/auth/useAuthenticatedFetch.test.tsx`
- Create: `apps/web/src/components/AccountMenu.tsx`
- Modify: `apps/web/src/components/SiteHeader.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/account/page.tsx`
- Create: `apps/web/src/app/account/page.test.tsx`

**Interfaces:**
- Consumes: Auth0 domain/client ID/audience from `NEXT_PUBLIC_FOODIE_AUTH_*` and protected Foodie APIs.
- Produces: `AuthProvider`, `useAuthenticatedFetch(): (input, init?) => Promise<Response>`, login/logout controls, invitation claim UI, and account role summary.

- [ ] **Step 1: Add exact dependency**

Run: `pnpm.cmd --filter @foodie/web add @auth0/auth0-react@2.30.0 --save-exact`

- [ ] **Step 2: Write failing provider/fetch/account tests**

Assert token is requested per call, undefined token fails closed, Authorization cannot be overridden by a caller, no token is stored, anonymous demo remains usable, and error/focus states are accessible.

- [ ] **Step 3: Run RED**

Run: `pnpm.cmd --filter @foodie/web test -- --run src/features/auth src/app/account/page.test.tsx`

- [ ] **Step 4: Implement the minimum provider and account route**

Keep existing anonymous `api.ts` calls unchanged. Use authenticated fetch only for new protected APIs.

- [ ] **Step 5: Run GREEN, full web verification,**

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add invite-only sign in"
```

### Task 5: Verify the Identity Slice End to End

**Files:**
- Create: `services/api/src/test/java/com/foodie/api/identity/IdentitySecurityIntegrationTest.java`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: executable configuration/runbook and cross-role authorization evidence.

- [ ] **Step 1: Add integration cases for all four roles and ownership failures**

Use signed test JWTs from test code only. Assert no-role, customer, restaurant A/B, driver, ops-without-MFA, and ops-with-MFA behavior.

- [ ] **Step 2: Run complete raw validation**

Run: `cd services/api; .\mvnw.cmd test`

Run: `pnpm.cmd --filter @foodie/web test -- --run`

Run: `pnpm.cmd --filter @foodie/web build`

Run: `git diff --check`

Expected: all exit `0`.

- [ ] **Step 3: Document Auth0 application/API settings**

Document allowed callbacks/logout URLs, RS256, audience, custom MFA claim, public-vs-secret variables, bootstrap removal, and test-tenant/live-tenant separation. Do not include tenant IDs, emails, or secrets.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/test README.md
git commit -m "test(identity): verify role and ownership boundaries"
```
