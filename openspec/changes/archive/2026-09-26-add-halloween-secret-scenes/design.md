## Context

CelebrationProvider owns lazy loading, one overlay and its deadline. Secret phrases currently target one scene. The user chose new message-only artwork rather than the existing click scenes.

## Goals / Non-Goals

Goals: four distinct secret scenes and safe random selection; preserve ordinary chat, click scenes and the New Year singleton. Non-goals: APIs, persistence, audio, telemetry, dependencies or new controls.

## Decisions

- Replace internal `secretTrigger.sceneId` with `sceneIds`. Filter unavailable IDs and reuse `pickCelebrationScene`; do not consume the message if no valid scene exists. A separate provider ref remembers the preceding secret choice and resets on route/event changes. Click selection remains independent. Existing memoized callbacks and context value remain in place.
- Keep spider drop and add Cauldron, Mimic, Bowling and Mummy string-enum members. The Halloween module declares a five-entry secret pool and the existing eleven-entry click pool. Migrate New Year to a singleton array.
- Build scene illustrations with layered SVG gradients, highlights, material seams and CSS animation in `HalloweenSecrets.tsx` and its SCSS module, following HalloweenExtras. These are illustrations, not UI icons. One stable random position per mount keeps art inside the viewport; use CSS size clamps and logical placement. Keep component-owned animation declarative; a scene utility owns temporary inert snapshots and WAAPI opacity overlays, never changing original attributes, layout, focus or conversation state. It cancels on input, scroll, resize, mutation, scene cleanup or reduced motion.
- Cauldron, mimic and bowling have eight-second timelines and nine-second runtime deadlines; mummy has twelve and thirteen seconds respectively. Cauldron bubbles develop faces, mimic reaches with its tongue, chews and hiccups, a rolling pumpkin scatters history rows like bowling pins, mummy walks in, braces, strains and pushes the composer offscreen. No flashing or sound.
- Reduced motion disables every animation and chooses a visible static composition; decoration remains aria-hidden, unfocusable and pointer-transparent. Notifications announce the scene using four translated keys with `{{phrase}}`. UI_EVENT=halloween is the only existing gate; no role-based feature key is introduced.
- The existing load/error/disabled behavior remains inert. Empty or invalid secret pools return false so the composer can send normally. No new cache or observability state exists.

## Page interactions

Use the existing `.celebration-history` app-owned marker, with no changes to ConversationPanel, Composer or libraries. Mummy uses the existing exported CONVERSATION_INPUT_CLASS.wrapper to snapshot the visible start-page composer, including a focused textarea. Resolve this public constant through a dynamic import to preserve the existing lazy composer boundary. It enters from the side with more room, braces both hands against the input, strains without moving it for about two seconds, then slowly pushes it horizontally beyond the viewport. Its twelve-second timeline shares exact contact/push keyframes with the input snapshot, followed by restoring the input; runtime cleanup is thirteen seconds. Original focus and draft stay in place, with immediate cancellation on beforeinput/input/compositionstart as well as existing interruption events. Shared snapshot lifetime/copying lives in an app-owned utility reused by history scenes; no core component is changed. Cauldron and mimic use up to two visible idle rows: cauldron pulls them into its brew and returns them as bubbles, mimic extends its tongue to the pair, loops around them and retracts the tongue tip and both snapshots using the same progress and clock before chewing and spitting them back. Pumpkin bowling uses one viewport-space horizontal trajectory aimed at a visible row. Measure visible title text with DOM ranges, clipped to its text container, so the invisible trailing row width does not trigger early impacts. Circle/rectangle intersections along that trajectory determine the affected rows (up to six) and exact per-row contact offsets. A shared WAAPI timeline drives travel, rolling and row impulses; no independent CSS travel or random row subset is involved. Only intersected rows tumble, starting at contact, then regroup. The rendered pumpkin body has the same circular radius as collision geometry. Physical positions support either sidebar edge, including RTL. Scenes temporarily animate only original opacity, preserving layout and accessibility; cancellation restores immediately. Snapshot computed styles and scroll offsets so portal reparenting does not distort presentation; use inert, unique copied SVG IDs, and no navigation links. Bound snapshot size to 1500 elements, with artwork-only fallback on unavailable/closed/oversized history or unsupported animation APIs.

## Risks / Trade-offs

- Random placement could clip art → use a bounded stage with percentage travel across the available viewport and fluid sizing; verify 360/900/1280/1920 and RTL.
- Rich illustrations can increase the lazy chunk → use compact vectors, bounded particle counts and transform/opacity animation; no raster assets or dependencies.
- Renaming the internal field can break a fixture → migrate both event modules and all fixtures, verify typecheck and runtime tests.

## Migration Plan

Ship runtime and compiled modules together. No data migration. Reverting restores the single spider secret. Existing New Year behavior is unchanged.

## Open Questions

None. The user selected message-exclusive scenes; the four proposed scenes were described before implementation.

## Descending spider theft

The nine-spider secret scene can borrow up to three visible start-page targets. Resolve existing composer public classes lazily; discover its region heading semantically, the model selector and attachment cluster through the public class map, and history rows through celebration-history. No selectors or state are added to core components. Skip focused, expanded, hidden, clipped or oversized targets. Each carrier and its inert cargo share a moving viewport-sized parent, making detachment impossible. Spiders descend, weave around targets, then climb fully above the viewport with their cargo on an eleven-second shared timeline; originals return before the existing fourteen-second runtime deadline. Cancel all carriers/snapshots on input, scroll, mutation, navigation or reduced motion. The existing random decorative drops remain the fallback when no targets are available.

## Capture artwork

The mimic uses a tapered, shaded tongue and an asymmetric diagonal wrap with separately layered front and rear portions. Mask the rear portion behind the captured bundle even when the original rows have transparent backgrounds. Draw the rear and front portions in sequence before retraction; both portions retain the same bundle-centered transform and animation clock. This replaces the elliptical outline without changing capture geometry or timing.

Spider silk uses thin curved support fibres and an irregular connected mesh, with varied opacity and thickness. Each strand draws progressively during the existing weaving pause and finishes before the carrier lifts. Avoid rigid corner polygons and repeated oval bands. All strand animations belong to the existing scene cleanup.
