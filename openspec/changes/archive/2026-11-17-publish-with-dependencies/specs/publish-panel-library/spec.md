# Spec Delta

## MODIFIED Requirements

### Requirement: PublishPanel lists private dependencies in a read-only section

`PublishPanel` (`libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx`) SHALL accept an optional `dependencies?: PublishDependency[]` prop, and, in the way `accessRulesLabels` and `styles.accessRules` already work, an optional `dependenciesLabels?: PublishDependenciesLabels` field inside `PublishPanelLabels` and an optional `dependencies?: PublishDependenciesStyles` field inside `PublishPanelStyles`. `StandalonePublishPanel` SHALL forward the new `dependencies` prop unchanged, without inspecting it; its existing `labels` and `styles` already reach `PublishPanel`, so no other new prop is added to it, to `libs/catalog` or to a host.

`PublishDependency` is `{ id: string; name: string; version?: string; type: PublishDependencyType; location: string; iconUrl?: string; isFolder?: boolean }`, where `PublishDependencyType` is a string enum with the members `Application`, `Toolset`, `Prompt`, `Skill` and `File`. Both are exported from `libs/publish-panel/src/index.ts`.

When `dependencies` is absent or empty the section SHALL NOT render and SHALL leave no gap, so a host that supplies nothing renders exactly today's panel. When it is non-empty, the section SHALL render in the Main view as its last section, below the destination folder, author and access-rules block, as:

- a heading from `dependenciesLabels.title`;
- the description `dependenciesLabels.description`, presented according to `dependenciesLabels.appearance`, a member of the exported string enum `PublishDependenciesAppearance` (`Warning`, `Published`). When the host passes nothing the appearance SHALL be `Warning` and the title, description and announcement defaults SHALL be today's, so a host that supplies nothing renders exactly today's section;
- in the `Warning` appearance the description is a warning `Notification` (ui-kit 2.0 `NotificationType.SectionMessage`) and each row is an icon, then the name with `version` appended when present, and a second line with the type label and the location, which is omitted together with its separator when `location` is empty;
- in the `Published` appearance the description is a plain muted caption directly under the heading, with no notification and no warning, and each row is a 40px icon with 12px rounded corners, 12px before the text, the type label above the name (the type label upper-cased and in the accent color), the `version` appended to the name when present, the `location` after the type label when not empty, and a thin divider between rows.

The section is informational: rows SHALL NOT be interactive, selectable or removable, and the section SHALL NOT change the submit button's enabled state or the callout derivation.

The library SHALL NOT know why a host picks an appearance. A host that publishes the listed dependencies together with the item passes `Published` with text saying so; a host that only warns passes nothing. Every color of the `Published` appearance (`captionText`, `typeText`, `divider`) SHALL come from `PublishDependenciesColors` as a `--pp-dependencies-*` CSS variable with a token fallback, and its typography from `captionClassName` and `typeClassName` props defaulted to kit classes.

Accessibility: the section SHALL be a landmark-free `section` named by its heading (`aria-labelledby`), the rows SHALL be `<li>` items of a `<ul>`, and when the section first appears or its count changes the panel SHALL announce `dependenciesLabels.getAnnouncement(count)` through the ui-kit `LiveRegion`, mounted before the text it announces.

RTL: all spacing and alignment SHALL use logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`). The icon is decorative (the name always stands beside it) and is chosen by the entity, never invented per kind: an application, toolset, prompt or skill shows `DeploymentIcon` from `@epam/ai-dial-chat-shared` (the host-resolved `iconUrl`, else the initials of the name, as the panel's own header does), and a `File` shows the UI kit's `FileIcon`, whose glyph is picked from the extension in `name`, or the folder glyph when `isFolder` is `true`.

Memoisation: none required; the host keeps the `dependencies` array identity stable between renders (the `usePublishDependencies` hook returns a module-level empty array).

The app host's strings for the **application** panel SHALL be new i18n keys (`publish.dependenciesPublishedTitle` whose English text is `Dependencies`, `publish.dependenciesPublishedDescription` with the `{{entity}}` placeholder, `publish.dependenciesPublishedAnnouncement_one` and `publish.dependenciesPublishedAnnouncement_other`) added to `apps/chat/src/i18n/locales/en.json`; the existing `publish.dependenciesTitle`, `publish.dependenciesDescription` and announcement keys SHALL stay unchanged and keep serving the conversation and project panels.

#### Scenario: Private dependencies are shown
- **WHEN** `PublishPanel` renders with `dependencies` holding one prompt and one toolset and no `dependenciesLabels`
- **THEN** the panel shows today's title, a warning, and two rows, each with its type label, name and location

#### Scenario: Host publishes the dependencies with the item
- **WHEN** a host passes `dependenciesLabels` with `title: 'Dependencies'`, text saying the artifacts are published with the item and `appearance: PublishDependenciesAppearance.Published`
- **THEN** the section shows that title and text as a plain caption, with no notification and no warning, and each row shows the type label above the name

#### Scenario: Default appearance is a warning
- **WHEN** `dependenciesLabels.appearance` is omitted
- **THEN** the description is a warning notification and the rows keep their compact layout

#### Scenario: No dependencies renders today's panel
- **WHEN** `PublishPanel` renders with `dependencies` omitted or `[]`
- **THEN** no dependencies heading, notification or list is present

#### Scenario: Versioned dependency shows its version
- **WHEN** a dependency has `version: '1.0.0'` and `name: 'Search'`
- **THEN** its row shows `Search` with `1.0.0`

#### Scenario: Root-level dependency shows no location
- **WHEN** a dependency's `location` is `''`
- **THEN** its second line shows only the type label, with no separator

#### Scenario: Section does not affect submit
- **WHEN** the panel has a valid destination and non-empty dependencies
- **THEN** the submit button is enabled exactly as it would be without the section

#### Scenario: Appearance is announced
- **WHEN** dependencies arrive after the panel has opened
- **THEN** the live region announces the count

#### Scenario: Conversation and project panels are unchanged
- **WHEN** the conversation or project publish panel renders with dependencies
- **THEN** it shows the same title, warning and announcement as before this change
