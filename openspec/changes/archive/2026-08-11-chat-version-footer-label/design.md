## Context

The chat version reaches the UI today only through one narrow path: `AppConfigService`
computes `APP_VERSION` from `apps/chat-api/package.json` at module scope
(`apps/chat-api/src/app-config/app-config.service.ts:24`) and substitutes it for the
`%%VERSION%%` token inside `FOOTER_HTML_MESSAGE` before sanitization
(`app-config.service.ts:31-54`). If the operator never writes that token, the version is
invisible; and because the value is baked into the committed `package.json`, a CI/CD pipeline
that stamps its own build identifier has nowhere to put it.

Everything else operator-tunable already flows through one pipeline:
`EnvironmentVariables` (class-validator, `apps/chat-api/src/config/environment.config.ts`) →
`CONFIG_DEFINITIONS` (`config-registry/config-registry.constants.ts`) → `EnvConfigProvider`
(`config-registry/env-config.provider.ts`) → `AppConfigService.getClientConfig`
(60 s cache, key `app-config:client:<appId>:user:<userId>:roles:<roles>`) → `ClientConfigDto` →
generated `@epam/chat-api-client` → `AppConfigContext`. This change adds one value to that
pipeline and one render slot to `FooterMessage`.

Constraints:

- `FooterMessage` is mounted in three places — `ConversationView.tsx:890`,
  `NewConversationComposer.tsx:399`, `MobileNavBottomSheet/NavPageContent.tsx:87` — and the
  component itself decides whether it is visible. No call site may need editing.
- The footer HTML is injected with `dangerouslySetInnerHTML` and is currently on the
  `<section>` root itself, so nothing else can be a sibling inside the region today.
- WCAG 2.1 AAA is the target; the footer strip uses `dial-tiny-text` and `text-secondary`,
  which is legitimate secondary/muted chrome, not body content.

## Goals / Non-Goals

**Goals:**

- Operators and CI/CD can set the displayed chat version with a single env var, `CHAT_VERSION`.
- A version is always shown (falls back to `packageJson.version`), so support can always ask
  for it.
- The version label is visible regardless of whether `FOOTER_HTML_MESSAGE` or the `footer`
  feature flag is configured.
- The operator's footer copy stays visually centered across the full width, exactly as today.
- RTL-correct: the label pins to the inline-end corner and its digits do not reorder.

**Non-Goals:**

- No version-drift detection, update prompts, or reload behaviour — `frontend-new-version-reload`
  owns that concern and is untouched.
- No new endpoint. No change to the app-config cache TTL or cache key.
- No semver parsing, comparison, or validation of `CHAT_VERSION` — it is an opaque display string.
- No change to the `%%VERSION%%` sanitization pipeline itself (allowlist, anchor rewriting).
- The version label is not role-gated and is not added to `ENABLED_FEATURES`.

## Decisions

### D1 — `CHAT_VERSION` env var over a build-time constant

**Decision:** add `CHAT_VERSION?: string` to `EnvironmentVariables` with `@IsOptional()
@IsString()` and no `@Matches` allowlist.

**Why:** a runtime env var lets the same image be re-labelled per environment (`dev`, `rc`,
`prod`) without a rebuild. A Vite `define` / `import.meta.env` constant would freeze the value
into the JS bundle and bypass the config registry that every other client-visible value uses.

**On the missing `@Matches`:** the repo's NestJS rules require an allowlist regex for strings
that reach a *path, URL, or log line*. `CHAT_VERSION` reaches none of those — it is placed in a
JSON response body and rendered by React as a text node (auto-escaped), never interpolated into
a filesystem path, an outbound URL, or a logger call. A regex here would only reject legitimate
CI formats (`2026.08.10+a1b2c3d`, `0.45.0-rc.3`). Length is not bounded either; an operator
setting a 10 KB version string only harms their own deployment's footer.

*Alternative rejected:* `@Matches(/^[\w.+-]{1,64}$/)`. It would be defensible, but it silently
drops (or fails boot on) valid-but-unanticipated CI stamps, and the value has no injection sink.

### D2 — Registry key `app.version`, resolved through the generic `envVar` path

**Decision:** add to `CONFIG_DEFINITIONS`:

```
key: 'app.version', type: 'config', valueType: 'string', visibility: 'client',
defaultValue: null, critical: false, envVar: 'CHAT_VERSION', owner: 'chat-team'
```

**Why:** `EnvConfigProvider.resolve` already handles any definition that carries an `envVar`
via its generic tail (`env-config.provider.ts:103-119`) — type-checks the value and returns it.
No new `if (key === ...)` branch is needed, unlike `features.footer`, `customVisualizers`, or
`fileManager.availableTabs`, which all need bespoke derivation. Keeping this one on the generic
path is the smallest possible registry change.

### D3 — Fallback to `packageJson.version` lives in `AppConfigService`, not in `defaultValue`

**Decision:** leave `defaultValue: null` in the registry; in `getClientConfig`, resolve
`app.version` into a local and coalesce:

```
appVersion = typeof resolved === 'string' && resolved.trim() ? resolved.trim() : APP_VERSION;
```

**Why:** `CONFIG_DEFINITIONS` is a declarative, import-light metadata table; making its
`defaultValue` depend on `packageJson` would couple the registry constants to a build artifact
and to `resolveJsonModule`. `AppConfigService` already imports `packageJson`
(`app-config.service.ts:10`) for exactly this value, so the fallback belongs there. The empty
string case is folded in via `.trim()` — an env var set to `""` or `"   "` is operator error,
and falling back beats rendering `v` with nothing after it.

### D4 — `%%VERSION%%` resolves from the same value, so `CHAT_VERSION` overrides it

**Decision:** `sanitizeFooterHtml` takes the resolved version as a parameter instead of closing
over the module-level `APP_VERSION` constant.

**Why:** two version sources disagreeing in the same footer strip (token says `1.2.3`, label
says `2026.08.10`) is a support trap. One resolved value feeds both. This is a behaviour change
to an existing spec scenario ("Version token substitution"), so `footer-message` gets a
MODIFIED delta rather than a silent edit. Existing deployments that never set `CHAT_VERSION`
see byte-identical output.

### D5 — Absolutely-positioned label; footer HTML moves into a child element

**Decision:** the `<section>` becomes `relative` and stops carrying `dangerouslySetInnerHTML`
directly. Two children:

```
<section aria-label={t(RegionAriaLabel)} className="relative ...">
  {isMessageVisible && <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />}
  {isVersionVisible && (
    <span dir="ltr" aria-label={t(VersionAriaLabel, { version })}
          className="pointer-events-none absolute bottom-4 end-4 desktop:end-8">
      {formatAppVersion(appVersion)}
    </span>
  )}
</section>
```

**Why absolute, not a flex row:** the operator's copy must stay centered against the *full*
width, matching the current rendering and the design. A flex sibling would shift the centre by
half the label's width, and the shift would change whenever the version string's length
changes. The trade-off is that a very long version string can overlap very long footer copy —
accepted, and mitigated by `pointer-events-none` so the label never blocks the footer's links,
plus the `desktop:end-8` inset matching the section's existing `desktop:px-8`.

**Why `dir="ltr"` on the span:** version strings are LTR-structured (`0.45.0-rc.3`). Under an
`dir="rtl"` ancestor the bidi algorithm can reorder the leading `v` and the trailing `-rc.3`
segment. Pinning the span to `ltr` keeps the glyph order stable; `end-*` (a logical utility)
still flips the *position* to the correct corner, which is what should flip.

*Alternative rejected:* render the version through the same `dangerouslySetInnerHTML` string by
appending markup server-side. It would put presentation in the backend and re-open an XSS
surface for a value that has no reason to be HTML.

### D6 — Visibility: the region shows when *either* child has content

**Decision:**

```
isReady          = status === UserConfigStatus.Ready
isMessageVisible = isReady && isFooterEnabled && !!sanitizedHtml
isVersionVisible = isReady && !!appVersion
if (!isMessageVisible && !isVersionVisible) return null;
```

The `footer` feature flag keeps gating the *HTML message only*. The version label is
deliberately ungated: it is diagnostic chrome, and gating it behind a flag that exists to
control operator marketing copy would mean a deployment must author footer HTML to get a
version number — the exact problem this change solves.

**Consequence to accept:** deployments that today render nothing in the footer strip will start
rendering a small version label. That is the intended product change, not a regression, and
`ENABLED_UI_FEATURES` is not extended to opt out of it (a deployment that wants no version at
all is not a requested use case; adding a flag for it is speculative).

### D7 — `formatAppVersion` helper in `apps/chat/src/utils/footer-message.ts`

**Decision:** a small exported arrow function that prefixes `v` unless the string already starts
with `v`/`V`:

```
export const formatAppVersion = (version: string): string =>
  /^v/i.test(version.trim()) ? version.trim() : `v${version.trim()}`;
```

**Why:** `packageJson.version` is bare (`0.0.1`) but a CI stamp is often already tagged
(`v0.45.0`). Rendering `vv0.45.0` is the obvious bug this avoids. It goes in the existing
`footer-message.ts` utils module (which already hosts `sanitizeFooterHtml`) rather than a new
one-function file, per the repo's "group by domain concept" file-naming rule, and it is a
`const` arrow per the TypeScript conventions.

### D8 — Accessibility

- The label is `aria-label`-ed via i18n (`footerMessage.versionAriaLabel`, interpolating the
  version) so screen-reader users hear "Application version 0.45.0" rather than the ambiguous
  glyph run "v0.45.0". The `aria-label` value goes through `t()` with a
  `FooterMessageI18nKeys` enum member, never a raw string literal.
- No `aria-live` region: the version is static for the session's lifetime and never changes in
  response to a user action, so the dynamic-feedback rule does not apply.
- Contrast: the label inherits the strip's existing `text-secondary`. That is AAA-acceptable
  here because a build identifier is genuinely secondary/muted chrome, not body content — the
  same treatment the surrounding footer text already carries. No new `var(--token, #hex)`
  fallback chain is introduced.
- The label is a non-interactive `<span>`, so no keyboard-focus or focus-visible concern.

### D9 — Frontend context shape

`AppConfigState['config']` gains `appVersion: string`, initialised to `''` in `INITIAL_STATE`
and read as `response.config?.appVersion ?? ''` in `loadConfig` — mirroring the existing
`footerHtmlMessage` handling (`AppConfigContext.tsx:57` and `:95`). `''` while loading means
`isVersionVisible` is false until the config resolves, so nothing flashes. The context value is
already `useMemo`-wrapped (`AppConfigContext.tsx:122`); no new memoisation is required, and
`FooterMessage` remains `memo`-wrapped.

## Risks / Trade-offs

- **A long `CHAT_VERSION` overlaps long footer copy on a narrow viewport** → the label is
  `pointer-events-none` so it can never intercept a footer link click, and the fallback
  `packageJson.version` is short. Operators control both strings and can shorten either.
- **Deployments with no footer configuration now render something where they rendered nothing**
  → intended (D6); called out here so it is not read as an unintended regression at review.
  Documented in `.env.template` and `apps/chat-api/README.md`.
- **`CHAT_VERSION` is unvalidated free text** → no injection sink (D1); rendered as a React text
  node, not HTML, and not logged or used in a path/URL. Worst case is a cosmetically broken
  footer in the operator's own deployment.
- **The `app-config` response is cached 60 s per user+roles** → a version change is not visible
  until the cache expires *and* the client re-fetches (which happens on load). Acceptable: the
  version only changes on deploy, and a deploy restarts the process, clearing the in-memory cache.
- **OpenAPI regeneration touches generated files under `libs/chat-api-client`** → generated only
  via `npm run openapi`, verified with `npm run openapi:check`; no hand edits, per the
  generated-client exception in AGENTS.md §Library isolation.
- **Restructuring the `<section>` to hold children changes the DOM the existing tests assert on**
  (`FooterMessage.spec.tsx` reads `region.innerHTML`) → those assertions still hold, since the
  sanitized HTML remains inside the region subtree; the specs are updated in the same slice.

## Migration Plan

1. Backend slice ships first: env var, registry entry, service resolution, DTO. `appVersion` is
   additive — a frontend that does not read it is unaffected.
2. Regenerate and publish the client (`npm run openapi`, `npm run openapi:check`, build + lint
   `chat-api-client`).
3. Frontend slice: context field, then `FooterMessage` rendering.
4. Deploy: no action required — existing deployments get `packageJson.version` in the label.
   Operators opt into a custom value by setting `CHAT_VERSION`.

**Rollback:** revert the commits. There is no persisted state, no migration, and no consumer
outside this repo depends on `appVersion`. Reverting only the frontend is also safe (the DTO
field is simply ignored).

## Open Questions

- Should a deployment be able to suppress the version label entirely (e.g. `CHAT_VERSION=none`
  or an `ENABLED_UI_FEATURES` entry)? Deferred — no requester today; D6 records the reasoning.
- The `%%VERSION%%` token is now redundant with a dedicated label. Deprecating it is out of
  scope for this change; it stays supported and simply resolves from the new source (D4).
