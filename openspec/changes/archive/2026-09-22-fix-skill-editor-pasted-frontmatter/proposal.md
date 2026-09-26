## Why

Issue [#8957](https://github.com/epam/ai-dial-chat/issues/8957): a user who copies an existing skill's `SKILL.md` into the Skill Editor's **Instructions** field gets a stored manifest with **two** front-matter blocks. This is our defect, not a DIAL Core limitation — the BFF forwards `skillManifest` verbatim (`apps/chat-api/src/skills/package/skills-package.service.ts:59`), and the double block is produced client-side by `buildSkillManifest`, which interpolates `instructions` directly after the fence it just wrote (`libs/chat-hooks/src/skill/skill.ts:105-112`).

The consequences are user-visible and silent: the Catalog **Details** tab renders the second block's lines as a setext `h2` heading, and the model is told the skill is named after the *original* skill, contradicting the new skill's own `name`/`description`. Nothing warns the user. The symmetric path — importing a `SKILL.md` through the upload dialog — is handled correctly, because it goes through `parseSkillManifest` (`libs/chat-hooks/src/skill/skill.ts:149`) which strips the block before seeding `instructions`. Only typed/pasted input bypasses that.

## What Changes

- Detect a leading YAML front-matter block in the **Instructions** value and **reject** it with an inline error under the field, instead of embedding it verbatim in the built `SKILL.md`. Chosen over silently lifting the block into the form (see Alternatives).
- Surface the error as soon as the offending text lands in the field (the pasted-text moment), not only when the user presses **Create**/**Save**. A submit-time guard is retained as a defensive backstop.
- Never modify the user's **Name**/**Description** values: the form is authoritative, the pasted block is never promoted into it.
- Apply the guard in **both** create and edit mode — `buildSkillManifestForSubmit` is shared by both, so both can currently produce a double block.
- Add one narrow callback to `libs/skill-editor`'s public props so the host can observe field values as they change. The library keeps treating `instructions` as an opaque string and does **not** gain a `yaml` dependency or any knowledge of the SKILL.md format.
- One new user-visible i18n string (the inline error message), added to `apps/chat/src/i18n/locales/en.json` and resolved by the host, per the library's no-i18n rule.

Not breaking: the new library prop is optional, and the guard only rejects input that previously produced a corrupt manifest.

### Alternatives considered

1. **Lift the block into the form** (populate `frontmatterRef` so `display_name` etc. survive, strip it from the body). Closest to the issue's first suggested remedy and symmetric with the upload-dialog import. Rejected: it mutates text the user pasted without asking, and the ambiguity of whose `name`/`description` wins is exactly what makes the current behavior confusing. The user chose explicit rejection.
2. **Silently strip the block.** Smallest diff, but destroys content without telling the user and loses the original's `display_name` with no trace.
3. **Reject on the BFF instead of the client.** `SkillsPackageService` could reject a manifest whose body opens with a second fence. Rejected as the primary fix: the feedback would arrive as a generic submit-time `400` with no field anchoring, and the strict backend parser (`apps/chat-api/src/skills/utils/skill-manifest-frontmatter.util.ts`) is on the archive-import path, not the create/update path. Worth revisiting separately as defence in depth; out of scope here.
4. **Baseline — do nothing.** Rejected: P2, `client_required`, and the corruption is silent.

### Rollback / backward compatibility

Fully reversible. No stored data shape changes and no API contract changes; already-created skills carrying a double block are unaffected by this change (repairing them is out of scope — the user edits and re-saves). Reverting means removing the guard and the optional library prop.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `skill-authoring`: create-mode submission rejects an Instructions value that opens with a YAML front-matter block, instead of building a `SKILL.md` with two blocks.
- `skill-editing`: edit-mode save applies the same rejection, since it shares `buildSkillManifestForSubmit`.
- `skill-editor-library`: `SkillEditorProps` gains an optional callback reporting current field values as the user edits, so the host can validate `instructions` live. The library still performs no YAML parsing and imports no `yaml`.

## Impact

**Code**

- `libs/skill-editor/src/models/skill-editor-props.ts`, `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` — new optional `onValuesChange` prop, invoked on field edits.
- `libs/chat-hooks/src/skill/skill.ts` — new pure detector for a leading front-matter fence (no `yaml` parse needed: the failure mode is structural).
- `libs/chat-hooks/src/skill/useSkillEditorSubmit.ts` — live `instructions` validation plus the submit-time guard, feeding `errors.instructions`.
- `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` — wires the new callback and passes the translated message.
- `apps/chat/src/i18n/locales/en.json` + `apps/chat/src/constants/translation-keys.ts` — one new key.

**Docs**

- `libs/skill-editor/README.md` (new prop) and `libs/chat-hooks/README.md` (new exported helper), then `npm run validate:docs`.

**Not affected**

- `apps/chat-api/**` — no endpoint, DTO, or OpenAPI change; no `npm run openapi` run needed.
- DIAL Core — unchanged; it already stores exactly what it is given.

**Scope creep note**

This touches two shared libraries (`libs/skill-editor`, `libs/chat-hooks`). The library boundary holds: the new `libs/skill-editor` prop carries only opaque form values outward, and both the YAML/SKILL.md format knowledge and the translated message stay in `libs/chat-hooks` and `apps/chat` respectively — the library receives the resolved error string through the existing `errors.instructions` prop, as it already does for every other validation message.

**i18n**

One new user-visible string. Arabic/RTL needs no special handling: the message renders in the existing `ErrorText` slot, which already inherits direction from the ambient `dir`.
