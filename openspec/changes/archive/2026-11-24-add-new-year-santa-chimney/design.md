# Design

## Context

This replaces the rejected chimney plot during the already-authorized apply workflow. Santa D is the approved visual reference. SnowmanDelivery supplies the compact connected silhouette and readable pauses; the retained ReindeerTakeoff artwork supplies distinct adult/calf proportions, reins and sleigh runners. Its existing scene is not being migrated or changed.

`getCelebrationHistoryRows` already resolves visible idle rows through host-provided anchors. `prepareCelebrationSnapshots` can preserve live nodes while animating inert copies; `bindTrackLayers` retargets native positional keys without changing their timing. Current CopyTrack is limited to starter cards/composer words and horizontal stages. Viewport placement currently rejects every interaction, so history support requires an explicit new capability, not a flag masquerading as existing support.

## Goals / Non-Goals

Deliver the complete requested causal story, preserve Santa D, keep real chat state unchanged, and maintain Themes ownership. No generic physics engine, scene generator in Chat, new trigger, sidebar opening, audio dependency, dialogue text or live-control movement.

## Decisions

### Native story and first interaction

Approximate full duration: 27 seconds, calibrated after actual-size playback. Beats: 0–6 descend along row edges; 6–10 one loaded row tilts and falls, Santa slips and catches the row above, swings and recovers; 10–15 reaches the bottom and places three gifts; 15–18 attempts to climb, strains and settles back down; 18–20 retrieves a phone and calls; 20–24 two reindeer bring a sleigh and stop for boarding; 24–27 Santa boards, waves and leaves. Gifts and all temporary decoration disappear after a short final pause. The falling row visibly returns to its original location after the recovery, before the gift/phone ending.

The first rendered slice is descent → loaded row → fall → hanging catch → recovery. Use controlled steps/short hops with planted support holds; use a whole-body pivot around a planted mitten for the hanging swing. Do not stretch articulated arms to span arbitrary row gaps. First-slice duration and metadata must match its own native frames. Actual-size pose inspection and continuous motion assessment remain separate; recordings alone do not establish readability.

The 2026-11-24 visual correction keeps that history interaction and the accepted ending. When history is unavailable, replace the six drawn cards with a rope: Santa lowers himself, briefly slips, arrests the slip with a visible mitten grip and continues down. His failed return climb uses the same rope before the phone call and rescue. Add one rounded gift sack behind his shoulder in both routes and the poster, with a readable tied neck and a connected carrying strap. Center the head above the torso, removing its persistent sideways bias while preserving limited action-related reactions. Keep the selected face, large round beard, character scale and existing staging; the sack must not hide the face or hand contacts.

### Generic history binding

Use `interaction-history-ladder-v1` with `viewport-stage-v1` and `direction: none`. The adapter mirrors native art using actual logical-side geometry while the copied DOM text remains upright. Generalize the adapter prepare placement type, retaining explicit narrowing in existing adapters. Keep the one-interaction rule and existing adapters' placement restrictions.

Native grammar: six static root reference nulls `hl-anchor:row-0` through `hl-anchor:row-5`; independent position tracks `hl-track:actor` and `hl-track:copy`; optional static follower roots `hl-follow:row-N`. Marker streams `hl:actor:row-N` and `hl:copy:row-N` provide nonoverlapping bind windows covering their respective position keys. `hl:entry` and `hl:restore` are single instants; the copy is bound to one row throughout its borrowing interval. Entry position equals that row reference and entry rotation is zero. Copy transforms allow translation, rotation and opacity, with fixed scale. Authored copy visibility must remain inside the existing 1% pre-entry hide fade and 4% post-restore fade window, and the source binding stays fixed through both fades. No generated choreography, spatial tangents, root time remap or timing/key-count mutation.

`hl-if:history` and `hl-if:drawn` layer prefixes select native branches; `drawn` is a generic authored alternative and does not require card artwork. Six invisible identity shape layers `hl-bounds:row-N` each contain one static rectangle declaring the station's shared visible-art envelope; one `hl-range` rectangle declares maximum horizontal drift and vertical gap. An optional `hl-drawn-bounds` layer uses the same strict rectangle format for the complete alternative-art envelope, included only when checking and positioning the drawn route. This prevents hidden fallback artwork from unnecessarily enlarging the history actor's protected corridor. Strictly validate all metadata, track/parent references and marker coverage before host measurement. Remove metadata only from a private render copy. Every visible root is owned by a declared track/follower. Bounds must cover actual rendered poses, including strokes. Deliberate offscreen entry/departure may be clipped only at the viewport boundary and must not authorize overlap with protected composer/control surfaces; verify the exact full-story flight corridor before accepting the full scene.

Read at most 120 candidate links and inspect at most 24 ancestors per candidate. Choose six distributed ordered stations within a safe reachable corridor, preferring the lowest usable ending row and the earliest compatible start. Cache at most six station envelopes per candidate row (720 total) before searching; test at most 24 geometrically valid candidate copy paths, with no further DOM measurements during search. Keep both endpoints of the chosen corridor; reject duplicate, overlapping, oversized, clipped, focused, expanded, editable or unsafe targets. Gaps/drift must satisfy authored `hl-range`. Watch the measured rows/container and semantic anchors. Fewer than six safe remaining rows uses the full drawn alternative; never move or pad live UI to create room. Copy at most one row, at most 320×64 CSS px and 80 descendant/root nodes. Bound the counting traversal before any clone/style work. Do not mirror copied text or copy editable values. Do not reinterpret unavailable history as permission to open it.

Visible idle rows may contain noninteractive decorative `aria-hidden` descendants.
The row and its ancestors must remain visible, and accessibility-hidden interactive
controls still make the row ineligible. Static planar translations on ancestor
wrappers are permitted because the measured viewport rectangle already includes
them and the wrapper is not cloned. Reject transforms on the row itself, ancestor
scale/rotation/skew/perspective/zoom and active or pending ancestor animation.
Transforms shared with the viewport scene, including body/html and custom portal
ancestors, remain unsupported because the measured offset would be applied twice.
Use actual virtualized conversation-row DOM in browser integration checks, rather
than treating simplified Storybook list markup as sufficient host coverage.

The synthetic route translates the same six references and authored rope branch near the composer without borrowing UI. Prefer a free region above its logical corner on phones; do not cover composer, add/model controls, visible welcome heading or starters. Keep a readable ~80–110 CSS px Santa in the mobile variant. If no full-story corridor fits, use a safe static poster, then notification-only if no readable poster fits. Reuse the existing safe-poster geometry/lifecycle via a generic shared path; do not retain a Santa-specific branch. The rope is native artwork. Only the declared straight top-line endpoint extends to the viewport during preparation; no per-frame geometry is generated.

### Lifetime, state and delivery

Reuse the Lottie session and `timelineZeroMs` for snapshot synchronization. Preparation performs all geometry reads before animation starts. Cancellation on input/focus/pointer/keyboard/scroll/resize/visual viewport/hidden tab, changed row content or geometry, semantic-anchor changes, host reset and reduced-motion changes restores originals immediately and releases every copy, observer, listener and animation. Late loads cannot resurrect a terminated scene. Preserve composer draft, caret, focus, selection, history order and live element identities.

Keep `new-year/santa-history-delivery` as an additive secret scene for `happy new year`, with an external English label and existing locale fallback. The compiled event declares `secretTrigger.externalSceneIds`; composition routes admitted Santa only to the existing secret pool. Preserve all prior secret and click entries. Unknown-capability clients omit only the new scene. The new capability belongs only at scene level. No `.env.local` edits. Local source and preview do not imply merged, published or deployed support.

Maintained native source lives in `authoring/santa-history-delivery/` in the sibling
`ai-dial-chat-themes` repository: complete and representative desktop/mobile JSON,
poster, unpublished descriptor and source inventory. Its `check.mjs` packages the
complete variants into a temporary catalog for the Themes checker; it never writes
published versions. Chat Storybook fixtures and the ignored local preview catalog
are byte-identical copies, not the authoring location.

### Budgets and verification

Full-scene target per variant: ≤300 KiB JSON, ≤36 recursive layers, ≤2,500 animated keys, ≤4,000 vertices, ≤420 rendered SVG descendants; hard publication ceilings remain 512 KiB/48 layers/4,000 keys/8,000 vertices/800 SVG nodes. One player, one row snapshot, six station anchors, at most four snapshot WAAPI animations, no filters, per-frame host reads or React state updates. The larger target than the superseded one-character prototype accounts for two deer/sleigh and six stations, not for denser sampling. Poster ≤100 KiB. At 27 seconds use 27,000 ms playback, 2,000 ms loading, 250 ms readiness and 29,500 ms lifetime; shorter first-slice descriptors match their own duration.

The rope/sack/head correction retains these budgets: one Santa, one sack, at most one rope, two reindeer and one sleigh. The rope branch takes zero DOM snapshots. Recheck the shared station and alternative-only envelopes against the new sack and rope; do not weaken clearance checks to fit the revision. Before this correction, the full desktop envelope is 260.1×346.8 CSS px and the full mobile envelope is 306×313 CSS px. The mobile ending alone occupies 306×310 CSS px, so removing cards does not remove the need for the safe poster in a centered-composer layout without enough room for the complete story.

Verify 360/390/1280/1920 px, light/dark, LTR/RTL, visible/closed/empty/unsafe history, welcome/docked composer, and keyboard-constrained viewport. Inspect actual-size art/poses and assess normal-speed motion separately. Test restoration under every interruption and 20 replay/cancel cycles, private source immutability and malformed contracts. Measure 20 preparations under 4× CPU throttling (50 ms p95 target), SVG peak and frame intervals; report limits without claiming guaranteed frame rate. Run changed-slice and relevant existing interaction regressions after runtime changes.

## Risks / Trade-offs

Irregular or long history may not provide six safe stations inside authored reach and viewport bounds; the complete rope branch preserves the slip/catch/recovery and ending without a borrowed row. The history branch retains the central falling-row action. A narrow phone may need tighter native staging, not shrinking the character below readability. Native flight corridor and exact planted contacts need browser evidence, not only metadata. Publication retains the independent ordinary-pack version-slot prerequisite.

### Real-host fit correction (2026-11-24)

The full desktop artwork and all spatial metadata are uniformly authored at 85%
of their previous size (510×442 composition); the roughly 85 px character remains
readable while the ending clears a centered composer at 1280×800. Timings, easing,
colors, rotations, transform percentages and plot are unchanged. Host reach stays
24 px drift / 80 px gap; mobile, poster and representative assets are unchanged.
The compact desktop SHA is `200aae163ae90dbef60fadb9a6c2050957323e18f3b4289df545508bef4ca22b`.

### Viewport travel correction

The next user correction binds Santa to the physical left row edge in LTR, with
the corresponding logical start edge in RTL. An optional `hl:edge-start` instant
at frame zero selects this pivot without changing older native assets. The copied
row rotates around the same edge and its text remains upright.

Optional `viewport-start` and `viewport-end` reference nulls use the same existing
position binding as row stations. Their target points combine the last row's
measured orthogonal coordinate with the actual visible viewport edge. A native
`hl-track:flight` binds to those references or row-5; `hl-flight-bounds` declares
the local envelope for the full vehicle and rider. Actor keys may also bind to
viewport-end after boarding. Timing, easing, artwork and offscreen margins remain
Themes-owned. Chat only maps position keys once and checks swept flight bounds
against protected surfaces, allowing clipping at the viewport edges for flight.

A single optional `hl-if:drawn:top-line:row-0` layer is a static vertical path
with bounded strokes directly under the row-0 follower. Its first endpoint is
extended above the visible viewport; the remainder of the rope is unchanged.
The extra line's visible corridor must avoid protected controls. No per-frame
measurements, generated choreography or new player is introduced.

The full ending shifts into reachable space beside the start edge. Incoming
flight uses one decelerating segment, boarding a stationary hold, and departure
one accelerating segment shared by Santa and the vehicle. Their scale remains
constant; neither transparency nor shrink-to-zero substitutes for crossing the
edge. Existing 300 KiB / 36-layer / 2,500-key / 4,000-vertex / 420-SVG-node targets
remain, with 27-second playback and existing load/lifetime limits.
