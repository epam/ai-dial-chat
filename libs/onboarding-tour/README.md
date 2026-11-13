# @epam/ai-dial-onboarding-tour

Onboarding hints over any page: a guided tour that spotlights one element at a time, or beacons that open a hint on demand.

## Overview

`@epam/ai-dial-onboarding-tour` presents operator-authored hints about a page in one of two ways. `OnboardingTour` is a first-visit walkthrough: it dims the page, outlines one element at a time and explains it in a modal hint card with Back/Next/Done, Skip and Escape. `OnboardingBeacons` is the quiet alternative: a small dot sits on the corner of each element, and pressing it opens the same card next to the element until the user dismisses it with Got it. Both take the same `OnboardingTourStep` objects — a title, an optional description and a `getTarget` callback that returns the element — and both follow their targets through scrolling, resizes and layout shifts.

Cards and beacons are positioned with [Floating UI](https://floating-ui.com) (`@floating-ui/react`): a card goes below its target, otherwise above or beside it, start-aligned and kept inside the viewport; the tour card is a bottom sheet on mobile. Focus is managed by Floating UI's `FloatingFocusManager`: the tour card traps focus and gives it back to where it was when the tour started; a beacon's card does not trap focus and returns it to the beacon. A tour step whose target is not on screen is skipped. A beacon whose target is not on screen is not rendered until the target appears, because every target is looked up again whenever the page's DOM changes.

The lib owns presentation only. Which hints exist, how their elements are found, which presentation to use, when the tour starts and which hints the user has already seen are host decisions: the host builds the steps, receives the shown ids through `onFinish` (tour) or `onDismiss` (beacons), persists them however it likes and drops them from the list.

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

| Prop                   | Type                               | Default                       | Description                                                                                                                   |
| ---------------------- | ---------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `steps`                | `OnboardingTourStep[]`             | —                             | Steps in order. An empty list renders nothing; a new list restarts from its first step.                                       |
| `onFinish`             | `(shownStepIds: string[]) => void` | —                             | Called with every step id on Done, Skip, Close, Escape, or when no remaining step has a target. The host clears `steps` here. |
| `isMobile`             | `boolean`                          | `false`                       | Shows the card as a bottom sheet instead of next to the target.                                                               |
| `dir`                  | `'ltr' \| 'rtl'`                   | inherited                     | Direction of the overlay; the card is start-aligned with its target.                                                          |
| `labels`               | `OnboardingTourLabels`             | English                       | `stepCounter`, `next`, `back`, `done`, `skip`, `close`.                                                                       |
| `colors`               | `OnboardingTourColors`             | theme tokens                  | See below.                                                                                                                    |
| `counterClassName`     | `string`                           | `'dial-tiny-text'`            | Typography of the step counter.                                                                                               |
| `titleClassName`       | `string`                           | `'dial-body-semi-text'`       | Typography of the card title.                                                                                                 |
| `descriptionClassName` | `string`                           | `'dial-small-paragraph-text'` | Typography of the card description.                                                                                           |
| `className`            | `string`                           | —                             | Extra class name(s) on the overlay root.                                                                                      |

`colors` fields and their defaults: `backdrop` (`--bg-backdrop`), `spotlightBorder` (`--stroke-accent`), `counterText` (`--text-tertiary`), and the card fields `cardBackground` (`--bg-layer-raised`), `cardBorder` (`--stroke-tertiary`), `cardShadow` (`--shadow-lg`), `titleText` (`--text-primary`), `descriptionText` (`--text-secondary`).

### OnboardingBeacons

```tsx
import { useState } from 'react';
import {
  OnboardingBeacons,
  type OnboardingTourStep,
} from '@epam/ai-dial-onboarding-tour';

const initialHints: OnboardingTourStep[] = [
  {
    id: 'new-chat',
    title: 'Start a chat',
    description: 'Open a fresh conversation at any time.',
    getTarget: () => document.querySelector<HTMLElement>('#new-chat'),
  },
];

const Beacons = () => {
  const [hints, setHints] = useState(initialHints);
  return (
    <OnboardingBeacons
      hints={hints}
      onDismiss={(id) => {
        saveSeen([id]);
        setHints((current) => current.filter((hint) => hint.id !== id));
      }}
      labels={{ beacon: (title) => `Show hint: ${title}`, gotIt: 'Got it' }}
    />
  );
};
```

| Prop                   | Type                      | Default                       | Description                                                                                   |
| ---------------------- | ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| `hints`                | `OnboardingTourStep[]`    | —                             | Hints to mark. A hint whose target is not on screen gets its beacon once the target appears.  |
| `onDismiss`            | `(id: string) => void`    | —                             | Called when the user presses Got it in a hint's card. The host removes the hint from `hints`. |
| `dir`                  | `'ltr' \| 'rtl'`          | inherited                     | Direction of the beacons and cards; a beacon sits on its target's top end corner.             |
| `labels`               | `OnboardingBeaconsLabels` | English                       | `beacon` (a beacon's accessible name, given the hint title) and `gotIt`.                      |
| `colors`               | `OnboardingBeaconsColors` | theme tokens                  | See below.                                                                                    |
| `titleClassName`       | `string`                  | `'dial-body-semi-text'`       | Typography of the card title.                                                                 |
| `descriptionClassName` | `string`                  | `'dial-small-paragraph-text'` | Typography of the card description.                                                           |
| `className`            | `string`                  | —                             | Extra class name(s) on the beacons root.                                                      |

One card is open at a time. Escape, a press outside the card or moving focus out of it closes the card and keeps the beacon. Beacons are static dots with no animation. Beacons are 24px buttons rendered at the end of `document.body`, so they come last in the tab order.

`colors` fields and their defaults: `beacon` (`--bg-accent-primary`), `beaconRing` (`--bg-layer-0`), `beaconFocusOutline` (`--stroke-focus`), and the card fields with the same defaults as the tour.

### OnboardingAnchorMap

An authoring aid rather than an onboarding surface: it draws a dashed outline with the anchor's name over every anchor on screen and lists, in a panel at the bottom end corner, the anchors the page does not render. Clicks pass through the outlines, so the page stays usable while the map is shown; only the panel takes pointer input.

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

## Types

`OnboardingTourStep`, `OnboardingTourProps`, `OnboardingTourLabels`, `OnboardingTourColors`, `OnboardingBeaconsProps`, `OnboardingBeaconsLabels`, `OnboardingBeaconsColors`, `OnboardingCardColors` — the card colors the tour and the beacons share — and `OnboardingAnchor`, `OnboardingAnchorMapProps`, `OnboardingAnchorMapLabels`, `OnboardingAnchorMapColors`.

## Public class names

A host cannot style the tour or the beacons through their CSS-module locals, which are hashed at build time. These elements carry a stable public class, exported as `ONBOARDING_TOUR_CLASS`, `ONBOARDING_BEACONS_CLASS` and `ONBOARDING_ANCHOR_MAP_CLASS`.

| Key         | Class                            | Element                                                      |
| ----------- | -------------------------------- | ------------------------------------------------------------ |
| `root`      | `dial-onboarding-tour-root`      | The fixed overlay covering the page during the tour          |
| `spotlight` | `dial-onboarding-tour-spotlight` | The outline drawn around the spotlighted element             |
| `card`      | `dial-onboarding-tour-card`      | The `role="dialog"` hint card, in the tour and from a beacon |

| Key      | Class                            | Element                                   |
| -------- | -------------------------------- | ----------------------------------------- |
| `root`   | `dial-onboarding-beacons-root`   | The element holding every beacon and card |
| `beacon` | `dial-onboarding-beacons-beacon` | Each beacon button                        |

| Key       | Class                                | Element                                         |
| --------- | ------------------------------------ | ----------------------------------------------- |
| `root`    | `dial-onboarding-anchor-map-root`    | The fixed layer holding every outline and panel |
| `outline` | `dial-onboarding-anchor-map-outline` | The dashed outline around each anchor on screen |
| `tag`     | `dial-onboarding-anchor-map-tag`     | The name tag above each outline                 |
| `panel`   | `dial-onboarding-anchor-map-panel`   | The panel listing the anchors not on screen     |

The classes carry no declarations of their own. Renaming one, or moving it to a different element, is a breaking change. The convention is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).
