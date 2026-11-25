# Fix Snow Circus review findings

## Problem

Returning a right-edge button can move the snowman off a phone viewport. Filtering the already-selected pair loses otherwise eligible controls. The architecture guide still describes the superseded standalone pack.

## Solution

Declare a conservative native artwork envelope and reject contact translations that do not fit the viewport. Apply button eligibility before shared candidate ranking. Correct the standard-pack and secret-trigger documentation. Follow the existing authored bounds approach in `libs/celebrations/src/utils/history-ladder-contract.ts` and bounded discovery in `libs/celebrations/src/utils/borrow-targets.ts`.

## Capabilities

### Modified Capabilities

- `celebration-button-props`: viewport-safe contact binding and eligibility before pair selection.

## Impact

Chat owns pure geometry and target selection. Themes owns the artwork envelope and native resources in the unpublished standard-pack candidate 1.5.1. No new endpoint, dependency, context, user-visible string or host integration is introduced; anchors/loaders remain caller supplied. Existing shared discovery callers keep their behavior without the optional predicate.

## Alternatives

Moving characters independently would change the choreography and adapter model. Bounding the entire composition frame would unnecessarily reject safe contacts. An authored envelope gives a conservative bounded check without interpreting arbitrary Lottie paths at runtime.

## Non-goals

No plot/art redesign, remote publication, Config Studio changes, commits or pushes. Do not rewrite the archived implementation record.

## Acceptance criteria

The 360px right-edge reproduction keeps both characters visible during return using drawn snow. Two eligible 40px buttons beside a 100px selector are both selected. Valid contacts retain restoration/cleanup, original native bounds enclose visible art, and docs describe new-year-default@1.5.1 and happy new year. Existing scene budgets remain unchanged.

## Compatibility and rollback

Bounds slots are optional for earlier button-props sources, which conservatively use their full composition rectangle. Replace the never-published 1.5.0 preview with candidate 1.5.1 so browsers use a new immutable manifest URL; all retained published resources stay immutable. Removing the optional discovery predicate leaves other scenes unchanged. Rollback can remove the scene allowlist entry.
