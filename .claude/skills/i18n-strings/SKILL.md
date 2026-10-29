---
name: i18n-strings
description: Audit and fix untranslated user-visible text — titles, headings, button and menu labels, aria-label/title/placeholder/alt, empty states, errors, tooltips. In libs/* every string comes from a `*Labels` prop with an English default and the lib never imports i18n; in apps/chat every string is `t()` with a key from `translation-keys.ts`, and every lib `*Labels` field the app renders is filled with `t()`. Finds JSX text and literal text attributes in libs and the app, raw `t('…')` keys, i18n imports in libs, and lib label fields the app never passes. Use to check all libs and the app, one lib, or the current branch.
---

# i18n strings

Every string a user reads or hears is translated. Libs never translate; they
expose the text as props with English defaults, and the app fills every one of
them through `t()`.

## The rule

**In `libs/*`:**

- Every user-visible string — JSX text, a heading or title, `aria-label`,
  `title`, `placeholder`, `alt`, a tooltip, an empty state, an error or a
  notification — comes from a `labels` prop (`*Labels`, or a `*Texts` /
  `*AriaLabels` group) with an English default:

  ```tsx
  export interface ShareDialogLabels {
    /** Dialog title. Defaults to `'Share'`. */
    title?: string;
    /** Accessible name of the close button. Defaults to `'Close'`. */
    closeAriaLabel?: string;
  }

  <h2 className={titleClassName}>{labels?.title ?? 'Share'}</h2>
  <IconButton aria-label={labels?.closeAriaLabel ?? 'Close'} />
  ```

- A string with values in it is a formatter (`(count: number) => string`) or a
  template with named placeholders the lib fills (`'Version {version}'`) — never
  English assembled from fragments, because word order differs by language.
- The lib never imports `react-i18next` / `i18next` and never reads the
  language (`.claude/rules/libs.md` "No i18n inside libs").
- Every label field is forwarded to the component that renders it
  (`libs.md` "Every declared prop must be read").

**In `apps/chat`:**

- Every string is `t(SomeI18nKeys.Member)`: the key is declared in a string
  enum in `apps/chat/src/constants/translation-keys.ts` and in
  `apps/chat/src/i18n/locales/en.json` in the same change — never a raw
  `t('a.b')` key and never a literal (`.claude/rules/all-ts.md`).
- Every `*Labels` field of a lib component the app renders is passed, built
  with `t()` — usually in a `build*Labels(t)` helper or a `useMemo` next to the
  render. A field the app leaves out shows the lib's English default to every
  user, whatever their language.
- Reuse a generic key (`ButtonsI18nKeys.Cancel`, `.Save`, `.Copy`) before
  adding a feature-scoped duplicate (`all-ts.md` "Avoid duplicate translation
  values").

## Inputs

| Mode        | Command                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| Everything  | `node .claude/skills/i18n-strings/scan.mjs` — all libs and `apps/chat`, the default          |
| Some scopes | `node .claude/skills/i18n-strings/scan.mjs catalog chat` (`chat` means `apps/chat`)          |
| This branch | `node .claude/skills/i18n-strings/scan.mjs --base origin/development` (branch + uncommitted) |
| Machine     | add `--json`                                                                                 |

The scanner skips tests, stories and `chat-api-client`.

## Signals

| Signal                 | Means                                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsx-literal-text`     | prose written straight into JSX: `>Save<`, `{'Save'}`, or a line of text between JSX lines                                                                                                                                   |
| `literal-text-attr`    | a text prop or attribute (`title`, `aria-label`, `placeholder`, `alt`, `label`, `tooltip`, `description`, `message`, `heading`, …) set to a literal string; a template built only from props (`${labels.x} ${n}`) is skipped |
| `raw-translation-key`  | `apps/chat` calls `t('…')` with a string instead of an enum member                                                                                                                                                           |
| `literal-text-field`   | `apps/chat` sets a text field of an object (`message`, `title`, `label`, `*Label`, `*Message`, …) to an English literal — a label map, an error or a notification built without `t()`                                        |
| `i18n-in-lib`          | a lib imports `react-i18next` or `i18next`                                                                                                                                                                                   |
| `label-not-translated` | a text field (`string` or `=> string`) of a lib `*Labels` / `*Texts` / `*AriaLabels` interface whose name appears nowhere in `apps/chat/src`, for a lib the app imports — the user always sees the English default           |

## Workflow

1. **Scan.** Run the scanner in the requested mode. With no scope given, scan
   everything and report the per-scope totals first.

2. **Verify each hit in context.** A hit is a candidate. Drop it when:
   - the text is not user-visible: a test id, a log line, a URL, a CSS value,
     a key, code shown as code.
   - it is a brand or product name that is never translated (`DIAL`,
     `OpenAI`) — say so in the report.
   - a `label-not-translated` field is filled under another name (the app
     spreads a helper whose keys are built dynamically, or a parent lib fills
     it from its own label). Search the app for the interface name and the
     component before reporting it.
   - a `label-not-translated` field belongs to a component the app does not
     render at all.

3. **Report.** Group by scope, then file: `path:line`, the text, and the fix —
   which `*Labels` field it becomes in the lib, or which enum key and
   `en.json` entry it becomes in the app.

4. **Fix (only when asked).**

   In a lib:
   1. Add the field to the component's `*Labels` interface with an inline
      JSDoc quoting the English default verbatim.
   2. Render `labels?.field ?? 'English default'` (or destructure with a
      default) and thread the field through every intermediate layer.
   3. Export a new `*Labels` type from `src/index.ts` and list the field in the
      lib README.

   In `apps/chat`:
   1. Add an enum member to the right enum in
      `apps/chat/src/constants/translation-keys.ts` (reuse a `ButtonsI18nKeys`
      member when the English string already exists — grep `en.json` first).
   2. Add the key to `apps/chat/src/i18n/locales/en.json` with the English
      text, matching the lib default.
   3. Pass it where the app renders the lib component, through the existing
      `build*Labels(t)` helper or `useMemo` for that component when there is
      one.

5. **Verify.** Rerun the scanner on the touched scopes (expect the fixed hits
   gone), then `npm exec nx run-many -- -t typecheck lint -p <@epam/pkg ...> @epam/chat`
   and `npm run validate:docs`. Nx project names are the package names.
