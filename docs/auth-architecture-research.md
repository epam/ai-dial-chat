# Auth Architecture Research: Chat 2.0 (React/Vite + NestJS)

**Version:** 1.0 | **Date:** 2026-05-08 | **Status:** Research / Decision-Pending

---

## 1. Executive Summary

Chat 2.0 is a greenfield React/Vite SPA (`apps/chat`) with a NestJS API backend (`apps/chat-api`). The previous Chat 1.0 relied on a framework-specific auth layer that was deeply tied to the Next.js SSR model. The new architecture separates frontend and backend entirely, which makes the auth choice non-trivial: every pattern that worked in a monolithic Next.js app needs explicit re-evaluation.

This document does **not** start with a predetermined answer. It examines six realistic auth architectures, evaluates them against a common set of criteria, and arrives at a recommendation only after the comparison.

**The central tension in 2026:** The IETF's [draft-ietf-oauth-browser-based-apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps) (currently BCP 212) has made clear that tokens stored in browser JavaScript are fundamentally unprotectable from XSS. Simultaneously, browser vendors have eliminated third-party cookies, breaking the iframe-based silent renew that most SPA auth libraries historically relied upon. Any architecture that does not account for both of these realities will cause operational pain.

---

## 2. Current State (Codebase Audit)

| Area | Status |
|---|---|
| Auth libraries installed | None |
| Auth guards / middleware | None |
| JWT / OIDC configuration | None |
| Auth-related env variables | None |
| Security headers (Helmet) | Implemented |
| Rate limiting (Throttler) | Implemented (100 req/min) |
| Input validation (class-validator) | Implemented |
| CORS | Configured (single origin) |
| Session store | Not present |

This is a clean slate. No migration cost from Chat 2.0 itself — migration cost is from team familiarity with previous auth patterns.

---

## 3. Security Foundation (MUST READ BEFORE OPTIONS)

These are non-negotiable constraints that apply regardless of which option is chosen.

### 3.1 Authorization Code + PKCE (MUST)

All modern auth flows for public clients MUST use Authorization Code with PKCE ([RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)). The flow:

1. Client generates a random `code_verifier` (43–128 chars), stores it in sessionStorage.
2. Client computes `code_challenge = BASE64URL(SHA256(code_verifier))`.
3. Client redirects user to IdP with `response_type=code&code_challenge=...&code_challenge_method=S256`.
4. IdP returns `code` to the redirect URI.
5. Client exchanges `code + code_verifier` for tokens at the token endpoint.

PKCE ensures that even if the auth code is intercepted in the redirect, it cannot be exchanged without the `code_verifier`.

### 3.2 Why Implicit Flow is Forbidden (MUST NOT)

Implicit flow (`response_type=token`) returns the access token in the URL fragment, which:
- Appears in browser history, proxy logs, and Referrer headers.
- Cannot issue refresh tokens (security risk).
- Is deprecated in OAuth 2.1 ([draft-ietf-oauth-v2-1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)).
- Is removed by Auth0 by default, deprecated in Okta, and blocked in Entra ID modern auth.

**No implicit flow, ever.**

### 3.3 Public Client vs. Confidential Client (MUST understand)

- **Public client** (SPA, mobile app): cannot keep a secret. No `client_secret` ever. Uses PKCE to prove legitimacy.
- **Confidential client** (NestJS server): can keep a secret. Uses `client_secret` or private key JWT for authentication. This is the BFF advantage.

Placing a `client_secret` in browser JavaScript or in a shipped Vite bundle is a MUST NOT. It will be extracted.

### 3.4 Browser Token Storage Risks

| Location | XSS Risk | CSRF Risk | Persistence | Cross-tab |
|---|---|---|---|---|
| `localStorage` | HIGH — any JS can read | Low | Survives close | Yes |
| `sessionStorage` | HIGH — same-tab JS reads | Low | Lost on close | No |
| In-memory (JS var) | HIGH — JS leaks on XSS | Low | Lost on refresh | No |
| `HttpOnly` Cookie | LOW — JS cannot read | MEDIUM — automatic send | Configurable | Yes |
| `HttpOnly` + `SameSite=Strict` | LOW | LOW | Configurable | Yes |

There is no "secure" way to store tokens in JavaScript that is immune to XSS. The only XSS-safe option is `HttpOnly` cookies managed by the server.

### 3.5 Refresh Token Rotation (MUST for any option)

Refresh tokens MUST be short-lived and rotated on each use ([RFC 6749 §10.4](https://www.rfc-editor.org/rfc/rfc6749#section-10.4)). When a refresh token is used, the IdP issues a new one and invalidates the old one. This detects theft: if an attacker uses a stolen refresh token, the legitimate user's next renewal fails, and the session can be terminated.

### 3.6 `offline_access` Scope

The `offline_access` scope ([OIDC Core §11](https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess)) requests a refresh token from the IdP. Without it, many providers do not issue refresh tokens to public clients, forcing the (now broken) iframe silent renew. **Always request `offline_access`** for SPAs that need background token refresh.

### 3.7 Silent Renew: Iframe vs. Refresh Token (2026 Reality)

The iframe-based silent renew (`prompt=none` in a hidden iframe) worked by re-using the IdP's session cookie set in the main window. **This is broken in Safari (ITP 2017+), Firefox ETP, Brave, and increasingly Chrome**. All third-party cookies in iframes are blocked. This affects `oidc-client-ts`, `keycloak-js`, `@auth0/auth0-react`, and `@azure/msal-react` equally.

**The only reliable silent renew in 2026 is the refresh token grant.** Configure IdPs to issue refresh tokens; disable iframe silent renew in all libraries.

### 3.8 XSS and CSP

A Content Security Policy (`script-src 'self'`) is the primary defense against XSS, which in turn protects in-browser token storage. The existing `helmet()` configuration in `main.ts` sets a `script-src` directive — this must be maintained and hardened.

---

## 4. Option Analysis

### Option A: Pure SPA OIDC Client (react-oidc-context / oidc-client-ts)

#### How the flow works

```
React SPA
  │
  ├─ signinRedirect() → IdP (Auth Code + PKCE)
  │
  ├─ IdP → redirect back with `code`
  │
  ├─ signinRedirectCallback() → exchange code for tokens
  │
  ├─ Tokens stored in browser (sessionStorage / memory)
  │
  └─ API requests: Authorization: Bearer <access_token>
                         │
                      NestJS → validates JWT via JWKS
```

#### Libraries

- `oidc-client-ts` v3.5.0 — ~2.1M weekly downloads, actively maintained
- `react-oidc-context` v3.3.1 — thin React Context wrapper, ~485K weekly downloads
- NestJS side: `@nestjs/passport` + `passport-jwt` + `jwks-rsa`, or `jose` v6

#### Provider Support

Any OIDC-compliant provider via `.well-known/openid-configuration`. Configuration is a single `authority` URL change.

| Provider | Support | Notes |
|---|---|---|
| Keycloak | Full | `authority = https://<host>/realms/<realm>` |
| Auth0 | Full | `authority = https://<tenant>.auth0.com` |
| Okta | Full | `authority = https://<org>.okta.com/oauth2/default` |
| Entra ID | Full | `authority = https://login.microsoftonline.com/{tenant}/v2.0` |
| AWS Cognito | Partial | No `prompt=none`, no token revocation endpoint, custom `metadata` needed |
| Custom OIDC | Full | Any compliant IdP with discovery document |

#### Multi-Provider Support

Requires either: (a) one `<AuthProvider>` per provider with a provider-switcher, or (b) a meta-configuration layer that re-initializes `oidc-client-ts` based on user selection. Non-trivial to do cleanly at the React level. Better done at the BFF layer.

#### Token Storage

- Access token: `sessionStorage` (default) or in-memory
- Refresh token: same as access token
- PKCE state/nonce: `localStorage` (during redirect only)

#### Refresh / Silent Renew

- `automaticSilentRenew: true` triggers token refresh before expiry
- Uses refresh token grant if IdP issues one (`offline_access` + refresh token rotation enabled)
- Falls back to iframe `prompt=none` — **broken in modern browsers**
- **Configure `silent_redirect_uri` with refresh token mode; disable iframe mode**

#### Logout / Federated Logout

`signoutRedirect()` calls `end_session_endpoint` from the IdP's discovery document. Terminates the IdP session (federated logout). MUST be used; `signoutSilent()` (iframe) has the same third-party cookie problem.

#### Role / Claim Mapping

Claims come from `id_token` (user info) and access token. Keycloak and Okta embed roles in the JWT. Auth0 uses custom claims namespace (`https://myapp/roles`). Claims are extracted and mapped in the React app via `useAuth().user`. Backend role checks done in NestJS guards via JWT payload.

#### Backend Validation (NestJS)

NestJS validates JWTs via JWKS. `passport-jwt` + `jwks-rsa`, or `jose`'s `createRemoteJWKSet` + `jwtVerify`. Claims validated: `iss`, `aud`, `exp`. For multi-provider, a dynamic issuer resolver is needed (see Option F).

#### Security Risks

- **HIGH**: Tokens in browser — XSS compromise allows token theft
- **MEDIUM**: Even with CSP, third-party scripts (analytics, CDN) are attack surface
- **HIGH (ops)**: Iframe silent renew silently breaks — users get logged out without warning
- **LOW**: PKCE prevents auth code interception

#### Pros

- Simplest implementation — no backend session logic
- No extra infrastructure (no Redis)
- Native React/Vite integration
- Provider-agnostic

#### Cons

- Tokens exposed to browser JavaScript
- Silent renew requires careful configuration per IdP
- Multi-provider management is awkward in the SPA

#### Migration from Existing Auth

**Easy**: Replace existing auth hooks with `useAuth()` from `react-oidc-context`. Provider configs map directly.

---

### Option B: Backend-for-Frontend (BFF) with NestJS

#### How the flow works

```
React SPA
  │  (HttpOnly session cookie only)
  ▼
NestJS BFF
  ├─ /auth/login → generates PKCE state, redirects to IdP
  ├─ /auth/callback → exchanges code for tokens via openid-client
  ├─ tokens stored server-side (Redis / encrypted session)
  ├─ sets HttpOnly Secure SameSite=Lax cookie
  ├─ /api/* routes → reads cookie, attaches Bearer to upstream calls
  └─ /auth/logout → revokes tokens, clears cookie, calls end_session_endpoint
```

#### Libraries

- `openid-client` v6.8.4 (panva) — 7.1M weekly downloads, FAPI 1.0/2.0 certified
- `express-session` + `connect-redis` (or custom NestJS session interceptor)
- `@nestjs/passport` (optional)
- React side: no auth library needed — just `fetch()` with `credentials: 'include'`

**Note on `openid-client` v6:** ESM-only, requires Node 20+. In a NestJS CJS project, use dynamic `import()` in the module init, or switch the project to `"type": "module"`.

#### Provider Support

Protocol-level OIDC support for any compliant IdP via discovery. `openid-client` holds [OpenID Foundation certification](https://openid.net/certification/) for Basic RP, FAPI 1.0, and FAPI 2.0.

#### Multi-Provider Support

The BFF is the natural place to manage multiple providers:
- A provider registry maps provider IDs to OIDC configurations
- `/auth/login?provider=keycloak` vs `/auth/login?provider=azure` initiates the right flow
- The session stores which provider issued the tokens
- Token refresh uses the correct provider's token endpoint

#### Token Storage

- Access token: **server-side** (Redis session or encrypted cookie)
- Refresh token: **server-side** (never leaves the server)
- Session reference: `HttpOnly; Secure; SameSite=Lax` cookie
- React receives: nothing — only the session cookie

#### Refresh / Silent Renew

Entirely server-side. NestJS checks token expiry on each request; if the access token is about to expire, it calls the IdP's token endpoint with the refresh token. **No browser involvement, no iframe, no third-party cookie dependency.**

#### Logout / Federated Logout

NestJS calls the IdP's `end_session_endpoint` using `openid-client`'s `client.endSessionUrl()`. Clears the server-side session and the cookie.

#### Role / Claim Mapping

Claims extracted from the access token or ID token on the server. NestJS guards can inspect claims, perform role mapping, and attach a normalized principal object to the request. The SPA receives a `/auth/me` response with the user's profile — no raw JWT exposure needed.

#### Security Risks

- **LOW**: No tokens in browser — XSS cannot steal tokens
- **MEDIUM**: CSRF — mitigated by `SameSite=Lax` + CSRF token for state-mutating requests
- **LOW-MEDIUM**: Session fixation — mitigate by regenerating session ID post-login
- **LOW**: Cookie theft (requires HTTPS + Secure flag — both MUST be enforced)

#### Pros

- Strongest security posture — tokens never reach the browser
- IETF BCP 212 recommended for sensitive applications
- Server-side refresh is 100% reliable (no iframe/cookie dependency)
- Centralized multi-provider management

#### Cons

- Requires session store (Redis)
- Cookie-based auth has friction with non-browser clients
- `openid-client` v6 ESM migration needed for NestJS CJS projects
- More implementation work

#### Migration from Existing Auth

**Medium complexity**: Replicating the previous BFF-style pattern manually in NestJS. Provider configurations and callback logic map directly.

---

### Option C: Express Auth Adapter

#### How the flow works

`@auth/express` exposes an `ExpressAuth()` handler mountable on a route prefix (e.g., `/auth/*`). Sessions stored in encrypted JWT cookies by default or in a database adapter.

#### Libraries

- `@auth/express` v0.12.1 — **explicitly experimental**, ESM-only, Node 20+
- NestJS integration: community packages only (`@mridang/nestjs-auth`)

#### Provider Support

100+ built-in providers. Generic `OAuthConfig` for custom providers. However, Express adapter documentation for enterprise providers (Keycloak) is marked "not yet documented."

#### Security Risks

- **LOW** (tokens server-side)
- **MEDIUM**: API instability — v0.12.1 with known import/dependency bugs
- **HIGH (project risk)**: The adapter ecosystem is moving toward Better Auth; future maintenance direction is unclear

#### Pros

- Familiar for teams with BFF auth experience
- 100+ provider catalog

#### Cons

- **Experimental status** — API will change
- **Project direction unclear** — merging into Better Auth
- ESM-only conflicts with NestJS CJS setups
- No first-class NestJS support

#### Migration from Existing Auth

**Easiest conceptually** — similar provider configs. But Next.js-specific session handling does not translate.

**Verdict**: Not recommended for greenfield production.

---

### Option D: Better Auth

#### How the flow works

```
React SPA (better-auth/client)
  │  HttpOnly session cookie
  ▼
NestJS (toNodeHandler + nestjs-better-auth module)
  └─ SSO plugin → Keycloak / Okta / Entra ID / Auth0 / SAML 2.0
```

#### Libraries

- `better-auth` v1.6.9 — 28.2k stars, ~2M weekly downloads
- `@better-auth/sso` plugin — enterprise SSO with OIDC + SAML 2.0
- NestJS: `nestjs-better-auth` (community)
- React client: `better-auth/react`

#### Provider Support

- OIDC: Keycloak, Auth0, Okta, Entra ID, Google, GitLab, custom OIDC
- SAML 2.0: Okta SAML, Entra ID SAML, Keycloak SAML — via `@better-auth/sso`
- Auto-fetches and validates OIDC Discovery Documents
- SAML assertion replay protection, InResponseTo validation

#### Multi-Provider Support

Organization-linked providers — each organization can have its own SSO provider. Correct model for multi-tenant enterprise SaaS.

#### Token Storage

Server-side session (database) + `HttpOnly` cookie reference. Access and refresh tokens never in the browser.

#### Security Risks

- **LOW**: No tokens in browser
- **MEDIUM**: Community NestJS integration — not first-party
- **MEDIUM**: v1.x API churn — 355 open GitHub issues

#### Pros

- SAML 2.0 support (unique among options)
- Multi-tenant SSO with org-linked providers
- TypeScript-native, framework-agnostic
- Strong growth (28k stars, 922 releases)

#### Cons

- NestJS integration is community-maintained
- v1.x — API can change
- `toNodeHandler` inside Express subrouter has known 404 issues

#### Migration from Existing Auth

**Medium**: Provider configs map well. Session model is different (database-backed vs JWT cookies).

---

### Option E: Provider-Specific SDKs

#### Summary of all five SDKs

| SDK | Provider Lock-in | Auth Flow | Token Storage | Silent Renew (2026) | Multi-provider |
|---|---|---|---|---|---|
| `@auth0/auth0-react` | Auth0 only | Code + PKCE | Memory / localStorage | Refresh token (if rotation enabled) | No |
| `@okta/okta-react` | Okta only | Code + PKCE | sessionStorage | Iframe (broken) / refresh token | No |
| `keycloak-js` | Keycloak only | Code + PKCE (default) | **Memory only** | Iframe (broken) | No |
| `@azure/msal-react` | Entra ID (+ B2C) | Code + PKCE | session/localStorage | `acquireTokenSilent` | Only via B2C |
| AWS Amplify | Cognito + AWS | Cognito flows | Amplify-managed | Amplify-managed | Only via Cognito |

#### Key Observation

Every provider SDK implements Authorization Code + PKCE over OIDC. They are all wrappers over the same underlying protocol. **If you need to support Keycloak AND Entra ID**, you cannot use a provider SDK for both.

#### Pros

- Simple if locked to one provider
- Vendor support SLA on the client library

#### Cons

- Complete vendor lock-in — switching providers = replacing entire SDK
- No multi-provider support
- All subject to the same iframe silent renew breakage

**Verdict**: Architecturally disqualified for a multi-provider enterprise requirement.

---

### Option F: Hybrid (SPA OIDC Login + NestJS Bearer Validation)

#### How the flow works

```
React SPA (oidc-client-ts / react-oidc-context)
  │
  ├─ Login via Auth Code + PKCE → receives tokens
  ├─ Tokens in browser (sessionStorage / memory)
  │
  └─ API calls: Authorization: Bearer <access_token>
                         │
                      NestJS Guard
                         │
                         ├─ Decode JWT header → read `iss` claim
                         ├─ Map `iss` → JWKS URI
                         ├─ Fetch public key from JWKS (cached)
                         ├─ Verify signature + claims
                         └─ Attach user principal to request
```

#### Libraries

Frontend:
- `oidc-client-ts` + `react-oidc-context`

Backend:
- `jose` v6 (panva) — 1M+ dependents, zero dependencies, JWKS-cached validation
- OR `jwks-rsa` (Auth0) + `passport-jwt`

#### Multi-Provider JWT Validation (NestJS)

The dynamic issuer resolver pattern:

```typescript
// libs/auth/src/multi-issuer-jwks.service.ts
import { jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose';

const TRUSTED_ISSUERS: Record<string, URL> = {
  'https://keycloak.example.com/realms/chat': new URL('https://keycloak.example.com/realms/chat/protocol/openid-connect/certs'),
  'https://dev-xxx.okta.com/oauth2/default': new URL('https://dev-xxx.okta.com/oauth2/default/v1/keys'),
  'https://login.microsoftonline.com/{tenant}/v2.0': new URL('https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys'),
  'https://myapp.auth0.com/': new URL('https://myapp.auth0.com/.well-known/jwks.json'),
};

const jwksSets = Object.fromEntries(
  Object.entries(TRUSTED_ISSUERS).map(([iss, url]) => [iss, createRemoteJWKSet(url)])
);

async function validateBearer(token: string) {
  const { iss } = decodeJwt(token); // no signature check — read `iss` only
  if (!iss || !jwksSets[iss]) throw new UnauthorizedException('Untrusted issuer');
  return jwtVerify(token, jwksSets[iss], {
    issuer: iss,
    audience: 'chat-api',
    clockTolerance: 30,
  });
}
```

`createRemoteJWKSet` caches public keys automatically. No per-request network call once the cache is warm.

#### Token Storage

Same browser-side risks as Option A. Conscious trade-off: simpler backend, tokens remain in the browser.

#### Security Risks

- **HIGH**: Same as Option A — tokens in browser
- **LOW**: NestJS validation is stateless and scalable
- **MEDIUM**: Multi-issuer configuration must be kept in sync with IdP changes

#### Pros

- No session store infrastructure needed
- React/Vite native — no proxy, no cookie complexity
- NestJS stateless — scales horizontally without session affinity
- Full provider neutrality
- Multi-provider at scale via dynamic issuer resolver
- Straightforward migration from the existing auth approach

#### Cons

- Tokens in browser — same XSS risk as Option A
- Refresh cycle managed by `oidc-client-ts` (must configure correctly per IdP)
- Multi-provider SPA config still requires per-provider setup

---

## 5. Comparison Table

| Criterion | A: SPA OIDC | B: NestJS BFF | C: Express Adapter | D: Better Auth | E: Provider SDKs | F: Hybrid |
|---|---|---|---|---|---|---|
| **Security (token location)** | Browser (medium) | Server only (high) | Server only (high) | Server only (high) | Browser (medium) | Browser (medium) |
| **Provider coverage** | Any OIDC | Any OIDC | 100+ built-in | OIDC + SAML 2.0 | One per SDK | Any OIDC |
| **Vendor neutrality** | Full | Full | Full | Full | None | Full |
| **Implementation complexity** | Low | Medium | Medium | Medium | Low | Low-Medium |
| **Runtime/deployment complexity** | Low | Medium (session store) | Medium | Medium | Low | Low |
| **React/Vite compatibility** | Native | Cookie-based (good) | Cookie-based (good) | Cookie-based (good) | Native | Native |
| **NestJS compatibility** | Good (JWT guard) | Good (native) | Poor (community only) | Fair (community module) | Good (JWT guard) | Good (JWT guard) |
| **Multi-provider flexibility** | Manual | Native | Native | Native | None | Manual (dynamic issuer) |
| **Token refresh reliability** | Refresh token (good); iframe (broken) | Server-side (excellent) | Server-side (excellent) | Server-side (excellent) | Varies; iframe mostly broken | Refresh token (good) |
| **3rd-party cookie restrictions** | Affected | Not affected | Not affected | Not affected | Affected | Affected |
| **Role/claims mapping flexibility** | In-browser + backend | Backend (full control) | Backend | Backend | Provider-specific | Backend |
| **Production readiness** | High | High | Low (experimental) | Medium (v1.x) | High (single provider) | High |
| **Long-term maintainability** | Good | Good | Poor | Medium | Poor (lock-in) | Good |
| **SAML 2.0 support** | No | Via openid-client | No | Yes (SSO plugin) | Partial (MSAL) | No |
| **IETF BCP 212 compliance** | Conditional | Recommended | Compliant | Compliant | Conditional | Conditional |

---

## 6. Provider Compatibility Matrix

| Provider | A: SPA OIDC | B: BFF | C: Express Adapter | D: Better Auth | E: Provider SDK | F: Hybrid |
|---|---|---|---|---|---|---|
| Keycloak | Full | Full | Partial (undoc'd for Express) | Full (SSO plugin) | Keycloak-only SDK | Full |
| Auth0 | Full | Full | Full | Full | Auth0-only SDK | Full |
| Okta | Full | Full | Full | Full (SSO plugin) | Okta-only SDK | Full |
| Entra ID / Azure AD | Full | Full | Full | Full (SSO plugin) | MSAL only | Full |
| Azure B2C | Full | Full | Full | Partial | MSAL (B2C flows) | Full |
| AWS Cognito | Partial (quirks) | Partial (quirks) | Full | Partial | Amplify-only | Partial |
| Google | Full | Full | Full | Full | Via Entra B2C or separately | Full |
| GitLab | Full | Full | Full | Full | No | Full |
| Ping Identity | Full (OIDC) | Full (OIDC) | Full (OIDC) | Full (OIDC) | No | Full |
| Custom OIDC | Full | Full | Via generic OIDC | Via genericOIDC plugin | No | Full |
| SAML 2.0 (no OIDC wrapper) | No | No (needs SAML lib) | No | Yes (SSO plugin) | MSAL (ADFS) | No |

---

## 7. Security Analysis Per Option

### Options A / F (Tokens in Browser)

**PKCE**: Yes, enforced by `oidc-client-ts`.

**Implicit flow**: Not used — `oidc-client-ts` defaults to code flow.

**Client secret**: None in browser (correct for public client).

**XSS exposure**: Access token and refresh token are readable by any JavaScript executing in the page context. Mitigated by CSP, but not eliminated. Any npm dependency with write access to the global scope can exfiltrate tokens.

**Refresh token rotation**: Depends on IdP configuration. Must be explicitly enabled and verified per provider.

**Silent renew**: Iframe approach is effectively dead. Refresh token grant is the only working mechanism.

**Logout**: `signoutRedirect()` must be called; `removeUser()` alone clears local state but does not terminate the IdP session.

**IETF stance on Option A**: [draft-ietf-oauth-browser-based-apps §7.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps): *"Browser-based applications SHOULD use the BFF pattern when they handle sensitive user data or business logic."* For non-sensitive internal tools, Option A/F is conditionally acceptable.

### Options B / C / D (Server-Side Token Storage)

**XSS exposure**: None for tokens. XSS can still make authenticated requests on behalf of the user within the active session, but cannot exfiltrate tokens.

**CSRF**: `SameSite=Lax` prevents cross-origin cookie submission. Supplement with CSRF double-submit cookie for state-mutating endpoints per [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

**Session fixation**: Regenerate the session ID after successful authentication via `req.session.regenerate()`.

**Client secret**: Kept server-side in environment variables — never exposed to the browser. Allows the use of a confidential client.

**IETF stance**: Strongly recommended for business applications, personal data applications, and applications requiring regulatory compliance.

---

## 8. Recommendation

### Primary Recommendation: Option F — Hybrid (react-oidc-context + NestJS JWT Validation via `jose`)

**Why:** This option is the pragmatic balance for the Chat 2.0 architecture as it currently exists:

1. **Greenfield advantage**: No session store infrastructure to set up on day one.
2. **React/Vite native**: `react-oidc-context` integrates directly with the SPA — no proxy, no cookie complexity, no CORS configuration for auth endpoints.
3. **NestJS stateless backend**: `jose` + dynamic JWKS resolver gives a clean, testable, scalable JWT validation layer with zero new infrastructure.
4. **Full provider neutrality**: Changing from Keycloak to Entra ID = changing one URL in the frontend config and one issuer entry in the NestJS trusted issuers map.
5. **Multi-provider at scale**: The dynamic issuer resolver supports N providers simultaneously — correct architecture for a multi-tenant enterprise SaaS.
6. **Production-ready tooling**: `oidc-client-ts` (2.1M/week, actively maintained) and `jose` (1M+ dependents, zero dependencies) are both mature and security-audited.

**What to be honest about**: Option F inherits Option A's browser token storage risk. This is a conscious trade-off. The risk is **manageable** (not ignorable) via: strict CSP (`script-src 'self'`), refresh token rotation on all IdPs, short-lived access tokens (15 min), disable iframe silent renew, `offline_access` scope for all providers.

**Implementation summary:**
- Frontend: `oidc-client-ts` + `react-oidc-context`, with refresh token grant only
- Backend: `jose` v6 with `createRemoteJWKSet`, dynamic issuer resolver, trusted issuers config
- NestJS guard: extracts Bearer → decodes `iss` → validates signature + claims → attaches principal

---

### When to Choose Option B Instead (BFF)

Choose Option B (NestJS BFF with `openid-client`) over Option F when **any** of the following are true:

- The app handles personal health data, financial data, or is subject to GDPR with right-to-erasure.
- The security review formally requires IETF BCP 212 BFF compliance.
- The app targets regulated industries (healthcare, finance, government).
- FAPI 2.0 compliance is required — this mandates Pushed Authorization Requests, which require backend participation in auth initiation.
- The team can absorb the operational cost of a Redis session store from day one.
- Multiple non-browser clients (mobile, CLI) are in scope.

Option B is strictly more secure. The only reasons to choose F over B are implementation velocity and infrastructure simplicity.

---

### When to Choose Option D (Better Auth)

Choose Better Auth when:
- You need SAML 2.0 support (e.g., for Ping Identity, ADFS, some Okta/Entra enterprise configurations that don't offer OIDC).
- You are building a multi-tenant SaaS where each organization brings their own IdP.
- The team prefers a higher-level framework over assembling primitives.

The `@better-auth/sso` plugin's SAML 2.0 implementation is unique among the options reviewed.

---

## 9. Implementation Roadmap (Option F — Recommended)

### Slice 1: NestJS JWT Validation Layer

1. Add `jose` (latest v6) to `apps/chat-api/package.json`
2. Create `libs/auth` Nx library:
   - `trusted-issuers.config.ts` — environment-driven issuer → JWKS URI map
   - `multi-issuer-jwks.service.ts` — `createRemoteJWKSet` instances, `validateToken()` function
   - `jwt-auth.guard.ts` — NestJS `CanActivate` guard, calls `validateToken()`, attaches `AuthenticatedUser` to request
   - `current-user.decorator.ts` — `@CurrentUser()` parameter decorator
3. Add env vars to `.env.template`: `AUTH_TRUSTED_ISSUERS` (JSON array of `{iss, jwksUri, audience}`)
4. Apply `JwtAuthGuard` globally in `AppModule` (with `@AllowAnonymous()` on public routes)
5. Verify with curl + a real JWT from one provider

**Nx verification**: `pnpm nx build chat-api`, `pnpm nx test chat-api`

### Slice 2: React SPA Auth Integration

1. Add `oidc-client-ts`, `react-oidc-context` to `apps/chat/package.json`
2. Create `apps/chat/src/auth/`:
   - `auth-config.ts` — reads provider config from `VITE_AUTH_*` env vars
   - `auth-provider.tsx` — `<AuthProvider>` wrapper with refresh token config, no iframe
   - `auth-guard.tsx` — route-level guard (redirect to login if not authenticated)
   - `use-auth-token.ts` — hook that returns `getAccessToken()` for API calls
3. Update `apps/chat/src/server-api/base.ts` — inject `Authorization: Bearer` on every API call
4. Add `VITE_AUTH_AUTHORITY`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_REDIRECT_URI` to Vite env

**Nx verification**: `pnpm nx build chat`, `pnpm nx serve chat` (manual login test)

### Slice 3: Multi-Provider Configuration

1. Extend `trusted-issuers.config.ts` to support an array of issuers from env
2. Test with at least two providers (e.g., local Keycloak dev instance + Auth0 dev tenant)
3. Add provider-specific claim normalizer (Keycloak `realm_access.roles` vs Auth0 `https://myapp/roles`)
4. Document each provider's required settings (token lifetime, refresh token rotation, `offline_access` scope)

### Slice 4: Security Hardening

1. Review CSP in `main.ts` — ensure `script-src 'self'` is not widened by assets
2. Set access token TTL to 15 minutes on all IdPs
3. Enable refresh token rotation on all IdPs
4. Add integration tests: expired token → 401, wrong issuer → 401, tampered token → 401

### Slice 5: Logout + Session Lifecycle

1. Implement `signoutRedirect()` call in the SPA
2. Verify `end_session_endpoint` is called for each provider
3. Handle token expiry UX (show re-login modal vs. silent redirect)
4. Handle refresh token expiry (detect `interaction_required` error from `oidc-client-ts`)

---

## 10. Open Questions and Risks

| # | Question / Risk | Priority |
|---|---|---|
| 1 | **SAML requirement**: Do any target customers require SAML 2.0 and not OIDC? If yes, Option D (Better Auth) must be added. | HIGH |
| 2 | **Regulatory classification**: Is Chat 2.0 subject to GDPR Article 17 or financial/health data regulations? If yes, BFF (Option B) should be the architecture. | HIGH |
| 3 | **Cognito quirks**: AWS Cognito does not support `offline_access` scope in the standard way and lacks a token revocation endpoint. Workaround doc needed. | MEDIUM |
| 4 | **iframe silent renew deprecation**: Confirm all target IdPs support refresh token grant for silent renew. Document explicit settings per provider. | HIGH |
| 5 | **`openid-client` v6 ESM migration**: If the team later chooses Option B, assess effort for NestJS CJS → ESM migration. | MEDIUM |
| 6 | **Multi-tenant Entra ID audience**: The `audience` claim differs by API registration. NestJS trusted issuers config needs explicit `audience` per issuer. | MEDIUM |
| 7 | **Express auth adapter transition**: The adapter ecosystem is moving toward Better Auth. Track as a future upgrade option. | LOW |
| 8 | **FAPI 2.0 PAR requirement**: If any customer requires FAPI 2.0 compliance, Option F is insufficient — a BFF migration would be needed. | LOW (for now) |
| 9 | **DPoP sender-constrained tokens**: For high-security scenarios, consider DPoP binding. Not needed for initial release. | LOW |
| 10 | **React tab management**: `sessionStorage` is per-tab. Consider `localStorage` with refresh token rotation or a shared worker for token management. | MEDIUM |

---

## Sources

- [IETF draft-ietf-oauth-browser-based-apps (BCP 212)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7662 — Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [OIDC Core — offline_access](https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess)
- [oidc-client-ts](https://github.com/authts/oidc-client-ts) | [react-oidc-context](https://github.com/authts/react-oidc-context)
- [openid-client v6 (panva)](https://github.com/panva/openid-client)
- [jose v6 (panva)](https://github.com/panva/jose)
- [Better Auth SSO Plugin](https://www.better-auth.com/docs/plugins/sso)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [FAPI 2.0 — OpenID Foundation](https://fapi.openid.net/)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
