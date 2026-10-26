## Context

DIAL Core stores a toolset's OAuth client secret write-only. Its toolset `GET` responses carry `auth_settings.client_secret_hint` (the last four characters) instead, as observed on `getCustomToolSet` for a custom toolset:

```json
"auth_settings": {
  "authentication_type": "OAUTH",
  "client_id": "Iv23li6Tjp68EjvaPGsd",
  "client_secret_hint": "d4c6",
  "authorization_endpoint": "https://github.com/login/oauth/authorize",
  "token_endpoint": "https://github.com/login/oauth/access_token",
  "redirect_uri": "http://localhost:4207/auth/toolset-signin",
  "global_auth_status": "SIGNED_OUT",
  "user_level_auth_status": "SIGNED_IN",
  "dynamically_registered": false
}
```

Current data path for the toolset editor:

`ToolsetApplicationEditor` (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`) → `getToolset` (`apps/chat/src/server-api/toolsets.ts`) → `GET /api/v1/toolsets/{toolsetName}` → `ToolsetsListingService.getToolset` → `getCustomToolSet` (+ best-effort `getToolset`, merged by `mergeCustomToolsetDetails`, where the custom response's `auth_settings` wins) → `mapDialToolsetToDto` → `mapAuthSettings` (allowlist) → `DialToolsetDto` → `toolsetDtoToForm` / `authSettingsDtoToForm` (`apps/chat/src/utils/toolsets.ts`) → `ToolsetEditor` form state → `AuthSection`.

`GET /api/v1/deployments/{deployment}/details` builds `ToolsetAuthSettingsDto` through a second allowlist, `mapToolsetAuthSettings`. Both allowlists exist precisely so `client_secret`/`code_verifier` can never leak; neither lists `client_secret_hint`.

On save, `formToToolsetBody` sends `clientSecret` only when the user typed one; in edit mode `isToolsetAuthValid(auth, true)` does not require it, and the backend's `preserveHiddenAuthSettings` copies stored OAuth fields that the body omits. The secret itself never round-trips, because Core never returns it.

## Goals / Non-Goals

**Goals:**

- Carry Core's hint, unchanged, from both toolset `GET` paths to the frontend as `clientSecretHint`.
- Show it in the toolset editor as `******d4c6` while the stored secret is in effect.
- Make it structurally impossible for the hint to be submitted as a secret.

**Non-Goals:** see proposal. In particular: no external-service hint, no new UI outside the toolset editor, no change to Core's omit-preserves contract.

## Decisions

### D1 — Map `client_secret_hint` in both allowlists; keep writes closed

`mapAuthSettings` and `mapToolsetAuthSettings` each add `clientSecretHint: getString(raw, 'client_secret_hint')`. Both DTO classes gain `@ApiPropertyOptional({ description: 'Last characters of the stored OAuth client secret, as returned by DIAL Core. Never the secret itself.', example: 'd4c6' }) clientSecretHint?: string`.

Writes are unchanged:

- `ToolsetBodyDto` gets no hint field, so the global `ValidationPipe` (`forbidNonWhitelisted`) rejects a body that tries to send one.
- `OAUTH_MERGEABLE_KEYS` does not gain `client_secret_hint`, so `preserveHiddenAuthSettings` never copies it into the Core `PUT` body.

*Alternative rejected:* forwarding the whole raw `auth_settings` minus a denylist. It inverts the safety property the allowlists provide — a future secret-bearing Core field would leak by default.

### D2 — Hint is a display-only field on `ToolsetAuthFormData`

`ToolsetAuthFormData.clientSecretHint?: string` is seeded by `authSettingsDtoToForm` and is never read by `formToToolsetBody`, `isToolsetAuthValid`, `isToolsetFormValid`, or `validateSetup`. Because `fetchToolsetAuthSettings` and the OAuth result merge both go through `authSettingsDtoToForm`, a refetch after login refreshes the hint for free.

*Alternative rejected:* a separate `clientSecretHint` prop on `ToolsetEditor`. It would need its own re-seeding when the editor reloads a toolset, while the form state already has exactly that lifecycle.

### D3 — Placeholder + caption, only while the stored secret is in effect

`AuthSection` shows the hint when **all** of the following hold: OAuth "Custom login" is selected, `isEditMode` is true, `auth.clientSecretHint` is non-empty, and `auth.clientSecret` is empty. Then:

- `placeholder` = `labels.clientSecretHintPlaceholder(hint)` (default `` `******${hint}` ``) instead of `clientSecretPlaceholder`;
- `caption` = `labels.clientSecretKeepCaption` (default `Leave empty to keep the saved secret.`).

The mask is a fixed six asterisks, independent of the secret's length, so it reveals nothing beyond what Core already sent. In create mode a draft can acquire a hint after an auto-save, but the secret is still required there, so the "keep" caption would be wrong — hence the `isEditMode` gate.

*Alternatives rejected:* pre-filling the input value with the mask (it would be submitted as the secret and "revealed" by the toggle); hint in the label text (changes the input's accessible name).

### D4 — Accessibility and direction

The "keep" caption MUST be the input's accessible description (`aria-describedby`); the placeholder is a visual affordance only and is not the sole carrier of meaning. Whether the kit's 2.0 `PasswordInput` already wires its `caption` prop that way could not be confirmed from the bundled kit, so implementation checks it first (`getEntityDetails("component", "PasswordInput")` / a test on the rendered DOM); if it does not, the caption is rendered as a sibling element with an id passed through `aria-describedby`, the way `CredentialsApiKeyOverlay` (`libs/catalog/src/components/Details/Header/CredentialsApiKeyOverlay/CredentialsApiKeyOverlay.tsx`) does for its header hint. The caption uses the kit's existing caption token, so contrast is inherited (no new colour). The masked value is direction-neutral text. No new icon, so nothing to mirror; nothing in the lib reads the language.

### D5 — i18n

One new key, `toolsetEditor.auth.clientSecretKeepCaption`, in `en.json` and `ToolsetEditorI18nKeys`, passed through `ToolsetApplicationEditor`'s `settings` labels. The placeholder label function is left at its default (asterisks + hint carry no translatable text); hosts may still override it.

## Risks / Trade-offs

- [Core sends the hint only on `getCustomToolSet`, not on `getToolset`] → the merge keeps the custom response's `auth_settings`, which is the one the editor uses for custom toolsets; for an OpenAI-path toolset without a hint the UI simply falls back to today's rendering.
- [Hint drifts from the real secret after a save] → every toolset write already calls `ToolsetsListingService.invalidateCaches`, which clears both `toolsets:single:<sub>:<toolsetName>` and the deployment-details entry, so the next load shows the new hint. No new cache key or TTL.
- [Someone later spreads the raw form into the request body] → the backend `ValidationPipe` would reject `clientSecretHint` with 400 rather than store it; a unit test on `formToToolsetBody` pins that the hint is never emitted.
- [Debug logging] → `redactToolsetAuthSettings` keeps redacting `client_secret`/`code_verifier`; the hint is not a secret and is logged as-is, matching what Core itself exposes.

## Migration Plan

No data migration, no env var, no feature flag. Backend and frontend ship together; an older frontend ignores the new optional field, and an older Core never sends it. Rollback is reverting the change.

## Open Questions

- Does Core also return a hint for external-service OAuth secrets (application editor) or for stored API keys? Deliberately out of scope; revisit once confirmed against Core.
