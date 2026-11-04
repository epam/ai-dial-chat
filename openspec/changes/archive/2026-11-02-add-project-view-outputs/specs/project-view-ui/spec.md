## ADDED Requirements

### Requirement: ProjectViewPage owns the project's outputs through useProjectArtifacts

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL own the outputs state through `useProjectArtifacts(projectId)`. That is the app adapter `apps/chat/src/hooks/projects/useProjectArtifacts.ts`, which binds `projectsClient` to the shared hook `useProjectArtifacts(client, projectId)` in `libs/chat-hooks/src/project/use-project-artifacts.ts`. The page owns the state, not the section, so that the project watch can refresh it (see the `project-view-live-updates` capability). No new React context is added: the page is the only consumer.

The shared hook SHALL:

- take `client: Pick<ProjectsApiClient, 'listProjectArtifacts'>`, which must be referentially stable, and `projectId: string | null`;
- return `{ items, isLoading, hasError, retry, refresh }`, where `items` are `ProjectArtifactItemDto[]` in the BFF's newest-first order;
- read once per project id and on `retry`, starting with `isLoading: true`;
  - a `null` id is `{ items: [], isLoading: false, hasError: false }` with no request;
  - a failed read is `hasError: true` with no items;
- treat `refresh()` as a silent re-read:
  - it never sets `isLoading` or `hasError`;
  - it replaces `items` on success and keeps them on failure;
  - it is a no-op while loading or in the error state;
- abort a request in flight on a newer `refresh`, a `retry`, a project change or unmount. It follows the `useFavicon` pattern: async/await, and an `AbortController` per request.

`ProjectsApiClient` (`libs/chat-hooks/src/project/projects-api-client.ts`) SHALL gain `listProjectArtifacts(projectId, signal?)`, which forwards to the generated `listProjectArtifacts({ id: projectId })`. `ProjectsConfiguredClient` gains the generated method's signature. The hook never constructs or configures a client.

`mapProjectArtifactsToOutputs(items)` in `libs/chat-hooks/src/project/project-mapping.ts` SHALL map each item to `ProjectOutputItem { name, contentType }`. The `contentType` is `inferMimeTypeFromPath(name)`, or `''` when that returns nothing, as `mapProjectDetailsToViewModel` maps context files. The page memoises the mapped items with `useMemo`.

The page renders `ProjectOutputs` when the outputs are loaded and not empty, or when the first read failed, and passes it to `ProjectConversationsSection` as `outputs` (see the `project-conversations-ui` capability). While the first read is in flight, or when there are no outputs, it passes `undefined`.

**Feature flag:** none beyond the page's own `features.projectsEnabled` (`PROJECTS_ENABLED` / `PROJECTS_ENABLED_ROLES`). **Observability:** no new metric or analytics event; the BFF route is covered by `MetricsInterceptor`.

#### Scenario: A project with outputs

- **WHEN** the view page loads a project whose `listProjectArtifacts` answers `summary.md` and `report.pdf`
- **THEN** `ProjectOutputs` renders between the chat input and the Chats list with the cards `summary.md` and `report.pdf`, in that order

#### Scenario: A project without outputs

- **WHEN** `listProjectArtifacts` answers `{ items: [] }`
- **THEN** no Outputs heading or region renders, and the Chats list follows the chat input directly

#### Scenario: Outputs fail to load

- **WHEN** `listProjectArtifacts` rejects on the first read
- **THEN** the Outputs heading renders with `projects.outputs.error` and a Retry button, and activating Retry reads again

#### Scenario: A failed silent refresh keeps the cards

- **WHEN** two outputs are shown and a `refresh()` rejects
- **THEN** both cards stay, and no error renders

#### Scenario: Read-only project shows outputs

- **WHEN** a shared project (`canEdit: false`) with one output is opened
- **THEN** the Outputs section renders its card, with no chat input above it

### Requirement: ProjectOutputs is a host-agnostic presentational component in libs/projects

`libs/projects` SHALL export `ProjectOutputs` (`libs/projects/src/components/ProjectOutputs/ProjectOutputs.tsx`) and its types from `libs/projects/src/models/project-outputs-props.ts`: `ProjectOutputsProps`, `ProjectOutputItem`, `ProjectOutputsLabels`, `ProjectOutputsColors`, `ProjectOutputsTypography` and `ProjectOutputsStyles`.

| Prop | Contract |
| --- | --- |
| `items` | `ProjectOutputItem[]` (`{ name: string; contentType: string }`), in display order. The lib does not sort. |
| `onOpenOutput` | `(name: string) => void`, called when a card is activated. The host decides what opens. |
| `selectedOutputName` | optional `string`: the card that renders selected. |
| `hasError` | optional `boolean`, default `false`: renders the error text and the retry action instead of cards. |
| `onRetry` | optional `() => void`: the retry action, hidden when omitted. |
| `previewLimit` | optional `number`, default `6`: the cards shown before "See all". |
| `labels` | optional `ProjectOutputsLabels`: `title`, `seeAllLabel(count)`, `showLessLabel`, `openOutputLabel(name)`, `errorLabel`, `retryLabel`, each optional with an English default. |
| `styles` | optional `ProjectOutputsStyles` (`colors`, `typography`). |

Rendering:

- **Empty.** With no `items` and no `hasError`, it SHALL render nothing.
- **Section.** Otherwise it renders a `<section aria-labelledby>` whose `<h2>` is `labels.title`, styled with `typography.titleClassName`, default `'dial-body-semi-text'`. This is the same level as the Chats heading.
- **Cards.** The first `previewLimit` items render as a `<ul>` of `AttachmentCard`s from `@epam/ai-dial-attachment-input`, the same 100×100 cards as the Details panel's context files, with 8 px gaps (`gap-2`).
  - Each card is a `DisplayAttachment` with `id: name`, `status: RequestStatus.Idle` and `type: getAttachmentTypeFromMime(contentType)`.
  - It takes `onClick` → `onOpenOutput`, `isSelected` when `name === selectedOutputName`, and `labels.clickLabel = openOutputLabel(name)`.
  - A card offers no rename, delete or upload action, and the section has no add control.
- **Collapsed row.** The row is `flex-nowrap` with `overflow-x-auto` at every width, inside a `min-w-0` container, so only the row scrolls.
- **See all.** When `items.length > previewLimit`, a kit `LinkButton` after the heading reads `seeAllLabel(items.length)`. Activating it renders every item in a wrapping (`flex-wrap`) list, and the button then reads `showLessLabel` and collapses again.
  - The button carries `aria-expanded` and `aria-controls` (the list's id).
  - The expanded state is the component's own state, so a new `items` array does not reset it.
- **Error.** `hasError` renders `errorLabel` in `typography.helperClassName` (default `'dial-tiny-text'`) inside the kit `LiveRegion` (polite). The region is part of the section, so it is already mounted when a mounted section switches to the error. On a first-load failure the section, and with it the region, mounts together with the text, which stays visible. When `onRetry` is set, it also renders a kit `GhostButton` labelled `retryLabel`.

**Colors** (`ProjectOutputsColors`, set with `buildCssVars` and read in `ProjectOutputs.module.scss`): `headingText` → `--po-heading-text`, fallback `--text-primary`, and `secondaryText` → `--po-secondary-text`, fallback `--text-secondary`.

**Isolation.** The lib gets plain data and callbacks only. It SHALL NOT know the `/api` routes, the `{projectId}/files/artifacts/{name}` locator, the generated client, the canvas or i18n. `npm run lint:check` enforces `@nx/enforce-module-boundaries` (`type:ui`).

`ProjectOutputs` is memoised with `memo`. `ProjectOutputs` and its types are documented in `libs/projects/README.md` with a compiling example.

#### Scenario: Cards beyond the preview limit are behind See all

- **WHEN** `ProjectOutputs` renders 9 items with the default `previewLimit`
- **THEN** 6 cards render, and a button named `See all (9)` has `aria-expanded="false"`

#### Scenario: See all expands and collapses in place

- **WHEN** the user activates `See all (9)`
- **THEN** 9 cards render in a wrapping list, and the button reads `Show less` with `aria-expanded="true"`
- **AND** activating it again shows 6 cards

#### Scenario: No See all when everything fits

- **WHEN** 4 items render
- **THEN** 4 cards render, and there is no See all button

#### Scenario: Activating a card

- **WHEN** the user activates the card named `Preview report.pdf`
- **THEN** `onOpenOutput` is called with `report.pdf`

#### Scenario: Selected card

- **WHEN** `selectedOutputName` is `report.pdf`
- **THEN** that card renders selected, and no other does

#### Scenario: Nothing to show

- **WHEN** `items` is empty and `hasError` is `false`
- **THEN** `ProjectOutputs` renders no element

### Requirement: An output opens in the attachment canvas, as a context file does

`ProjectViewPage` SHALL open an output the way it opens a context file (see the `project-context-file-preview` capability). Its `onOpenOutput(name)` calls `openAttachmentCanvas(attachment, key, startCanvasRequest())` with:

- `attachment = toStoredProjectFileAttachment({ id: name, name, contentType }, projectId)`, whose `url` is the output locator `{projectId}/files/artifacts/{name}`, from `toProjectArtifactUrl` in `apps/chat/src/utils/dial-file.ts`;
- `key = toProjectPreviewKey(projectId, 'artifacts/' + name)`. A context file name cannot contain `/`, so an output and a context file with the same name are never the same preview and never both render selected.

`toStoredProjectFileAttachment` (`apps/chat/src/utils/project-file-preview.ts`) SHALL take the locator builder for the folder, so that context and output cards share it.

`resolveDialUrl` SHALL map an output locator to `GET /api/v1/projects/{encodeURIComponent(projectId)}/artifacts/{encodeURIComponent(name)}` (see the `project-detail-api` capability).

- The existing context-locator resolver becomes `resolveProjectFileDownloadUrl`. It recognises the `/files/context/` and `/files/artifacts/` segments and keeps the single-segment file-name rule for both.
- The shared canvas content resolvers, the canvas Download action and `resolveAbsoluteDialUrl` therefore reach outputs with no project-specific fetch.
- **Generated-client impact:** none for the canvas; it requests the route by URL.

The page derives `selectedOutputName` from the canvas `attachmentId`: the card id after the `artifacts/` prefix in the project scope, or `undefined`. It passes `isDetailsStacked` to `ProjectView` while either a context file or an output is open.

Handlers are memoised with `useCallback`.

#### Scenario: Opening an output

- **WHEN** the user activates the `report.pdf` output card of `projects/bucket-1/support`
- **THEN** one `GET /api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/report.pdf` request is made, and the canvas shows the PDF
- **AND** the `report.pdf` output card renders selected, and the Details panel stacks below the main column

#### Scenario: Locator mapping

- **WHEN** the locator `projects/bucket-1/support/files/artifacts/Q4 deck.pptx` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/Q4%20deck.pptx`
- **AND** an output locator with no file name, or a name containing `/`, resolves to nothing

#### Scenario: Same name in context and outputs

- **WHEN** the project has a context file `notes.md` and an output `notes.md`, and the output is open in the canvas
- **THEN** only the output card renders selected

### Requirement: Outputs strings, layout, RTL and accessibility

**i18n.** `apps/chat/src/hooks/projects/useProjectOutputsLabels.ts` SHALL fill every `ProjectOutputsLabels` field with `t()`, memoised on `t`, through `ProjectsI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`. New keys in `apps/chat/src/i18n/locales/en.json`:

| Key (enum member) | English |
| --- | --- |
| `projects.outputs.title` (`OutputsTitle`) | `Outputs` |
| `projects.outputs.seeAll` (`OutputsSeeAll`) | `See all ({{count}})` |
| `projects.outputs.error` (`OutputsError`) | `Could not load outputs` |

It reuses the following keys rather than adding new ones:

- `buttons.showLess` (`ButtonsI18nKeys.ShowLess`) for `showLessLabel`;
- `buttons.retry` for `retryLabel`;
- `projects.view.openFile` (`Preview {{name}}`) for `openOutputLabel`.

**Mobile.** On `mobile` the section stays in the main column above the Chats list. The card row scrolls horizontally inside the column; at 320 px wide the page itself has no horizontal scroll. It uses the named breakpoints only (`mobile`, `desktop`), with no JS width check.

**RTL.** Only logical utilities are used (`gap-*`, `ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`). In RTL the row starts at the inline start (right) and scrolls towards the inline end. No directional icon is used, so nothing is mirrored. The lib never reads the language.

**Accessibility (WCAG 2.1 AAA).**

- The section is a `<section>` named by its `<h2>`.
- Every card is the `AttachmentCard`'s `role="button"` element, with the accessible name `Preview {name}` and `aria-pressed` for the selected one. It is reachable in DOM order with Tab and activated with Enter or Space.
- See all is a native button with `aria-expanded` and `aria-controls`.
- After a collapse, focus stays on the See all button.
- The error text is rendered in a `LiveRegion`.
- Focus rings are the kit's own, and the text and icon contrast comes from the kit tokens.

#### Scenario: Labels are translated

- **WHEN** the app language changes
- **THEN** the Outputs heading, See all, Show less, the card names and the error text re-render in that language

#### Scenario: No page scroll at 320 px

- **WHEN** the view page renders 6 outputs at a 320 px viewport
- **THEN** `document.documentElement.scrollWidth` equals its `clientWidth`, and the card row's own `scrollWidth` exceeds its `clientWidth`

#### Scenario: Keyboard access

- **WHEN** a keyboard user tabs from the chat input
- **THEN** focus reaches the See all button and each output card, before the Chats list
