# Auth Architecture: Stateless BFF with Encrypted Cookie Session

**Project:** Chat 2.0 (React/Vite + NestJS)
**Version:** 1.0 | **Date:** 2026-05-13 | **Status:** Proposal

---

## 1. Goals and Constraints

| Requirement | Decision |
|---|---|
| Strong security against XSS token theft | Tokens MUST NOT be readable by browser JavaScript |
| Multiple identity providers (Keycloak, Auth0, Okta, Entra ID, …) | Provider-neutral OIDC layer on the server |
| No Redis or external session store available | Session state lives **inside an encrypted HttpOnly cookie** |
| Greenfield React/Vite SPA + NestJS API | NestJS is the confidential OIDC client (BFF) |
| Compatible with IETF BCP 212 (browser-based apps) | BFF pattern, code + PKCE, no implicit flow |

The chosen pattern is a **Stateless Backend-for-Frontend (BFF)**: NestJS performs the full OIDC dance, encrypts the resulting tokens with an AEAD cipher, and sends them back to the browser as `HttpOnly` cookies. No tokens are ever exposed to JavaScript, and no server-side session store is needed.

---

## 2. High-Level Architecture

![High-level architecture](./auth-diagrams/01-high-level-architecture.svg)

_Source: [`auth-diagrams/01-high-level-architecture.mmd`](./auth-diagrams/01-high-level-architecture.mmd)_

Key properties:

- The SPA never touches `access_token` or `refresh_token`.
- The cookie payload is opaque to the browser (AEAD-encrypted).
- The BFF decides which IdP to use per request via `:providerId`.
- The API tier remains stateless — every NestJS pod can decrypt the cookie with the shared key.

---

## 3. Cookie Design

![Cookie structure](./auth-diagrams/07-cookie-structure.svg)

_Source: [`auth-diagrams/07-cookie-structure.mmd`](./auth-diagrams/07-cookie-structure.mmd) — browser cookie jar → JWE on the wire → server-side plaintext._

### 3.1 Cookie Contents

The session is a JWE (`alg: dir`, `enc: A256GCM`) whose plaintext payload is:

```json
{
  "v": 1,
  "sid": "0d3e6a…",
  "providerId": "keycloak",
  "sub": "user-123",
  "at": "<access_token>",
  "rt": "<refresh_token>",
  "at_exp": 1715600000,
  "rt_exp": 1715686400,
  "iat": 1715596400,
  "claims": { "roles": ["admin"], "email": "u@x.io" }
}
```

### 3.2 Cookie Attributes

| Attribute | Value | Reason |
|---|---|---|
| `HttpOnly` | `true` | JS cannot read or write |
| `Secure` | `true` | HTTPS only |
| `SameSite` | `Lax` | Blocks most CSRF, allows top-level OIDC redirect |
| `Path` | `/` | One cookie for whole app |
| `Max-Age` | `rt_exp` | Lives as long as the refresh token |
| `Name` | `__Host-chat.sess` | `__Host-` prefix locks host/path |

### 3.3 Size Considerations

Browsers cap cookies at ~4 KB. Entra ID access tokens can be large; if a single cookie does not fit, split into two:

- `__Host-chat.sess` — long-lived (refresh + identity claims)
- `__Host-chat.at` — short-lived (current access token only)

If splitting is undesirable, **store only `refresh_token` + claims in the cookie** and re-acquire `access_token` server-side on demand via the refresh grant; cache it in memory per pod for its short TTL.

### 3.4 Encryption Keys

- Active key + 1–2 previous keys for rotation without forced logout.
- 32-byte random secrets from env or KMS.
- Recommended library: [`jose`](https://github.com/panva/jose) (`CompactEncrypt` / `compactDecrypt`) — standards-based, supports key rotation, no extra deps. Alternative: [`iron-session`](https://github.com/vvo/iron-session) ergonomic wrapper.

---

## 4. Multi-Provider Registry

![Multi-provider registry](./auth-diagrams/02-provider-registry.svg)

_Source: [`auth-diagrams/02-provider-registry.mmd`](./auth-diagrams/02-provider-registry.mmd)_

Each provider entry is a confidential OIDC client configured through `openid-client`:

```ts
type ProviderConfig = {
  id: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  audience?: string;
  rolesClaim?: string;
  adminRoles?: string[];
  postLogoutRedirectUri: string;
};
```

Login URLs become `/auth/login/:providerId`. The active provider is encoded in the session, so refresh and logout always use the correct IdP.

---

## 5. Flow Diagrams

### 5.1 Login Flow (Authorization Code + PKCE)

![Login flow](./auth-diagrams/03-login-flow.svg)

_Source: [`auth-diagrams/03-login-flow.mmd`](./auth-diagrams/03-login-flow.mmd)_

The transient `tx` cookie holds only `{ state, nonce, code_verifier, providerId }`, lives 5–10 minutes, and is deleted immediately after callback.

### 5.2 Authenticated API Request with Transparent Refresh

![Authenticated API request with refresh](./auth-diagrams/04-api-request-refresh.svg)

_Source: [`auth-diagrams/04-api-request-refresh.mmd`](./auth-diagrams/04-api-request-refresh.mmd)_

### 5.3 Logout (Federated)

![Federated logout](./auth-diagrams/05-logout-flow.svg)

_Source: [`auth-diagrams/05-logout-flow.mmd`](./auth-diagrams/05-logout-flow.mmd)_

### 5.4 Cross-Pod Stateless Decryption

![Cross-pod stateless decryption](./auth-diagrams/06-cross-pod-stateless.svg)

_Source: [`auth-diagrams/06-cross-pod-stateless.mmd`](./auth-diagrams/06-cross-pod-stateless.mmd)_

Any pod can decrypt any cookie because all pods share the same active key + previous keys. No session affinity is required.

---

## 6. NestJS Module Layout (Proposed)

```
apps/chat-api/src/auth/
├── auth.module.ts
├── auth.controller.ts        # /auth/login, /auth/callback, /auth/logout, /auth/me
├── providers/
│   ├── provider-registry.ts  # config-driven OIDC clients (openid-client)
│   └── provider.types.ts
├── session/
│   ├── session.service.ts    # encrypt/decrypt via jose (JWE A256GCM)
│   ├── session.guard.ts      # reads cookie, validates, attaches principal
│   └── keys.service.ts       # active + previous keys, rotation
├── csrf/
│   └── csrf.guard.ts         # double-submit token for state-mutating endpoints
└── refresh/
    └── refresh.service.ts    # server-side refresh + in-memory per-pod mutex
```

Public endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/providers` | List of available providers for the UI |
| GET | `/auth/login/:providerId` | Start login (sets `tx` cookie, redirects to IdP) |
| GET | `/auth/callback/:providerId` | Exchange code, set session cookie |
| GET | `/auth/me` | Return current user profile (no tokens) |
| POST | `/auth/logout` | Revoke + clear cookie + federated logout |
| POST | `/auth/refresh` | Optional explicit refresh (also done implicitly) |

The session guard is applied globally to `/api/*` routes; everything except `/auth/*` requires a valid decrypted cookie.

---

## 7. Security Checklist

| Risk | Mitigation |
|---|---|
| XSS reads tokens | `HttpOnly` cookie + AEAD encryption; tokens never in JS |
| CSRF on mutating endpoints | Double-submit CSRF token + `SameSite=Lax` + `Origin/Sec-Fetch-Site` checks |
| Refresh token replay | Refresh token rotation; `sid`/`jti` in payload; reject reused token |
| Cookie tampering | AES-GCM authenticated tag; decryption fails on any byte change |
| Key compromise | Key rotation with `kid` header; previous keys for grace period |
| Session fixation | New `sid` generated on every login |
| Open redirect on callback | Strict `redirect_uri` allow-list per provider |
| Token in URL fragment | Not used — Authorization Code only, never implicit |
| Cookie size overflow (Entra) | Split cookie or store refresh-only + cache `access_token` in memory |
| Multi-tab refresh race | Per-pod in-memory mutex on `sid`; idempotent refresh |

Mandatory transport: HTTPS everywhere, HSTS, `Secure` cookies, strict CSP (`script-src 'self'`).

---

## 8. Trade-offs vs. Other Options

| Option | Tokens in JS | Multi-provider | No Redis | Refresh reliability |
|---|---|---|---|---|
| Pure SPA OIDC | Yes (risk) | Manual | Yes | Iframe broken |
| Hybrid (SPA + JWKS in API) | Yes (risk) | Manual | Yes | Iframe broken |
| **BFF + encrypted cookie (this doc)** | **No** | **Native** | **Yes** | **Server-side** |
| BFF + Redis session | No | Native | No (needs Redis) | Server-side |
| Auth.js Express | No | Built-in | Yes (JWE cookie) | Server-side; experimental |

The proposed pattern is the only column that scores well on **all four** of your constraints simultaneously.

---

## 9. Open Decisions Before Implementation

1. **Cookie shape**: single cookie with both tokens, or split `sess` + `at`?
2. **Audience strategy**: does the SPA call DIAL Core directly (cookie domain matters) or always through the BFF proxy? The proposal assumes the latter.
3. **Cookie domain**: same-site `app.example.com` and `api.example.com`? If different, set parent domain `.example.com` + `SameSite=Lax`; if cross-site, `SameSite=None; Secure` and add CSRF tokens to every endpoint.
4. **Logout policy**: federated `end_session_endpoint` for every provider, or only those that support it cleanly?
5. **Provider list scope for v1**: which IdPs are first-class on day one (Keycloak + Auth0 only, or full preset list)?
6. **Key management**: env-only for v1, KMS later?

---

## 10. Suggested Thin Vertical Slice

Following `incremental-implementation`:

1. **Slice 1 — single provider (Keycloak), happy path**
   `auth.module`, `provider-registry` with one entry, `/auth/login`, `/auth/callback`, `session.service` (encrypt/decrypt), `/auth/me`. Cookie holds full payload. No refresh yet.
2. **Slice 2 — protected API + transparent refresh**
   `session.guard`, refresh on near-expiry, per-pod mutex, set new cookie on refresh.
3. **Slice 3 — logout (local + federated)**
   `/auth/logout`, revoke endpoint call, `end_session_endpoint` redirect.
4. **Slice 4 — second provider (Auth0)**
   Validate the registry abstraction; per-provider audience/scopes.
5. **Slice 5 — CSRF, key rotation, CSP hardening**
   Double-submit CSRF token, `kid`-based key rotation, security headers audit.

Each slice ships with `nx test apps/chat-api` (unit) + an e2e test against the IdP container.
