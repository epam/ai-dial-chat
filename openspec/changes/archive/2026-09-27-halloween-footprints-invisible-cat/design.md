## Context

The approved concept retains an invisible familiar and the existing twelve-second deadline. The old renderer in `HalloweenExtras.tsx:101` uses 14 prints, one grin, 89 SVG nodes and 15 CSS animations. Local audit evidence is in `tmp/footprints-audit/`: 360/900/1280/1920, RTL, native reduced motion and an eight-second active-phase profile with zero JS geometry reads/long tasks. These are development Chromium samples, not production-phone guarantees.

## Goals / Non-Goals

**Goals:** Express an unseen animal's weight through pressure marks and a temporarily tilted card or a reactive input outline; preserve the chat; keep all geometry, artwork and playback bounded; improve the SVG at actual display size.

**Non-Goals:** A visible full cat, interactive steering, new triggers or flags, host-specific selectors, public theming/API expansion, data mutation, audio, external assets, animated filters or a general animation framework.

## Decisions

### One local scene owner and a pure plan

Extract Footprints from Extras into `HalloweenFootprints.tsx` with a small illustration stylesheet. Separate `halloween-footprint-targets.ts`, `halloween-footprint-plan.ts` and `halloween-footprint-animation.ts`. The component owns an immutable activation plan and stop state; the existing provider owns mount lifetime and selection. This follows Witches' deferred preparation and cancellation behavior without changing that scene or extracting a new shared engine.

The library isolation check is explicit: only host-supplied `CelebrationAnchors` and environment/mobile settings are read. App routes, feature flags, i18n, persistence, APIs and app contexts stay outside the library. No local AGENTS.md exists under celebrations; root instructions, library styling and extensionless TS imports apply. Artwork is decorative SVG, consistent with existing scenes; layout remains in Tailwind/computed styles and illustration colors in SCSS.

### One safe starter card

Measure at most four composer candidates, two starter lists and twelve buttons, with at most 32 ancestor checks and 40 descendants per candidate. A copied icon may use at most twelve SVG nodes, preserving the total scene budget even on mobile. Reuse the bounded eligibility approach in `halloween-witch-targets.ts`, keeping a Footprints-specific selector because it must never choose the send/model controls. Pick one visible idle starter button nearest the composer with room for the small tilt, face and route, including 112px on the open side. Require 72–240px width and 32–96px height. Starters may be above or below the composer: the real NewConversationComposer renders the input before the starters. Require a non-overlapping vertical gap, not a fixed ordering. Exclude focused, disabled, expanded, editable, hidden, clipped, transparent/transformed, masked/filtered or oversized candidates. Geometry and styles are cached only during preparation.

When no eligible starter exists but a safe visible composer has headroom, use its top edge as the stage. A lightweight outline matching its measured bounds and corner radius reacts to the attached paw contacts and sitting weight. The input subtree is never copied, hidden or animated, including focused inputs with drafts. The outline and attached prints share one transform track (13 mobile / 17 desktop tracks total). A bounded 144px walking span avoids oversized steps across wide composers, followed by a jump to the opposite corner. Missing or unsafe composer geometry retains the decorative route without a snapshot. Composer discovery must work when no starter-list anchor is supplied. Reduced motion and unsupported WAAPI skip target discovery entirely and show three static prints with eyes/grin.

### Shared contacts and twelve-second story

- 0–3s: approach the selected card, alternating asymmetric paws along a measured path. Step spacing comes from path length in CSS pixels, not unrelated vw/vh formulas.
- 3–6s: climb onto the card with discrete contacts. Each contact triggers a small dip/tilt after the paw lands. Prints attached to the card share its transform and pivot.
- 6–9s: sit, deepen the card's sag, glance and blink; reveal the pleased grin after the eyes. The face peers over the open side, outside the stacked starter labels; it lands alongside the near composer corner.
- 9–12s: prepare and jump off. The card rebounds and settles exactly at its original position, while the face travels on a precomputed arc toward the composer and a final pair of prints. The grin is the last disappearing mark shortly before the deadline.

Use 3 approach + 3 surface + 2 departure prints on mobile and 5 + 5 + 2 on desktop. The composer-only variant uses the same contact timeline with half-amplitude vertical motion and no rotation; the empty outline and attached prints move together. Spatially constrained/no-target paths retain the same pauses and face reveal without pretending to press a missing card. Physical coordinates preserve contact in RTL; only decorative paws may mirror, never copied text. No assumption of cursor tracking is introduced.

### Artwork and numeric budgets

Asymmetric toe pads, a three-lobed main pad and a restrained highlight replace the repeated glowing symbol. Use a dark contour plus a lighter interior for legibility across backgrounds. Eyes, pupils and mouth have separate tracks; no body is drawn. No filters, masks or external raster assets are needed.

Hard limits: 8/12 prints, one 240×96px / 40-descendant snapshot, 20 active animations including the source opacity track, 80 keyframes per track, 80/110 SVG nodes mobile/desktop and 2KiB of unique SVG path data in the artwork definitions. Existing audit counts are the baseline, not a requirement to keep the old artwork. Record the actual counts and rendered/profile evidence before completion.

The expected desktop allocation is 12 print tracks + 1 card-attached print container + 2 snapshot/source tracks + 4 face tracks = 19. Precompute transforms/opacity; no JS animation loop or per-frame React updates/layout reads. Static artwork detail does not allocate animation tracks. This keeps motion quality improvements within the agreed ceiling.

### Restoration and interruptions

Use `animateCelebrationSnapshots` for the inert recognizable card copy and original opacity ownership. Cover the original before its hide transition, hold the copy fully opaque until restoration completes (`restoreAt + 0.04`), then remove it without a dim label. Preserve draft, focus, selection, layout and input semantics.

All owned tracks share a start time. Cancel on input/composition, pointer/focus, scrolling, resizing, hidden document, changed motion/mobile/anchors, source mutation/removal/resize, replacement and unmount. Watch measured anchors and revalidate geometry only for real ancestor layout mutations; unrelated toast removal must not end valid playback. Cleanup is idempotent and handles partial setup failures. Deferred preparation must not restart a canceled activation or double-play under StrictMode.

## Risks / Trade-offs

- Small-screen geometry can crowd card text → put pressure marks at the card edge, use one small target, and inspect real-size mobile frames and projected bounds.
- Separate copy/print transforms can drift → generate both from the same card frames and test contact, pivot and handoff in browser coordinates.
- Detailed SVG may increase native rendering cost despite low JS cost → count nodes/commands and profile mobile at 4× CPU plus desktop; compare equivalent phases, retaining measurement limits.
- Copying custom controls may be costly → cap subtree and dimensions before copying; reject unsafe/custom transformed ancestors and prefer fallback.

## Migration Plan

No configuration or data migration. Retain scene ID, event gate, notification and twelve-second lifetime. Revert the renderer/import and new scene utilities to roll back. Update the celebrations README in this change; no architecture-map change is needed.

## Open Questions

None blocking. Geometry and exact pose timings are implementation choices inside the accepted story and budgets. Runtime performance and visual legibility must be verified, not inferred from unit tests.
