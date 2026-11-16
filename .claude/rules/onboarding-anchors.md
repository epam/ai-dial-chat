---
paths:
  - 'apps/chat/src/components/OnboardingHints/**'
  - 'libs/onboarding-tour/**'
  - 'apps/chat-api/src/app-config/types/onboarding-hint-target.ts'
  - 'apps/chat-api/src/app-config/onboarding-hints.normalizer.ts'
globs: 'apps/chat/src/components/OnboardingHints/**,libs/onboarding-tour/**,apps/chat-api/src/app-config/types/onboarding-hint-target.ts,apps/chat-api/src/app-config/onboarding-hints.normalizer.ts'
applyTo: 'apps/chat/src/components/OnboardingHints/**,libs/onboarding-tour/**,apps/chat-api/src/app-config/types/onboarding-hint-target.ts,apps/chat-api/src/app-config/onboarding-hints.normalizer.ts'
alwaysApply: false
---

# Onboarding anchors

An operator points an `ONBOARDING_HINTS` entry at a UI element through its
`target`, one name from a closed list of **anchors**. This rule applies to
work on the onboarding files themselves. The anchor contract is still a
prototype: until an OpenSpec change accepts it, unrelated UI changes are not
required to add or update anchors.

## Where an anchor lives

One anchor is five things, and all five change together:

| Part                                        | File                                                               |
| ------------------------------------------- | ------------------------------------------------------------------ |
| The accepted value (closed list)            | `apps/chat-api/src/app-config/types/onboarding-hint-target.ts`     |
| The resolver that finds the element         | `apps/chat/src/components/OnboardingHints/onboarding-targets.ts`   |
| The translated names it matches             | `apps/chat/src/components/OnboardingHints/OnboardingHints.tsx`     |
| The catalog row (page, element, lookup)     | `apps/chat/src/components/OnboardingHints/onboarding-anchors.json` |
| The operator-facing page, generated from it | `docs/onboarding-anchors.md`                                       |

What catches a missing part:

- a target in the enum with no resolver — the build, because `buildResolvers`
  returns a `Record<OnboardingHintTarget, …>`;
- a target with no catalog row, or a row with no target —
  `apps/chat/src/components/OnboardingHints/tests/onboarding-anchors.spec.ts`;
- a stale operator page — `npm run validate:docs`.

## Adding an anchor

1. Add the member to `OnboardingHintTarget` in chat-api with a JSDoc that names
   the element, then `npm run openapi` and `npm run openapi:check`.
2. Add its resolver to `buildResolvers`. Find the element the way assistive
   technology sees it — a role or landmark plus its accessible name — inside the
   narrowest scope that makes it unique: the navigation landmark,
   the host's main landmark (`mainContent()`, the id the host passes), a named
   `section`. Take the accessible name from the same
   translation key the control renders with, through `OnboardingTargetLabels`
   (filled with `t()` in `apps/chat/src/components/OnboardingHints/OnboardingHints.tsx`),
   so the lookup works in every language.
3. Add its row to `onboarding-anchors.json` and run
   `npm run docs:onboarding-anchors`.
4. Cover the resolver in
   `apps/chat/src/components/OnboardingHints/tests/onboarding-targets.spec.tsx`: it finds the element,
   and it returns `null` when the element is hidden or in an `inert` subtree.
5. Check it on the real page with `?onboarding-anchors` in the URL. The view
   stays on while you follow links in that tab, until its panel is closed.

The tour itself — which hints to show, the start delay, seen ids, the anchor
map — is `OnboardingHints` from `@epam/ai-dial-onboarding-tour`; a host
passes it its own `resolveOnboardingTarget` and `getOnboardingAnchorTargets()`.
The resolvers know this app's shell and feature-lib markup, so they stay in
the app (`AGENTS.md` "Library isolation"); a second host writes its own.

```ts
// Correct — role and translated name, scoped to the page that owns the control
[OnboardingHintTarget.CatalogCreate]: (labels) =>
  findControl(catalogRegions(labels), labels.catalogCreate),

// Wrong — a CSS class or DOM path breaks on the next refactor and leaks
// styling into the anchor contract
[OnboardingHintTarget.CatalogCreate]: () =>
  document.querySelector('.catalog-header > button:first-child'),
```

## Resolver patterns

The helpers in `apps/chat/src/components/OnboardingHints/aria-lookup.ts` and the matchers
in `onboarding-targets.ts` cover the
cases new UI keeps producing; reach for them before writing a new lookup.

| The control's name…                                    | Resolve it with                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| is unique on its page                                  | `findControl(scope, label)` / `firstNamed(scope, selector, label)`                                           |
| is common (`Create`, `Save`, `Edit`)                   | `findControlNear(elementOnlyThisPageRenders, isOneOf(label))` — never a bare `findControl(mainContent(), …)` |
| changes with state (`Pin`/`Unpin`, `Log in`/`Log out`) | `isOneOf(...)` with every state's label                                                                      |
| carries a value (`Back to {{name}}`, `Tools: {{n}}…`)  | `startsWithNonEmpty(prefix)`; the app computes the prefix from the same key with a marker value              |
| comes from `<label for>` (Select, Switch, inputs)      | `firstNamed(scope, '[role="combobox"]' \| '[role="switch"]', label)` — `accessibleName` reads the label      |

## Making UI anchorable

When a change adds an anchor for new UI, that UI has to be findable:

- **Name every region an anchor could scope to.** A `<section>` gets
  `aria-labelledby` pointing at its heading, a group or toolbar an
  `aria-label`, a panel or dialog an accessible name — all from a `*Labels`
  prop. An unnamed `<section>` is not a region and cannot be found.
- **Fill every lib label the app renders with `t()`.** A control that keeps
  its lib's English default (`'Item details'`, `'Share'`, `'From'`) resolves
  only in English. Check the lib's `*Labels` / `*Texts` against what the
  app passes (`i18n-strings` skill).
- **Name form controls.** Use `<label for>` or the kit control's `label` /
  `aria-label`; a field named only by its placeholder cannot be found.
- **Keep a stable name and put the value elsewhere** when you can: a fixed
  `aria-label` with the count in `aria-describedby` beats a name that embeds
  the count. When the design needs the value in the name, start the translation
  with the fixed part so a prefix match works.
- **Add the anchor, its catalog row, its labels and its resolver test**
  together, and look at it with `?onboarding-anchors`.

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
search, its main navigation, a panel or section a hint can explain, a control
whose purpose is not obvious. Skip
controls that repeat per row (each conversation's menu), controls that exist
only inside an open menu or dialog, and destructive actions.
