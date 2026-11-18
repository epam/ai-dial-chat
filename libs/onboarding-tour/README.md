# @epam/ai-dial-onboarding-tour

Onboarding hints over any page: hint cards shown one after another, each next to the element it explains.

## Overview

`@epam/ai-dial-onboarding-tour` presents operator-authored hints about a page. `OnboardingTour` is a first-visit walkthrough: it opens a hint card next to one element at a time, with Back/Next/Done, Skip and Escape. It dims the page around a cut-out over the element, so the element stays lit, and points the card at it with an arrow. The page stays usable while a card is open: the dimming lets clicks through. Each hint is an `OnboardingTourStep` — a title, an optional description and a `getTarget` callback that returns the element — and the card follows its target through scrolling, resizes and layout shifts.

Cards are positioned with [Floating UI](https://floating-ui.com) (`@floating-ui/react`): a card goes below its target, otherwise above or beside it, start-aligned and kept inside the viewport; on mobile it is a bottom sheet. Each step moves focus to its card so the new title is announced. Focus is not trapped, and when the tour ends it goes back to where it was when the tour started. A step whose target is not on screen is skipped.

The lib owns presentation only. Which hints exist, how their elements are found, when the tour starts and which hints the user has already seen are host decisions: the host builds the steps, receives each passed step through `onStepComplete` and the shown ids through `onFinish`, persists them however it likes and drops them from the list.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-onboarding-tour": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-onboarding-tour/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

`@floating-ui/react` is a regular dependency, declared at the same range `@epam/ai-dial-ui-kit` uses, so a host gets one copy.

## Components

### OnboardingHints

The whole first-visit flow over `OnboardingTour` and `OnboardingAnchorMap`:
it picks the hints the user has not seen whose element is on the page, waits
`ONBOARDING_START_DELAY_MS` after each `pageKey` change and keeps looking every
`ONBOARDING_RETRY_INTERVAL_MS` (up to `ONBOARDING_RETRY_ATTEMPTS` times) while
the page loads its data, runs the tour, and reports the merged seen ids through
`onSeenIdsChange`. With `isAnchorView` it outlines every anchor instead.

A tour never starts while an input, textarea, select or editable region has
focus, so it never takes the user's keystrokes; it waits until they leave the
field. Next marks the hint just passed as seen at once, so a tour left halfway
— another page, a reload, a closed tab — later resumes from the first hint the
user has not passed. Done marks the hints that were on screen as seen; Skip,
Close and Escape dismiss onboarding and mark every configured hint seen, so no
later page opens another tour. A `pageKey` change ends a running tour; the
hints not passed yet wait for a page that renders them.

The host decides what a `target` means: `resolveTarget` turns it into the
element, and `anchorTargets` lists every target it knows. The lib never looks
at the page's markup itself.

```tsx
import { OnboardingHints } from '@epam/ai-dial-onboarding-tour';

<OnboardingHints
  hints={[
    {
      id: 'new-chat',
      target: 'new-chat',
      title: 'Start a chat',
      description: 'Open a fresh conversation at any time.',
    },
  ]}
  resolveTarget={(target) =>
    target === 'new-chat' ? document.querySelector('#new-chat') : null
  }
  anchorTargets={['new-chat']}
  seenIds={seenIds}
  onSeenIdsChange={saveSeenIds}
  isEnabled={isConfigReady}
  pageKey={pathname}
  isAnchorView={isAnchorView}
  onCloseAnchorView={closeAnchorView}
  labels={{ tour: { next: 'Next' }, anchorMap: { close: 'Close anchor view' } }}
/>;
```

| Prop                | Type                                      | Default   | Description                                                                                |
| ------------------- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `hints`             | `OnboardingHint[]`                        | —         | `{ id, target, title, description? }` per hint, in order.                                  |
| `resolveTarget`     | `(target: string) => HTMLElement \| null` | —         | Finds a target's element; `null` when the page does not render it.                         |
| `anchorTargets`     | `string[]`                                | —         | Every target name, outlined in the anchor view.                                            |
| `seenIds`           | `string[]`                                | —         | Ids the user has already seen.                                                             |
| `onSeenIdsChange`   | `(seenIds: string[]) => void`             | —         | Receives the merged seen ids after each Next and when a tour ends; the host persists them. |
| `isEnabled`         | `boolean`                                 | —         | `false` while the hints load; no tour starts.                                              |
| `pageKey`           | `unknown`                                 | —         | Changes on navigation (the pathname); each change looks for hints again.                   |
| `isAnchorView`      | `boolean`                                 | `false`   | Outlines every anchor instead of showing hints.                                            |
| `onCloseAnchorView` | `() => void`                              | —         | Called by the anchor map's close button.                                                   |
| `isMobile`          | `boolean`                                 | `false`   | Shows the hint card as a bottom sheet.                                                     |
| `dir`               | `'ltr' \| 'rtl'`                          | inherited | Direction of the tour and the anchor map.                                                  |
| `labels`            | `OnboardingHintsLabels`                   | English   | `tour` (`OnboardingTourLabels`) and `anchorMap` (`OnboardingAnchorMapLabels`).             |

### OnboardingTour

```tsx
import { useState } from 'react';
import {
  OnboardingTour,
  type OnboardingTourStep,
} from '@epam/ai-dial-onboarding-tour';

const initialSteps: OnboardingTourStep[] = [
  {
    id: 'new-chat',
    title: 'Start a chat',
    description: 'Open a fresh conversation at any time.',
    getTarget: () => document.querySelector<HTMLElement>('#new-chat'),
  },
];

const Tour = () => {
  const [steps, setSteps] = useState(initialSteps);
  return (
    <OnboardingTour
      steps={steps}
      onFinish={(shownStepIds) => {
        saveSeen(shownStepIds);
        setSteps([]);
      }}
      labels={{
        stepCounter: (current, total) => `Step ${current} of ${total}`,
        next: 'Next',
        back: 'Back',
        done: 'Done',
        skip: 'Skip tour',
        close: 'Close tour',
      }}
    />
  );
};
```

| Prop                   | Type                                                                | Default                       | Description                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `steps`                | `OnboardingTourStep[]`                                              | —                             | Steps in order. An empty list renders nothing; a new list restarts from its first step.                                                                                        |
| `onFinish`             | `(shownStepIds: string[], reason: OnboardingTourEndReason) => void` | —                             | Called with the ids of the steps that were on screen, and `Done` (Done, or no remaining step has a target) or `Dismissed` (Skip, Close, Escape). The host clears `steps` here. |
| `onStepComplete`       | `(stepId: string) => void`                                          | —                             | Optional. Called with a step's id when the user moves past it with Next, so the host can keep the progress of a tour left unfinished.                                          |
| `isMobile`             | `boolean`                                                           | `false`                       | Shows the card as a sheet instead of next to the target, docked at the bottom, or at the top when the target is in the lower half of the screen.                               |
| `dir`                  | `'ltr' \| 'rtl'`                                                    | inherited                     | Direction of the card; it is start-aligned with its target.                                                                                                                    |
| `labels`               | `OnboardingTourLabels`                                              | English                       | `stepCounter`, `next`, `back`, `done`, `skip`, `close`.                                                                                                                        |
| `colors`               | `OnboardingTourColors`                                              | theme tokens                  | See below.                                                                                                                                                                     |
| `counterClassName`     | `string`                                                            | `'dial-tiny-text'`            | Typography of the step counter.                                                                                                                                                |
| `titleClassName`       | `string`                                                            | `'dial-body-semi-text'`       | Typography of the card title.                                                                                                                                                  |
| `descriptionClassName` | `string`                                                            | `'dial-small-paragraph-text'` | Typography of the card description.                                                                                                                                            |
| `className`            | `string`                                                            | —                             | Extra class name(s) on the tour root.                                                                                                                                          |

`colors` fields and their defaults: `backdrop` (`--bg-backdrop`, the dimming around the cut-out), `counterText` (`--text-tertiary`), and the card fields `cardBackground` (`--bg-layer-raised`), `cardShadow` (`--shadow-lg`), `titleText` (`--text-primary`), `descriptionText` (`--text-secondary`).

### OnboardingAnchorMap

An authoring aid rather than an onboarding surface: it draws a dashed outline with the anchor's name over every anchor on screen and lists, in a panel at the bottom end corner, the anchors the page does not render, behind a toggle that starts collapsed. An anchor covered by a drawer or dialog, or clipped by a scroll container, gets no outline. Clicks pass through the outlines, so the page stays usable while the map is shown; only the panel takes pointer input.

```tsx
import { OnboardingAnchorMap } from '@epam/ai-dial-onboarding-tour';

<OnboardingAnchorMap
  anchors={[
    {
      id: 'new-chat',
      getTarget: () => document.querySelector<HTMLElement>('#new-chat'),
    },
  ]}
  onClose={closeAnchorView}
  labels={{
    summary: (found, total) => `${found} of ${total} anchors on this page`,
    missingHeading: 'Not on this page',
    noneMissing: 'Every anchor is on this page',
    close: 'Close anchor view',
  }}
/>;
```

| Prop               | Type                        | Default                  | Description                                                        |
| ------------------ | --------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `anchors`          | `OnboardingAnchor[]`        | —                        | `{ id, getTarget }` per anchor; `id` is the name shown in its tag. |
| `onClose`          | `() => void`                | —                        | Called when the panel's close button is pressed.                   |
| `dir`              | `'ltr' \| 'rtl'`            | inherited                | Direction of the tags and the panel.                               |
| `labels`           | `OnboardingAnchorMapLabels` | English                  | `summary`, `missingHeading`, `noneMissing`, `close`.               |
| `colors`           | `OnboardingAnchorMapColors` | theme tokens             | See below.                                                         |
| `tagClassName`     | `string`                    | `'dial-tiny-semi-text'`  | Typography of each name tag.                                       |
| `summaryClassName` | `string`                    | `'dial-small-semi-text'` | Typography of the panel heading.                                   |
| `itemClassName`    | `string`                    | `'dial-tiny-text'`       | Typography of the panel's list and its heading.                    |
| `className`        | `string`                    | —                        | Extra class name(s) on the map root.                               |

`colors` fields and their defaults: `outline` (`--stroke-accent`), `tagBackground` (`--bg-layer-raised`), `tagText` (`--text-accent`), `panelBackground` (`--bg-layer-raised`), `panelBorder` (`--stroke-tertiary`), `panelShadow` (`--shadow-lg`), `panelText` (`--text-primary`), `panelMutedText` (`--text-secondary`).

## Hooks

### useOnboardingHints

The hint logic of `OnboardingHints` without its rendering, for a host that
renders `OnboardingTour` itself. It takes the same `hints`, `seenIds`,
`onSeenIdsChange`, `resolveTarget`, `isEnabled` and `pageKey`, and returns the
`steps`, `onFinish` and `onStepComplete` to pass to `OnboardingTour`.

```tsx
import {
  OnboardingTour,
  useOnboardingHints,
} from '@epam/ai-dial-onboarding-tour';

const { steps, onFinish, onStepComplete } = useOnboardingHints({
  hints,
  seenIds,
  onSeenIdsChange: saveSeenIds,
  resolveTarget,
  isEnabled: true,
  pageKey: pathname,
});

<OnboardingTour
  steps={steps}
  onFinish={onFinish}
  onStepComplete={onStepComplete}
/>;
```

`ONBOARDING_START_DELAY_MS`, `ONBOARDING_RETRY_INTERVAL_MS` and
`ONBOARDING_RETRY_ATTEMPTS` are exported for tests that advance fake timers.

## Enums

`OnboardingTourEndReason` — `Done` or `Dismissed`, the second argument of `OnboardingTourProps.onFinish`.

## Types

`OnboardingHint`, `OnboardingHintsProps`, `OnboardingHintsLabels`, `UseOnboardingHintsOptions`, `UseOnboardingHintsResult`, `OnboardingTourStep`, `OnboardingTourProps`, `OnboardingTourLabels`, `OnboardingTourColors`, `OnboardingCardColors` — the hint card colors `OnboardingTourColors` extends — and `OnboardingAnchor`, `OnboardingAnchorMapProps`, `OnboardingAnchorMapLabels`, `OnboardingAnchorMapColors`.

## Public class names

A host cannot style the tour or the anchor map through their CSS-module locals, which are hashed at build time. These elements carry a stable public class, exported as `ONBOARDING_TOUR_CLASS` and `ONBOARDING_ANCHOR_MAP_CLASS`.

| Key    | Class                       | Element                                         |
| ------ | --------------------------- | ----------------------------------------------- |
| `root` | `dial-onboarding-tour-root` | The fixed, click-through layer holding the card |
| `card` | `dial-onboarding-tour-card` | The `role="dialog"` hint card                   |

| Key       | Class                                | Element                                         |
| --------- | ------------------------------------ | ----------------------------------------------- |
| `root`    | `dial-onboarding-anchor-map-root`    | The fixed layer holding every outline and panel |
| `outline` | `dial-onboarding-anchor-map-outline` | The dashed outline around each anchor on screen |
| `tag`     | `dial-onboarding-anchor-map-tag`     | The name tag above each outline                 |
| `panel`   | `dial-onboarding-anchor-map-panel`   | The panel listing the anchors not on screen     |

The classes carry no declarations of their own. Renaming one, or moving it to a different element, is a breaking change. The convention is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).
