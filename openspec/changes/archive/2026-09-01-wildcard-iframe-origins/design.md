## Context

`EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` (`apps/chat-api/src/config/environment.config.ts:663-688`) is a comma-separated list, transformed to `string[]`, validated with:

```ts
@IsUrl({ require_tld: false, require_protocol: true, protocols: ['https', 'http'] }, { each: true })
@Matches(/^https?:\/\/[^/\s?#]+$/, { each: true, message: '...' })
```

`@IsUrl` rejects a `*` character anywhere in the host, so `https://*.example.com` fails validation and the Nest app never boots (`ConfigModule.forRoot` throws synchronously). The list feeds two independent consumers:

1. **CSP generation** (`apps/chat-api/src/config/csp.ts` → `buildFrameSrcDirective`, `buildFrameAncestorsDirective`, used by `main.ts`'s Helmet config). These functions just interpolate the configured strings into `frame-src`/`frame-ancestors` directive value arrays — no origin comparison happens server-side. CSP's Fetch Directive Value grammar already treats a leading `*.` label as a valid host-source wildcard (e.g. `*.example.com` matches `foo.example.com` and `foo.bar.example.com`, per the CSP spec's `host-part` production), so once validation accepts the string, this path needs **no code change**.
2. **Frontend origin trust check** (`apps/chat/src/context/overlay/OverlayContext.tsx:429-431,824`) receives the same list (relabeled `overlayAllowedOrigins`) via `client-config` and does `overlayAllowedOrigins.includes(origin)` against `event.origin` from incoming `postMessage`s. `Array.includes` is a strict string-equality check, so a wildcard entry would never match a real origin here — this path **needs new matching logic**, not just permissive validation.

## Goals / Non-Goals

**Goals:**

- Accept exactly one wildcard form: a single `*.` as the leftmost label of the host, e.g. `https://*.example.com`, `http://*.example.internal:8080`. This mirrors CSP's own wildcard grammar, so the two enforcement layers (browser CSP, frontend postMessage check) agree on what a pattern matches.
- Keep accepting today's exact-origin form unchanged, and allow the two forms to be mixed in one comma-separated list.
- Make the frontend's origin check wildcard-aware so `SET_OVERLAY_OPTIONS`/host-origin trust decisions actually honor a configured wildcard, not just the CSP header.
- Reject anything else with the existing clear validation error: bare `*` (would allow any origin — CSP's own grammar disallows a bare `*` **host** in `frame-ancestors`-relevant contexts using our stricter allowlist semantics, and it is far too permissive for a defense-in-depth allowlist), `*` in a non-leftmost label (`https://foo.*.com`), more than one `*`, or a path/query/fragment on either form.

**Non-Goals:**

- No support for `*` matching zero labels' worth of separation control (i.e. we do not special-case whether the apex domain itself, `https://example.com`, is also implicitly allowed by `https://*.example.com` — it is not, matching CSP's own semantics: list the apex separately if it must also be allowed).
- No new environment variable, no change to `OVERLAY_ENABLED` gating, no change to `client-config`'s `overlayAllowedOrigins` shape (still `string[]`, wildcards returned verbatim).
- No attempt to centralize the matcher in a shared lib — see Decisions.

## Decisions

**Validation: one custom regex replaces `@IsUrl` + `@Matches`.**
Both decorators are dropped in favor of a single `@Matches` using a purpose-built regex, applied `{ each: true }` on `ALLOWED_IFRAME_ORIGINS`:

```ts
export const IFRAME_ORIGIN_PATTERN =
  /^(https?):\/\/(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*(?::\d+)?$/;
```

Rationale: `@IsUrl` has no option to permit a wildcard host, and layering a second permissive check on top of it just to carve out one exception is harder to read than one authoritative pattern. The regex requires `scheme://`, an optional single `*.` prefix, then a normal dotted hostname (each label alphanumeric, may contain internal hyphens, no leading/trailing hyphen), an optional `:port`, and nothing else — so a path, query string, fragment, a second `*`, or a `*` outside the leftmost position all fail to match. Alternative considered: keep `@IsUrl` for the exact-origin branch and add a second `@ValidateIf`-gated check for entries starting with `*.` — rejected because class-validator's per-element `each: true` decorators apply uniformly to every array entry, so branching would need a custom `@ValidatorConstraint` class instead of a plain decorator; a single regex is simpler and just as auditable for this narrow grammar.

**Matching logic lives at the app level, once per app — not in a shared lib.**
`libs/chat-shared` is documented as types-only ("shared TypeScript interfaces and types only, no logic"), and no other lib is positioned to hold this. The matcher is ~10 lines of pure string logic with zero host/env/DOM knowledge, so duplicating it in `apps/chat-api` (if a backend consumer ever needs it — see Non-Goals, none exists today) and `apps/chat` costs less than the indirection of inventing a new shared-logic lib for one function. Only the frontend actually needs a runtime matcher for this change (CSP enforcement is the browser's job, not ours).

Frontend matcher (new file `apps/chat/src/utils/overlay-origin.ts`):

```ts
export const matchesAllowedOrigin = (
  origin: string,
  allowedOrigins: string[],
): boolean => allowedOrigins.some((pattern) => matchesPattern(origin, pattern));

const matchesPattern = (origin: string, pattern: string): boolean => {
  const wildcard = /^(https?):\/\/\*\.(.+)$/.exec(pattern);
  if (!wildcard) {
    return origin === pattern;
  }
  const [, scheme, baseHost] = wildcard;
  const exact = /^(https?):\/\/(.+)$/.exec(origin);
  if (!exact) {
    return false;
  }
  const [, originScheme, originHost] = exact;
  return originScheme === scheme && originHost.endsWith(`.${baseHost}`);
};
```

`matchesPattern` compares the scheme exactly and the post-scheme remainder (host, optionally `:port`) as a literal string — this is deliberate: the pattern's remainder after `*.` is treated as an opaque suffix, so a pattern with a port (`https://*.example.com:8443`) only matches origins carrying that same `:8443`, and a pattern without a port only matches origins without one. This mirrors the exact-match behavior the code already has today for non-wildcard entries (full string equality), just narrowed to "equality of everything after the wildcard label."

`OverlayContext.tsx` swaps its two `overlayAllowedOrigins.includes(origin)` call sites (`isTrustedHostOrigin`, `handleSetOverlayOptions`) for `matchesAllowedOrigin(origin, overlayAllowedOrigins)`.

**No change to `csp.ts`.** Confirmed by inspection: `buildFrameSrcDirective`/`buildFrameAncestorsDirective` do no per-origin comparison, only array construction, so a wildcard string flows through unchanged and is enforced by the browser's own CSP wildcard grammar.

## Risks / Trade-offs

- **[Risk] A typo like `https://*example.com` (missing dot) silently becomes a literal-`*`-prefixed hostname label, not a wildcard, and could pass a looser regex accidentally.** → Mitigation: the regex requires `\*\.` (literal wildcard-then-dot) as the only place `*` may appear; `*example.com` has no dot immediately after `*`, so the whole alternation fails and validation rejects it at boot, same as today's fail-fast posture.
- **[Risk] Divergence between the backend's validation grammar and the frontend's runtime matcher** (e.g. someone tightens one but not the other later) **could let a pattern validate but never match, or vice versa.** → Mitigation: both are colocated with this change and covered by tests asserting the same example patterns in `validation.spec.ts` (backend) and a new `overlay-origin.spec.ts` (frontend); the design doc's regex and matcher are the single source of truth for both test suites to assert against.
- **[Risk/BREAKING] Existing deployments relying on the exact-match `.includes()` behavior are unaffected** since exact-origin entries keep working identically (`matchesPattern` short-circuits to `origin === pattern` when there's no `*.` prefix) — no rollback concern for non-wildcard configs.

## Migration Plan

No data migration. Deploy is a plain code change: operators who want subdomain-wildcard embedding add a `*.`-prefixed entry to `ALLOWED_IFRAME_ORIGINS`; existing exact-origin configs need no changes and behave identically after deploy. Rollback is a plain revert — no state to unwind.

## Open Questions

None — the CSP wildcard grammar and the "leftmost single label only" restriction were the only real design choices, and both are settled above.
