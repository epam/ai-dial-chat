## Why

The Halloween audit reproduced hidden history rows while typing in an already-focused composer during Portal. Portal, Train and Web also continue using stale coordinates when their anchors move without a window resize.

## What Changes

- Cancel Portal borrowing on keyboard, input and composition events.
- Cancel Portal, Train and Web when their existing targets change, move, resize or disappear, with event-driven observation and complete observer cleanup.
- Add regression coverage and update the celebrations README.
- Let mobile Mummy preparation settle after activation-time viewport changes before borrowing the composer.
- Play Bowling's existing pumpkin roll when no visible history rows are available, and make the Storybook host hide history at mobile widths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: Define restoration on input and target invalidation for Portal, Train and Web, mobile Mummy preparation and Bowling playback without history.

## Impact

Only `libs/celebrations` runtime utilities, focused tests and documentation change. Host integration still arrives through existing `CelebrationAnchors`; no app routes, i18n, storage, client setup or app imports enter the library. No public API or dependency changes and no new strings.

## Problem and Solution

Follow the bounded mutation/geometry checks in `libs/celebrations/src/halloween/utils/halloween-cat-animation.ts:60` and the resize lifecycle in `halloween-witch-animation.ts:114`. Reuse one small observer across the three affected scenes rather than duplicating its cleanup rules. Per-frame polling is rejected because it adds layout work throughout playback.

## Non-goals

Preserve every scene's plot, cast, playback timings, keyframes, artwork and reduced-motion composition. Mobile startup and missing-history playback fixes do not add characters, alternate UI targets or new story beats.

## Acceptance criteria

Input in a pre-focused composer restores Portal rows immediately. Relevant target/ancestor mutations and target resizes cancel stale effects, while unrelated toast/scene changes do not. Observers disconnect on cancellation and completion. Mobile, RTL, reduced motion and normal playback retain the existing story and resource budgets.

## Compatibility and rollback

This is an internal cancellation fix; revert the commit to restore previous behavior. Existing hosts require no changes.
