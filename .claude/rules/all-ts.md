---
paths:
  - '**/*.ts'
  - '**/*.tsx'
globs: '**/*.ts,**/*.tsx'
applyTo: '**/*.ts,**/*.tsx'
alwaysApply: false
---

# TypeScript conventions

- **Never** write ternary-in-ternary (nested conditional expressions). Use `if`/`else` blocks, early returns, or a `switch` statement instead.
- Prefer `async`/`await` with `try`/`catch`/`finally` over Promise chains with `.then()`/`.catch()`; use async dynamic imports for `React.lazy` wrappers too.
- Prefer arrow-function constants over `function` declarations for local helpers and exported functions.

```ts
// Correct
const formatDate = (date: Date): string => { ... };

// Wrong
function formatDate(date: Date): string { ... }
```

- Use the `void` operator before Promise-returning calls only for intentional fire-and-forget work where errors are handled internally. Do not add it as a routine prefix for local async helpers.
- Prefer `value == null` over `value === null || value === undefined`, and `value != null` over `value !== null && value !== undefined`, unless you must distinguish `null` from `undefined` explicitly.

## File naming

**Components and hooks** use PascalCase for both the folder and the file name, matching the exported symbol:

```
AttachmentCard/AttachmentCard.tsx   ✓
useAttachmentCard/useAttachmentCard.ts   ✓
attachmentCard.tsx   ✗
AttachmentCard/index.tsx   ✗
```

**All other files** — utils, models, types, constants, services — use kebab-case:

```
utils/attachment.ts   ✓
models/attachment-error.ts   ✓
types/conversation.ts   ✓
constants/keyboard-shortcuts.ts   ✓
```

Do not use a `.utils`, `.types`, `.models`, or `.constants` suffix in file names.

**Exception — `apps/chat-api`:** NestJS files follow the NestJS convention and use role suffixes: `applications.service.ts`, `applications.module.ts`, `applications.controller.ts`, `applications.guard.ts`, etc.

**Avoid too-specific file names.** Group related helpers/types/constants into a single file named after the domain concept, not after a single exported symbol:

```
utils/attachment.ts   ✓   (contains generateAttachmentId, validateAttachment, …)
utils/generate-attachment-id.ts   ✗   (too narrow — one function per file)

models/conversation.ts   ✓
models/conversation-title.ts   ✗
```

## Component folder structure

Component folders under `src/components/` must use PascalCase and match the component name (e.g., `RequireAuth/RequireAuth.tsx`). Tests go in a `tests/` subfolder inside the component folder.

Don't write utility functions in the same file as a component. If a helper function is needed, place it in the utils folder of corresponding lib or app. Prefer a general utils file over a narrow one (e.g., `apps/chat/src/utils/formatting.ts` rather than `apps/chat/src/utils/format-conversation-timestamp.ts`), and export it from there.

Prefer using enums over union types for sets of related string or numeric constants, especially when they are used in multiple places or have associated logic. Enums provide better readability, maintainability, and type safety compared to unions of literal types. Place enums in a 'types' directory. Follow rules from AGENTS.md for naming enums and their members.

Prefer using `interface` over `type` for defining object shapes, and `type` for unions, intersections, and other complex types. Don't place interfaces in a component file expect for Props and State interfaces that are tightly coupled to that component. Instead, place shared interfaces in a 'models' directory.

A component's props interface must never be an inline anonymous type. Its name is scope-specific: in `apps/*` use `Props` (see `apps.md`); in `libs/*` use `{ComponentName}Props` (see `libs.md`).

## Event handler naming

@.cursor/rules/react-event-handler-naming.mdc

## Boolean naming

Boolean variables, state, and props must begin with a semantically clear prefix: `is`, `has`, `can`, `should`, or `will`.

```text
// Correct
isOpen, isLoading, hasError, canSend, shouldRedirect

// Wrong
open, loading, error as boolean, send, redirect
```

## i18n translation keys

In app TypeScript code, never pass a raw string literal translation key to
`t()`. Every translation key must be declared in the appropriate string enum
in `apps/chat/src/constants/translation-keys.ts` and referenced through that
enum (for example, `t(DialFileManagerI18nKeys.ConflictReplace)`). When adding a
key to a locale JSON file, add the matching enum member in the same change.

### Avoid duplicate translation values

Before adding a new key to `apps/chat/src/i18n/locales/en.json`, check whether
the exact English string already exists under `ButtonsI18nKeys` (or another
shared namespace) in `translation-keys.ts`. Generic, short UI strings —
button/action labels such as "Copy", "Duplicate", "Log out", "Cancel", "Save"
— belong in `ButtonsI18nKeys` and must be reused across features via that one
key, not re-declared per feature (`catalog.details.credentials.logoutLabel`,
`dialFileManager.copyAction`, `share.copyButtonLabel`, etc.). Only give a
string its own feature-scoped key when the wording is, or is expected to
become, genuinely feature-specific (longer sentences, domain-specific nouns,
or text that a translator would phrase differently in context). When in
doubt, grep the value in `en.json` first — if it already exists, reuse that
key instead of adding a duplicate.
