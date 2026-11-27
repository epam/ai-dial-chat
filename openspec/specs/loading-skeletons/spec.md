# loading-skeletons Specification

## Purpose

The rules every loading placeholder in the app follows, so loading feels the same everywhere: what a skeleton replaces, how it looks, when it appears, and how it is announced. The rules come from issue #9927 and are built into `@epam/ai-dial-ui-kit` through `Skeleton`, `SkeletonShimmer`, `useSkeletonTiming` and the `SKELETON_*` constants. Surface-specific behaviour stays in that surface's own spec (`conversation-history-panel`, `catalog-model-selector`, `conversation-panel-icon-loading-state`).

## Requirements

### Requirement: A skeleton replaces only server data

A skeleton SHALL stand in for data loaded from the server (images, avatars, icons, names, descriptions, list items). The surface's own chrome — the page or dialog title, navigation, tabs, labels, input fields, buttons and the footer — SHALL stay real and usable. Cancel and close SHALL keep working while loading. A button MAY be disabled when its action needs the loaded data. Full-page and route loading are out of scope.

#### Scenario: Chrome stays usable while data loads

- **WHEN** a dialog's list is loading
- **THEN** the dialog title, its Cancel button and its footer are rendered normally and only the list is a skeleton

---

### Requirement: Skeletons are built from the kit, never hand-rolled

A skeleton SHALL be composed from `Skeleton`, `SkeletonShimmer`, `SkeletonTone`, `useSkeletonTiming` and the `SKELETON_*` constants of `@epam/ai-dial-ui-kit`. An app or lib SHALL NOT write its own skeleton animation, timing or sizes, and SHALL NOT expose a colour prop for a skeleton (the tone is `SkeletonTone`). Libraries SHALL receive every user-visible loading string through a `*Labels` prop, and the app fills it with `t()`.

#### Scenario: A lib skeleton has no colour prop

- **WHEN** a lib renders a loading skeleton
- **THEN** its colours come from `SkeletonTone` and its public props carry no skeleton colour field

---

### Requirement: Anatomy and content patterns

One `SkeletonShimmer` SHALL wrap each loading region, in the same slot as the real content, so a region has one motion source and not one per row. Two parts of one screen that load separately each get their own shimmer. Inside it:

- a circle stands for an image, avatar or icon: `SKELETON_CIRCLE_SIZE_LIST` (24 px) in lists, `SKELETON_CIRCLE_SIZE_CARD` (48 px) in cards;
- a bar stands for text: `SKELETON_BAR_HEIGHT` (20 px) high with `SKELETON_BAR_CLASS_NAME`;
- a list item with an icon is a circle plus a bar, a list item without an icon is a bar, a card title is a long bar, a description or subtitle is a shorter bar under the title in `SkeletonTone.Base`, a paragraph is two bars with the second shorter, and short text (a version, a tag) is a bar of `SKELETON_SHORT_BAR_WIDTH`.

Bar widths SHALL cycle through `SKELETON_BAR_WIDTHS` by row index and SHALL NOT be random. Titles and names use `SkeletonTone.Sunken`, descriptions and subtitles use `SkeletonTone.Base`.

#### Scenario: Rows cycle widths deterministically

- **WHEN** a list skeleton renders more rows than there are entries in `SKELETON_BAR_WIDTHS`
- **THEN** row `n` uses `SKELETON_BAR_WIDTHS[n % SKELETON_BAR_WIDTHS.length]`, and two renders give the same widths

---

### Requirement: A skeleton has the size of the real content

A skeleton SHALL have the same structure and size as the content it replaces, so nothing moves when the content appears. It SHALL be sized by its rows in normal flow and SHALL NOT take a fixed height on its container, so a popup or dropdown keeps its height while loading. When the number of real items is unknown, the skeleton SHALL render enough rows to fill the surface's usual height. A spinner SHALL NOT be shown beside a skeleton in the same area.

#### Scenario: A dropdown keeps its height during the delay

- **WHEN** a content-sized dropdown opens while its data is loading and the show delay has not passed
- **THEN** the skeleton rows are mounted but invisible and the dropdown is not zero-height

---

### Requirement: Timing follows `useSkeletonTiming`

Every skeleton SHALL take its timing from `useSkeletonTiming` with the kit defaults and SHALL NOT override them (no `delay: 0`):

- the skeleton is drawn only when loading outlasts `SKELETON_DELAY_MS` (400 ms); during the delay the area keeps its space and draws nothing (`placeholderClassName` is `invisible`);
- once drawn it stays at least `SKELETON_MIN_DURATION_MS` (500 ms);
- when the content is ready the shimmer stops and the content fades in over 180 ms through `contentClassName`, whether the content is a list, an empty state or a no-results state;
- the empty, no-results and error states wait until the skeleton is gone, because content that has not loaded is unknown, not empty. A failed load replaces the skeleton with the surface's error state, with the same fade-in;
- with `prefers-reduced-motion: reduce` the shimmer does not run and the fade-in is off.

The skeleton markup SHALL be mounted for the whole load (`showPlaceholder`) and hidden with `placeholderClassName`, not mounted only once drawn (`showSkeleton`), when its container is sized by its content. A fade-in class SHALL be applied to a wrapper that stays mounted, or be dropped once it has played, so that remounting rows (a menu that reopens, a search filter) does not replay it.

A skeleton used as a `Suspense` fallback unmounts as soon as the chunk resolves, so its minimum display time cannot apply; the component that renders it states that trade-off in a comment (`apps/chat/src/components/DeploymentSelector/DeploymentSelectorSkeleton.tsx`).

#### Scenario: A fast load never shows a skeleton

- **WHEN** loading ends before `SKELETON_DELAY_MS` has passed
- **THEN** no skeleton is drawn, nothing is announced, and the content appears without a fade

#### Scenario: A drawn skeleton does not blink away

- **GIVEN** the skeleton has been drawn
- **WHEN** loading ends before `SKELETON_MIN_DURATION_MS` has passed
- **THEN** the skeleton stays until that time has passed and the content then fades in

#### Scenario: Reopening does not replay the fade

- **GIVEN** a dropdown's rows have faded in once after loading
- **WHEN** the menu is closed and opened again, or its rows are filtered
- **THEN** the rows carry no reveal class

---

### Requirement: Loading is exposed and announced to assistive technology

The loading container SHALL be `aria-busy="true"` and the attribute SHALL be removed when loading ends. Skeleton blocks SHALL be `aria-hidden` and not focusable. The start of loading SHALL be announced through a `role="status"` region that is outside the busy container and mounted before its text arrives (the kit `LiveRegion`; a `SkeletonShimmer` `label` is its own region). The announcement SHALL name what is loading ("Loading conversations", "Loading models"), come from a translated `*Labels` entry, and be set only when the skeleton is drawn (`showSkeleton`), so a fast load announces nothing. When loading ends the announcement is cleared, and an empty or error result is announced as usual.

#### Scenario: The announcement is made once, by a region that was already mounted

- **WHEN** a skeleton is drawn after the show delay
- **THEN** the loading text appears in a status region that existed before the text and is empty again once loading ends

---

### Requirement: Each surface is checked against these rules

A surface counts as covered only when it meets every requirement above; having some skeleton is not enough. Compliant surfaces: the model selector (dropdown, bottom sheet and trigger icon: `libs/conversation-input/src/components/ModelSelectorSkeleton/ModelSelectorSkeleton.tsx`, `libs/conversation-input/src/components/ModelSelectorBottomSheet/ModelSelectorBottomSheet.tsx`, `apps/chat/src/components/DeploymentSelector/DeploymentSelectorSkeleton.tsx`) and the sidebar conversation list (`libs/conversation-panel/src/components/ConversationListSkeleton/ConversationListSkeleton.tsx`). Each of the following has not yet been checked against, or does not yet have, a skeleton and is tracked in issue #9927: PDF preview, the catalog card grid and details tabs, scheduled tasks (cards, run history, conversation banner), the share dialog, publish-panel version history, image attachments, sidebar navigation, the conversation message list, conversation action dialogs, the new-conversation input area, the model and prompt catalog dialogs, the prompt selector, the file manager dialogs, pinned project action dialogs, the application, prompt and skill editors, and the message editor.

#### Scenario: A new skeleton is added

- **WHEN** a skeleton is added to a surface from the pending list
- **THEN** the change meets every requirement in this spec, updates that surface's own spec, and ticks the surface in issue #9927
