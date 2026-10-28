## Context

The existing New Year module registers five scenes, all clickable, with confetti also selected by the secret phrase. The user explicitly assigns PenguinStar to the gift and GiftWrapping to the phrase.

## Goals / Non-Goals

Remove the three basic effects completely, keep the two existing stories and assign disjoint trigger pools. Do not change choreography, the shared runtime, layout, external dependencies or performance budgets.

## Decisions

- Delete registrations, enum members, obsolete labels, particle CSS, components and stories instead of disabling them. Existing generic FlyingCharacters stays because Halloween uses it.
- Keep one click scene and one secret scene. Existing provider selection filtering and cancellation own all state; no additional context is needed.
- Keep app-owned translation mapping in CelebrationHost through the labels prop, and geometry through anchors. Remove the app's three unused keys without importing host details into the library.
- Replace the deleted sleigh browser baseline entry with PenguinStar, preserving the three-scene harness and determinism check.
- Preserve story budgets: PenguinStar 20-second composition / 22500 ms provider deadline, one player, one borrowed control, 140 artwork nodes, 32 animated properties, 80 keyframes per property, 120 KB composition; GiftWrapping 16-second composition / 18500 ms deadline, one player, two elves and zero borrowed controls. Existing mobile, RTL, reduced-motion and interruption cleanup remain unchanged. New animation/resource budget: zero.

## Risks / Trade-offs

- External consumers using removed enum members or label fields must remove those references. This is intentional removal, not an alias migration.
- A removed Storybook identifier can break browser tooling. Update the baseline entry and its readiness selector together.
- Existing future pack examples mention a custom sleigh label; clarify that it is pack-provided, not a bundled label.

## Migration Plan

Update the enum, pools, render map, translations and documentation atomically. Run existing scene/runtime tests, lint, typecheck, documentation/spec checks and the required full verification. No choreography changes require new frame-rate claims; browser profiling is not evidence supplied by this deletion.

Rollback restores the deleted effects and their registrations together. No persistence migration is needed.

## Open Questions

None; the user specified both triggers.
