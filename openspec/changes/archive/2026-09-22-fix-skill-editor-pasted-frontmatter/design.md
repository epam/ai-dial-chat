## Context

`SKILL.md` is built client-side. `buildSkillManifest` (`libs/chat-hooks/src/skill/skill.ts:105-112`) writes a fence, the serialized frontmatter, a closing fence, a blank line, and then `instructions` verbatim:

```ts
const frontmatter = stringify({ name, description }).trimEnd();
return `---\n${frontmatter}\n---\n\n${instructions}`;
```

Nothing inspects `instructions`. When it already opens with its own front-matter block — the exact result of copying a downloaded `SKILL.md` — the file gets two blocks. `buildSkillManifestFromFrontmatter` (same file, `:121-130`) has the identical shape, so edit mode is affected too; both are reached through `buildSkillManifestForSubmit` (`:213-226`), called from `handleSubmitCreate` and `handleSubmitEdit` in `libs/chat-hooks/src/skill/useSkillEditorSubmit.ts`.

Downstream the BFF is a pass-through: `SkillsPackageService.validateAndBuildFormData` (`apps/chat-api/src/skills/package/skills-package.service.ts:59`) checks only that `skillManifest` is non-empty, then forwards it. DIAL Core stores what it receives. The strict parser `parseSkillManifestFrontmatter` (`apps/chat-api/src/skills/utils/skill-manifest-frontmatter.util.ts`) only runs on the archive-import path and, by design, reads the first block and treats the rest as body — it would accept the corrupt file. So the only place that can catch this with useful, field-anchored feedback is the client.

The symmetric import path already does the right thing: `useSkillEditorLoad` and the drop/upload-dialog import call `parseSkillManifest` (`libs/chat-hooks/src/skill/skill.ts:149`), which splits frontmatter from body, stores the frontmatter object in `frontmatterRef`, and seeds `instructions` with the body alone. The gap is exactly the typed/pasted path.

Constraints that shape the design:

- `libs/skill-editor` owns field state internally (`SkillEditor.tsx:105`) and exposes no per-change callback — only `onDirtyChange` (a boolean) and `onSubmit` (at submit time).
- The `skill-editor-library` spec forbids the library from importing `yaml` or serializing anything, and requires every user-facing string to arrive through `labels`/`errors`.
- The `@epam/ai-dial-ui-kit` `MarkdownEditor` exposes `value`/`onChange` and **no** `onBlur` (`node_modules/@epam/ai-dial-ui-kit/dist/src/components/New/MarkdownEditor/MarkdownEditor.d.ts`).

## Goals / Non-Goals

**Goals:**

- A pasted front-matter block is refused with a message anchored under the Instructions field, visible before the user presses Create/Save.
- The stored `SKILL.md` can never contain two front-matter blocks via the editor.
- Create and edit mode share one detector and one message.
- The library boundary holds: no YAML, no i18n, no format knowledge added to `libs/skill-editor`.

**Non-Goals:**

- Lifting the block's fields into the form or into the submitted frontmatter. Explicitly rejected — the user chose refusal over silent promotion.
- Rewriting or stripping the user's text.
- Repairing already-stored skills that carry a double block. They surface the error when opened for editing; no migration job.
- A BFF-side guard. Worth considering as defence in depth, but a submit-time `400` cannot anchor to a field, and adding it now would duplicate the rule in two places before the client rule has settled.
- Any backend, OpenAPI, or DIAL Core change.

## Decisions

### D1 — Refuse, do not lift

The issue offered two remedies; the product decision is refusal. Refusal keeps the rule explainable ("front matter belongs in the fields above") and avoids the unanswerable question of whose `name` wins when the form and the pasted block disagree. Under refusal that question does not arise: **the form is always authoritative and is never overwritten**, and no field of the pasted block — including `display_name` — reaches the submitted frontmatter.

Consequence worth stating plainly: a user copying another skill loses that skill's `display_name` unless they re-import the file through the upload dialog, which does preserve it. The error message should therefore be actionable, not just prohibitive.

_Alternatives:_ lift into form (rejected — silent mutation, ambiguous precedence); silent strip (rejected — destroys content with no trace).

### D2 — Structural detection, not YAML parsing

The detector answers one question: *would appending this text after a fence produce a second front-matter block?* That is true when the first non-blank line is a bare `---` **and** some later line is a bare `---`. Whether the fenced content parses as YAML is irrelevant — an unparseable block corrupts the file identically, and the Catalog Details setext-heading artefact does not depend on valid YAML either.

This also keeps the detector cheap enough to run on every keystroke with no debounce, and lets it live next to `FRONTMATTER_PATTERN` in `libs/chat-hooks/src/skill/skill.ts` reusing the same fence notion.

Two cases deliberately pass:

- **Unclosed leading fence** (`---` with no later `---`) — produces no second block, so nothing to refuse. This matches how `parseSkillManifest`'s `FRONTMATTER_PATTERN` already requires a closing fence.
- **`---` elsewhere in the body** — a Markdown horizontal rule or a setext underline, both legitimate.

_Alternative:_ reuse `parseSkillManifest` and check whether it throws. Rejected — it throws on *absence* of frontmatter, the opposite of what is needed here, and it parses YAML (so an unparseable block would slip through).

### D3 — Detection point: a new `onValuesChange` prop on the library

The user asked for feedback at paste time. The kit's `MarkdownEditor` has no `onBlur`, so the available signal is `onChange`, which fires when pasted text lands — behaviourally what was asked for. Formally, the requirement is "as the value changes", and a paste is one such change.

The library must not do the detecting (no `yaml`, no format knowledge), and it holds the value internally, so it needs to report values outward. Adding `onValuesChange?: (values: SkillEditorValues) => void` is the narrowest addition that serves this: it carries opaque strings out, and the already-existing `errors.instructions` prop carries the resolved message back in. This is the same host-validates/library-renders split the spec already mandates for `errors.name`.

It must not fire during seeding. `SkillEditor` re-seeds from `initialValues` in an effect (`SkillEditor.tsx:116`); firing there would flag an already-corrupt loaded skill the instant it opens, before the user touched anything — arguably desirable, but it would also fire on every host re-seed and muddle the "user edit" contract. Instead the effect path stays silent and the *submit* guard (D4) catches the loaded-corrupt case. The `skill-editing` spec's "already-corrupt skill surfaces the error on edit" scenario is satisfied by the submit guard plus the first keystroke.

_Alternatives:_ a narrower `onInstructionsChange` (rejected — a second one-off callback when a general values callback is the natural sibling of `onDirtyChange`, and hosts will want the same hook for other fields); detecting inside the library with a host-supplied message via `labels` (rejected — it is format policy, and the spec's "treat as opaque strings" line would have to be amended); a kit change to add `onBlur` to `MarkdownEditor` (rejected — external package, out of scope, and `onChange` already covers paste).

### D4 — Two enforcement points, one rule

- **Live**, from `onValuesChange`, for the visible error.
- **At submit**, inside `useSkillEditorSubmit.handleSubmit`, alongside the existing required-field checks.

The submit guard is not redundant: it covers a value that never passed through the change callback (a host that omits the prop, a loaded skill that is already corrupt and gets saved without an Instructions edit) and makes "a two-block manifest cannot be produced" a property of the submit path rather than of a UI wiring detail. Both call the same exported detector.

Precedence: the existing required-field check runs first and wins, so the field renders at most one message. Practically unreachable — an empty value cannot open with a fence — but stated so the ordering is not left to chance.

### D5 — Ownership and placement

- Detector: a pure exported function in `libs/chat-hooks/src/skill/skill.ts`, next to `parseSkillManifest`. Exported from the package barrel so both modes and the tests reach the same implementation.
- Error state: `useSkillEditorSubmit`'s existing `errors` state, which already owns `errors.instructions`. It gains the live check and a way to clear it — no new hook, no new context. The hook's `messages` object gains one field, resolved by the host, matching how every other message reaches it.
- Message text: `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` resolves `skillEditor.error.instructionsFrontmatter` via `useTranslation` and passes it down, consistent with the `skillEditor.error.*` namespace already in `apps/chat/src/constants/translation-keys.ts:998-1004`.

Library isolation: nothing host-owned crosses into `libs/skill-editor` — it emits opaque strings and renders a resolved string. `libs/chat-hooks` gains no new external knowledge; the SKILL.md format is already its domain (`parseSkillManifest`, `buildSkillManifest` both live there).

### D6 — Presentation and a11y

The message renders through the existing `ErrorText` slot under the Instructions editor (`SkillEditor.tsx:538-540`) — the same slot the required-field message already uses — so it inherits the field's existing invalid presentation, its direction from the ambient `dir`, and needs no new markup. No new loading or empty state: this is a validation message on an existing field.

Live-region behaviour: the message appears without a user-initiated submit, so it should be announced. The existing slot's semantics are checked during implementation; if `ErrorText` is not already announced, the fix is an `aria-live="polite"` wrapper in the library around that slot, not a `role="alert"` (which is for the submit-error region and would be too assertive for a message that can appear mid-typing).

No memoisation concerns beyond the ordinary: the detector is pure and O(lines-until-second-fence); `onValuesChange` must be a stable `useCallback` in the host so the library's change handler does not re-subscribe, and the library must not put it in a dependency array that would re-run seeding.

### D7 — i18n

One new key, `skillEditor.error.instructionsFrontmatter`, in `apps/chat/src/i18n/locales/en.json` (the only locale file present) and in the `SkillEditorTranslationKeys` enum. Wording must say where front matter belongs, not just that it is rejected — e.g. naming the Name and Description fields above. RTL: none specific; the message inherits direction from `<html dir>` through the existing error slot and contains no directional iconography.

## Risks / Trade-offs

- **A user legitimately wants a literal `---`-fenced block at the top of their instructions** (e.g. documenting front-matter syntax) → They can start the body with any non-blank line first, or indent the fence. Narrow enough that a general escape hatch is not worth the complexity; if it ever bites, the message can gain that hint.
- **`display_name` and other original fields are lost on copy-paste** → Inherent to D1 and accepted by the product decision. Mitigated by the message pointing at the working alternative (import the `SKILL.md` through the upload dialog, which preserves them). Worth a follow-up if support traffic says otherwise.
- **The live check runs on every Instructions keystroke** → The detector scans until it finds a second bare `---` and stops; on a body with no leading fence it exits after the first non-blank line. No debounce needed. Guard against accidental O(n) YAML work being added later by keeping the detector free of `parseYaml`.
- **Error flicker while the user edits a fence in place** → The message can appear and disappear as the user types the closing `---`. Acceptable for an inline field message, and the reason for `aria-live="polite"` rather than `role="alert"` (D6).
- **A new optional library prop widens the public surface** → It is additive and optional; the `skill-editor-library` delta pins the "still no serialization dependency" guarantee as an explicit scenario so the boundary does not erode silently.
- **Already-stored corrupt skills stay corrupt until edited** → Out of scope by decision; the edit path now refuses to re-save them unrepaired, so the population shrinks rather than grows.

## Migration Plan

No data migration, no API change, no feature flag. Ship in one commit; the library and its consumer change together within the monorepo, so there is no version-skew window. Rollback is a revert of that commit — the new prop is optional, so nothing else depends on it.

## Open Questions

- Should the BFF additionally reject a `skillManifest` whose body opens with a second fence, as defence in depth against non-editor callers? Deliberately deferred, not decided against (see Non-Goals).
- Should the error message offer the upload-dialog import as the way to keep `display_name`? Leaning yes; settled when the copy is written, since it affects only the string.
