---
paths:
  - '**/*.tsx'
globs: '**/*.tsx'
applyTo: '**/*.tsx'
alwaysApply: false
---

# Loading skeletons

The kit ships `Skeleton`, `SkeletonShimmer`, `useSkeletonTiming` and the
`SKELETON_*` constants. These rules cover what the kit cannot enforce on its
own. Look the components up through the `@epam/ai-dial-ui-kit` MCP tools, and
read delay, minimum duration, tones and bar widths from the kit constants —
never copy those numbers here or into a call site.

## What the skeleton replaces

- Only data loaded from the server is replaced. The page title, navigation,
  tabs, inputs and buttons stay rendered and usable while it loads.
- Use one `SkeletonShimmer` per container, not one per row.
- Never show a spinner and a skeleton together for the same load.
- Never render an empty or no-results state while the skeleton is shown. Those
  states mean "loaded, and there is nothing", which is not yet known.

## Layout stability

- The skeleton mirrors the structure of the content it stands in for (same
  rows, same avatar/text arrangement).
- The container height must not jump when the content arrives. Hold the space
  with the `placeholderClassName` that `useSkeletonTiming` returns while its
  delay is running.

## Accessibility

- Skeleton blocks are not focusable and carry no label of their own.
- Announce loading through a `LiveRegion` that is always mounted (see
  [`a11y.md`](a11y.md)), and only once the skeleton is actually drawn — not
  during the timing delay, when nothing visible has appeared yet.

## Timing

- Use `useSkeletonTiming`. Never hand-roll `setTimeout` timers for the delay or
  the minimum display time.
- Edge case: a `Suspense` fallback unmounts the moment the chunk loads, so the
  minimum display time does not apply to it. Do not rely on it there.
- Edge case: `contentClassName` on items that remount replays the reveal
  animation on every remount. Apply it only to content that mounts once per
  load.

## Tests

- Import `SKELETON_DELAY_MS` and `SKELETON_MIN_DURATION_MS` from the kit rather
  than hardcoding the values.
- Assert on roles and accessible names, not on the kit's DOM structure or its
  utility classes.
