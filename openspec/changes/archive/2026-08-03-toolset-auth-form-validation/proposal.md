## Why

GitHub issue #8096 reports that on the Toolset Editor's Auth section, for an OAuth toolset
configured with "With Login & Config", the Client Secret field is not marked required (no
asterisk) and the Log In button stays inactive even once the visible required fields are
filled in. This contradicts the `toolset-authentication` spec's "OAuth credential fields"
requirement, which states the system SHALL require client id and client secret before
triggering the login. In `AuthSection.tsx`, the field's `required` label flag and the
`isToolsetAuthValid` gate that controls the Log In button both special-case edit mode
(`!isEditMode` / `isEditMode || clientSecret`), waiving the client secret requirement whenever
`toolsetId` is already set. Since chat-api never returns a stored `clientSecret` in
`GET /api/v1/toolsets/{id}` (it is a secret, never round-tripped to the client), this carve-out
leaves the button gated on an empty field with no visual indication of why, matching the
reported symptom.

## What Changes

- Remove the `isEditMode` carve-out from the Client Secret field's `required` flag and from
  `isToolsetAuthValid`'s OAuth-with-config branch in `apps/chat/src/utils/toolsets.ts`, so the
  field is marked required and the Log In button's enabled state agrees with it in both create
  and edit mode, matching the existing spec requirement.
- Verify the change against the two scenarios the prior carve-out was meant to serve (per
  commit `0c76df140`, "fix: toolset editor form bugs and save/error handling"): re-logging-in on
  an already-saved OAuth-with-config toolset, and the "with login" (no manual config) dynamic
  registration path, which does not render or require this field at all. If the carve-out was
  covering a real case (e.g. re-login without re-entering a still-valid secret), that case is
  re-scoped explicitly rather than silently regressed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `toolset-authentication`: the "OAuth credential fields" requirement's client-secret
  requirement no longer has an implicit edit-mode exception; the required-field indicator and
  the Log In button's enabled state are derived from the same condition in both create and edit
  mode.

## Impact

- `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx` — Client Secret `DialInput`
  `required` flag.
- `apps/chat/src/utils/toolsets.ts` — `isToolsetAuthValid`.
- `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/AuthSection.spec.tsx` and
  `apps/chat/src/utils/tests/toolsets.spec.ts` (or equivalent) — existing tests asserting the
  edit-mode carve-out need updating; new tests cover the corrected behavior.
- No API or DTO changes; this is a client-side form-validation fix only.
