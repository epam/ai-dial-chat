# Spec Delta

## ADDED Requirements

### Requirement: PublishPanel lists private dependencies in a read-only section

`PublishPanel` (`libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx`) SHALL accept an optional `dependencies?: PublishDependency[]` prop, and, in the way `accessRulesLabels` and `styles.accessRules` already work, an optional `dependenciesLabels?: PublishDependenciesLabels` field inside `PublishPanelLabels` and an optional `dependencies?: PublishDependenciesStyles` field inside `PublishPanelStyles`. `StandalonePublishPanel` SHALL forward the new `dependencies` prop unchanged, without inspecting it; its existing `labels` and `styles` already reach `PublishPanel`, so no other new prop is added to it, to `libs/catalog` or to a host.

`PublishDependency` is `{ id: string; name: string; version?: string; type: PublishDependencyType; location: string; iconUrl?: string; isFolder?: boolean }`, where `PublishDependencyType` is a string enum with the members `Application`, `Toolset`, `Prompt`, `Skill` and `File`. Both are exported from `libs/publish-panel/src/index.ts`.

When `dependencies` is absent or empty the section SHALL NOT render and SHALL leave no gap, so a host that supplies nothing renders exactly today's panel. When it is non-empty, the section SHALL render in the Main view as its last section, below the destination folder, author and access-rules block, as:

- a heading from `dependenciesLabels.title`;
- a warning `Notification` (ui-kit 2.0 `NotificationType.SectionMessage`, `NotificationVariant.Warning`) whose message is `dependenciesLabels.description`;
- a list with one row per dependency starting with an icon, then the name with `version` appended when present, and a second line with the type label and the location (`dependenciesLabels.rootLocation` when `location` is empty).

The section is informational: rows SHALL NOT be interactive, selectable or removable, and the section SHALL NOT change the submit button's enabled state or the callout derivation.

Accessibility: the section SHALL be a landmark-free `section` named by its heading (`aria-labelledby`), the rows SHALL be `<li>` items of a `<ul>`, and when the section first appears or its count changes the panel SHALL announce `dependenciesLabels.getAnnouncement(count)` through the ui-kit `LiveRegion`, mounted before the text it announces.

RTL: all spacing and alignment SHALL use logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`). The icon is decorative (the name always stands beside it) and is chosen by the entity, never invented per kind: an application, toolset, prompt or skill shows `DeploymentIcon` from `@epam/ai-dial-chat-shared` (the host-resolved `iconUrl`, else the initials of the name, as the panel's own header does), and a `File` shows the UI kit's `FileIcon`, whose glyph is picked from the extension in `name`, or the folder glyph when `isFolder` is `true`.

Memoisation: none required; the host keeps the `dependencies` array identity stable between renders (the `usePublishDependencies` hook returns a module-level empty array).

#### Scenario: Private dependencies are shown
- **WHEN** `PublishPanel` renders with `dependencies` holding one prompt and one toolset
- **THEN** the panel shows the title, the warning, and two rows, each with its type label, name and location

#### Scenario: No dependencies renders today's panel
- **WHEN** `PublishPanel` renders with `dependencies` omitted or `[]`
- **THEN** no dependencies heading, notification or list is present

#### Scenario: Versioned dependency shows its version
- **WHEN** a dependency has `version: '1.0.0'` and `name: 'Search'`
- **THEN** its row shows `Search` with `1.0.0`

#### Scenario: Root-level dependency uses the root label
- **WHEN** a dependency's `location` is `''`
- **THEN** its row shows `dependenciesLabels.rootLocation`

#### Scenario: Section does not affect submit
- **WHEN** the panel has a valid destination and non-empty dependencies
- **THEN** the submit button is enabled exactly as it would be without the section

#### Scenario: Appearance is announced
- **WHEN** dependencies arrive after the panel has opened
- **THEN** the live region announces the count

### Requirement: The dependencies section is themeable and carries only host-supplied text and data

Every user-visible string of the section SHALL come from `PublishDependenciesLabels` (`title`, `description`, `rootLocation`, `typeLabels` keyed by `PublishDependencyType`, and `getAnnouncement: (count: number) => string`, the function form the repo's libs use for count-dependent text) with English defaults. Every colour SHALL come from `PublishDependenciesColors` as `var(--pp-dependencies-*, fallback)` in the component's `.module.scss`, set through `buildCssVars`, and every `dial-*-text` class SHALL come from `*ClassName` props whose defaults are kit classes. The library SHALL NOT import `react-i18next`, a generated client, a server-api module, an app context, or build an endpoint path; it receives the list as data.

`PUBLISH_PANEL_CLASS` SHALL gain stable public class names for the section, its list and its rows, and `libs/publish-panel/README.md` SHALL document the new exports, props, labels, colours and class-name table (`npm run validate:docs` checks both directions).

#### Scenario: Host supplies labels
- **WHEN** a host passes `labels.dependenciesLabels` with translated text
- **THEN** the section renders that text and none of the English defaults

#### Scenario: Library stays host-agnostic
- **WHEN** `libs/publish-panel/src/**` is searched for `react-i18next`, `@epam/ai-dial-chat-api-client`, `server-api` and `/api/`
- **THEN** no such reference is found

#### Scenario: README and class names agree
- **WHEN** `npm run validate:docs` runs after the change
- **THEN** it passes, with the new public class names present in the README table
