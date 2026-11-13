---
paths:
  - 'apps/**/*.tsx'
  - 'libs/**/*.tsx'
  - 'apps/chat/src/components/OnboardingHints/**'
  - 'apps/chat-api/src/app-config/types/onboarding-hint-target.ts'
globs: 'apps/**/*.tsx,libs/**/*.tsx,apps/chat/src/components/OnboardingHints/**,apps/chat-api/src/app-config/types/onboarding-hint-target.ts'
applyTo: 'apps/**/*.tsx,libs/**/*.tsx,apps/chat/src/components/OnboardingHints/**,apps/chat-api/src/app-config/types/onboarding-hint-target.ts'
alwaysApply: false
---

# Onboarding anchors

An operator points an `ONBOARDING_HINTS` entry at a UI element through its
`target`, one name from a closed list of **anchors**. Every main surface of the
app carries anchors on the controls a new user should learn about, and the
list is kept complete: a new page or main action gets its anchors in the same
change that adds it.

## Where an anchor lives

One anchor is four things, and all four change together:

| Part                                        | File                                                               |
| ------------------------------------------- | ------------------------------------------------------------------ |
| The accepted value (closed list)            | `apps/chat-api/src/app-config/types/onboarding-hint-target.ts`     |
| The resolver that finds the element         | `apps/chat/src/components/OnboardingHints/onboarding-targets.ts`   |
| The catalog row (page, element, lookup)     | `apps/chat/src/components/OnboardingHints/onboarding-anchors.json` |
| The operator-facing page, generated from it | `docs/onboarding-anchors.md`                                       |

What catches a missing part:

- a target in the enum with no resolver — the build, because `ANCHOR_RESOLVERS`
  is a `Record<OnboardingHintTarget, …>`;
- a target with no catalog row, or a row with no target —
  `apps/chat/src/components/OnboardingHints/tests/onboarding-anchors.spec.ts`;
- a stale operator page — `npm run validate:docs`.

## Adding an anchor

1. Add the member to `OnboardingHintTarget` in chat-api with a JSDoc that names
   the element, then `npm run openapi` and `npm run openapi:check`.
2. Add its resolver to `ANCHOR_RESOLVERS`. Find the element the way assistive
   technology sees it — a role or landmark plus its accessible name — inside the
   narrowest scope that makes it unique: the navigation landmark,
   `#main-content`, a named `section`. Take the accessible name from the same
   translation key the control renders with, through `OnboardingTargetLabels`,
   so the lookup works in every language.
3. Add its row to `onboarding-anchors.json` and run
   `npm run docs:onboarding-anchors`.
4. Cover the resolver in `onboarding-targets.spec.tsx`: it finds the element,
   and it returns `null` when the element is hidden or in an `inert` subtree.
5. Check it on the real page with `?onboarding-anchors` in the URL.

```ts
// Correct — role and translated name, scoped to the page that owns the control
[OnboardingHintTarget.CatalogCreate]: (labels) =>
  findControl(catalogRegions(labels), labels.catalogCreate),

// Wrong — a CSS class or DOM path breaks on the next refactor and leaks
// styling into the anchor contract
[OnboardingHintTarget.CatalogCreate]: () =>
  document.querySelector('.catalog-header > button:first-child'),
```

## What an anchor never uses

- **No `data-testid`, `data-onboarding-*` or other marker attribute** in a lib or
  the app. The anchor contract is the accessibility contract the UI already
  exposes; a lib stays unaware of onboarding (`AGENTS.md` "Library isolation").
- **No CSS class, hashed module class or DOM position.** Public `dial-*`
  classes are a styling contract for hosts, not an anchor.
- **No selector from config.** chat-api accepts only enum members, so a typo or
  hostile value can never reach `querySelector`.
- **No English literal.** A name compared as `'Create'` fails in every other
  locale; compare against the translated label.

## Changing UI that an anchor relies on

The "How the chat finds it" column of `docs/onboarding-anchors.md` lists what
each anchor depends on. When a change renames a control's accessible name or
its translation key, changes its role, moves it to another landmark, or renames
a landmark's `aria-label`, update the resolver, the catalog row and the test in
the **same change** — a broken anchor fails silently in production; the tour
just skips the hint.

Keep anchored controls reachable by name: an icon-only button needs an
`aria-label` (it needs one anyway — `.claude/rules/a11y.md`), and a region an
anchor scopes to needs a stable accessible name from a `*Labels` prop.

## Not every control is an anchor

Anchor what a first-time user should be shown: a page's primary action, its
search, its main navigation, a control whose purpose is not obvious. Skip
controls that repeat per row (each conversation's menu), controls that exist
only inside an open menu or dialog, and destructive actions.
