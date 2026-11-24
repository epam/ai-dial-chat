# Design: SnowmanDelivery through `interaction-copy-track-v1`

## Context

See `proposal.md` for the motivation. This section covers only the facts that shape the approach. Revisions: Chat `f416f8c69`, Themes `bdd2feb`.

### How the compiled scene uses geometry

The source is `libs/celebrations/src/new-year/utils/snowman-delivery-*.ts`.

- **One choreography.** About 59 beats in `SNOWMAN_BEATS` are fixed constants on a 25 s, 60 fps clock. The four animated stages (`ledge`, `rim`, `rim-sled`, `platform`) share the same beats and layer structure. They differ in:
  - positions
  - whether a card is borrowed: a DOM copy, or the drawn `sled` layer standing on end
  - jump versus reach squash values at the pickup
  - the step counts inside fixed walk windows
- **Times that depend on geometry.** Only the head-lodge time (`impact + 0.05 s + flight`), the three branch-flex keys after it, and the step keys inside `walk()` windows. The step count is `max(minSteps, ceil(|Δx| / 34))`.
- **Head flight.**
  - The sled's speed at impact is proportional to the slide length L: about 0.694 px/s per px of slide, because the glide always lasts 2.4 s.
  - The tree sits at `seatEnd + flightFor(L)`, where `flightFor(L) = max(seatFromFront + 4·s, 0.347·L)`.
  - So the flight takes about 0.5 s at every span, except near the minimum, where the clamp makes it shorter.
- **Coordinates.** Everything is baked to world pixels through `world([x, y]) = [stanceX + dir·s·x, floor + s·y]`. Scale `s` is 0.9 on desktop and 0.68 on mobile.
- **Grips.** Arm grips use two-bone IK, sampled every 0.04 s and then pruned.
- **Card track.** It is derived from the sled corner and rotation, with `translate` and `rotate` only, and at most 48 frames.
- **Budgets.** Today's composition is 6 or 7 top-level layers, 10 layers in the `snowman` precomposition, at most 1,300 keyframes and at most 170 KB. It uses no time remap, masks, mattes, expressions or gradients.

### What S4 already released

The source is `libs/celebrations/src/utils/`. Line counts are non-empty.

| Module | Reusable as is | Gap for copy-track |
| --- | --- | --- |
| `lottie-markers.ts` (144) | `ns:kind[:arg]` with enumerated arguments, scopes and order | none |
| `lottie-anchor-binding.ts` (164) | Translate-and-mirror for one position null plus a facing null | Several track nulls; stretch; follow; `ct-track:` prefixes |
| `lottie-time-remap.ts` (127) | Section paths, inverse mapping, elastic window | Splice pairs; cycle repetition |
| `lottie-track-keyframes.ts` (204) | Keyframes to WAAPI, with easing and holds | x only (`y` is hard-wired to 0); must end at a release followed by physics |
| `celebration-snapshots.ts` (303) | Prepare, attach, start and stop; inert clones; restore-once | none for `starter-card`; a word needs a text-run copy |
| `borrow-targets.ts` (232) | — | Cat heuristics; no single card ranking; no word |
| `pack-scene-adapter.ts` (105) | The seam | Adapter selection is hard-coded; `PackScenePreparation.borrow` is typed for the Cat |

### Constraints

- **Portfolio rules** (`openspec/specs/celebration-migration-portfolio/spec.md`):
  - the generator never runs in the adapter or in themes
  - the authored asset is the source
  - a new adapter is justified by line counts before any asset is published
  - batches stay independently reversible
- **Themes retention.** At most three versions per pack. `new-year-default` holds `1.0.0`, `1.1.0` and `1.1.1`, and every index revision from 2026-11-12 to 2026-11-20 names `1.0.0`.

## Goals / Non-Goals

**Goals:**

- **One adapter, two consumers.** One adapter whose rules carry no scene name. SnowmanDelivery is the first consumer, and a `composer-word` probe proves that ReindeerTakeoff could be the second.
- **Spike before scale.** Go or no-go on measured contact, timing, size and cost before the full asset and the capability ship.
- **Parity.** Visual parity with the compiled scene, within the deltas recorded below.

**Non-Goals:**

- Retargeting arbitrary properties, IK, or evaluating Bézier curves in the browser.
- Physics on copies: copy-track v1 has no fall.
- A slot system for other characters. Any third role or stage is a new capability ID.
- Touching the compiled SnowmanDelivery or `interaction-cat-borrow-v1`.

## Decisions

### D1. Split between the asset and the code

| Concern | Compiled today | External path |
| --- | --- | --- |
| Artwork (snowman, sled, scenery, branch, present, particles) | `snowman-delivery-art.ts` | asset: shape layers |
| Body, arm, face and squash motion; all beat timing and easing | generated keys | asset |
| Arm grips | IK per sample | asset: authored at reference card height (delta V1) |
| Stage choice and floor line | `getSnowmanDeliveryTargets` | **code**: generic stage templates (D4) |
| Slide length and the anchors beyond it | layout search plus `flightFor` | **code**: span solver over two authored references (D7) |
| Station positions | `world()` per key | **code**: bind, stretch and follow (D6) |
| Card or drawn sled | `hasCard` branch | asset: spliced windows plus `ct-if:` layers. **Code** picks the section (D5) |
| Step counts | `walk()` subdivision | **code**: cycle repetition through the time remap (D8) |
| Card copy motion | derived from the sled | asset: `ct-track:copy` track. **Code** binds it and converts it to WAAPI (D9) |
| Discovery, snapshots, observers, interrupts, restoration | scene code | **code**: existing helpers |

Code authors no pose, no beat time and no keyframe count. Geometry enters only through:

- the stage
- the span length
- anchor values
- cycle counts
- the copy's rect

### D2. Asset structure

```
root (w×h stage, op = 25 s)
├─ anchor:<name>                  static nulls: reference anchor points, in stage coordinates (D3)
├─ anchor:<name>@min              static nulls: minimum-span references of stretchable anchors
├─ <base>#<kind>[,<kind>…]        static or travel nulls: one section's own references, follow position or travel (D6)
├─ ct-band                        static shape slot: the cast band's vertical extent at the reference floor
├─ ct-follow:far                  null: tree, branch, needles, present-placed, sneeze puffs
├─ ct-follow:span-end             null: snowbank and spray
│                                 (the far group also carries the ground strip's end piece; the pieces overlap at shorter spans)
├─ ct-follow:entry-edge          null: the ground strip's start piece, long enough to meet the far piece at the maximum span
├─ ct-travel                      null: the actor's travel in walk windows (linear, composition time, D8)
└─ ct-actor                       precomposition slot, parented to ct-travel (st 0, no authored tm).
   │                              The adapter writes `tm` here
   ├─ ct-track:root               null: snowman stations (linear spatial path, no tangents)
   │  └─ ct-facing                null: hold keyframes on x-scale ±100
   │     └─ snowman art           body, scarf, head, arms, present-held …
   ├─ ct-track:foot-front, ct-track:foot-back      nulls: feet in actor space
   ├─ ct-track:head-free          null: the flying head
   ├─ ct-track:sled               null: sled corner and rotation, the parent of the drawn sled
   │  └─ ct-if:no-copy sled       shape layer: the drawn sled
   └─ ct-track:copy               null: the copy's centre track in actor space (x, y, rotation, opacity)
      └─ ct-if:copy card-ref      invisible reference rectangle at the reference card size
```

- **Actor size.** As in S4, `ct-actor` is 4096 × 4096 with anchor (1000, 1000), because `lottie_light` clips a precomposition to its own size.
- **One remap for the actor.** Everything the snowman moves or carries sits inside `ct-actor`, so one time remap applies the splices (D5) and the step cycles (D8) to all of it at once.
- **The scenery stays at the root.** It has no splices or cycles. A fill has the same length as its cut, so trunk time equals composition time everywhere at the root.
- **Hidden layers.** An invisible reference layer keeps layer opacity 100 and a transparent fill, as `cat-paw` does, because `lottie_light` drops a layer whose opacity is 0.
- **Partly visible art.** A layer the trunk or a fill shows only part of the time (the flying head, the held present) stays one full-length layer. Hold opacity keys show it where its source does, so its keys merge like any other and its track null carries them. A copy per fill would cost a layer each and leave the copy outside its track.

### D3. `ct:` marker grammar

Markers are in actor-local frames, with plain-text `cm`. Every argument comes from an enumeration, as `lottie-markers.ts` requires.

| Marker | Duration | Meaning |
| --- | --- | --- |
| `ct:section:<kind>` | — | Declares a section, in priority order. `<kind>` is one of `ledge-card`, `rim-card`, `rim`, `platform`, `rim-word`. A kind names its stage and its role: `-card` means `starter-card`, `-word` means `composer-word`, and no suffix means no copy |
| `ct:trunk` | the trunk length | The shared story, played by every section outside its splices |
| `ct:cut:<kind>` | range | A trunk range that `<kind>` replaces |
| `ct:fill:<kind>` | same as its cut | The replacement window, stored after the trunk. The n-th fill pairs with the n-th cut of the same kind. Two kinds may share one fill window, but only exactly (`rim` and `platform` share the drawn-sled story) |
| `ct:bind:<anchor>` | range | Track keyframes in the range translate to `<anchor>` |
| `ct:stretch` | range | Track keyframes interpolate between the bind ranges on each side (D6) |
| `ct:cycle:<n>` | one cycle | A repeatable step cycle. `<n>` is the slot number, 0–7 |
| `ct:cycle-window:<n>` | range | The range the cycle repeats over: wholly in the trunk, or wholly in one fill, never across a cut boundary (D8) |
| `ct:entry` | — | The copy becomes visible and the original fades out |
| `ct:restore` | — | The copy fades and the original returns |
| `ct:contact:<k>` | — | A contact instant. `<k>` is one of `grip`, `seat`, `impact`, `lodge`, `slot`, `catch`. Used by the checks and the tests |

The anchor vocabulary is generic travel geometry, not scene parts. Each anchor is derived by the stage template or the span solver:

| Anchor | Derived from |
| --- | --- |
| `entry-edge` | stance minus the authored entry distance, clamped to the welcome bounds |
| `stance` | the stage template's stance point |
| `copy` | the copy rect's near-bottom corner. Only for card kinds |
| `span-start` | the start of travel. Stretchable |
| `span-end` | the end of travel. Stretchable |
| `far` | the point beyond the span. Stretchable |
| `exit-edge` | the same as `entry-edge` |

Stretchable anchors have both `anchor:X` (maximum span) and `anchor:X@min`.

**Section overrides.** A root null named `<base>#<kind>[,<kind>…]` replaces `<base>` for the named sections only. `<base>` is a stretchable reference (`anchor:X` or `anchor:X@min`), a follow group (`ct-follow:<anchor>`, its position) or `ct-travel` (its keyframes). Overrides are unparented, name declared sections, and are dropped from the prepared composition (D6).

**Why markers.** They keep every timing in the asset, where an author retimes it, and add no manifest field. The profile already reserves marker names for adapters (`celebration-lottie-authoring-profile`). Validation is identical in the themes check and at runtime.

### D4. Stage templates

The rules are lifted from `getSnowmanDeliveryTargets`, are expressed in native units times the placement scale, and are owned by the capability ID.

| Stage | Applies when | Floor | Stance | Band |
| --- | --- | --- | --- | --- |
| `ledge` | The starter row's top is at or below the composer's bottom, or there is no composer. A bottom-row card is resolved | card bottom + card height + `ct-band` reach (130 native) | card near edge − `dir`·14 | from the card bottom down to the floor plus the band's lower extent; the starters rect is ignored |
| `rim` | A composer is eligible under S3's rules. For a card kind, a bottom-row card lies 40–128 native above the floor and no other button is in the band | composer top − 4 | card near edge, or composer start + 40 when there is no copy | `ct-band` above the floor; the heading must not intersect |
| `platform` | There is any host content | lowest host bottom + 150 + 12 px | centre − `dir`·action width / 2 + `dir`·40 | from the lowest host bottom to the floor |

- **Preferred side.** The supplied direction sets it: LTR travels toward inline end. The other side is tried next.
- **The `rim-word` stage.** It uses the `rim` floor, with the stance at the word rect's near edge. That matches ReindeerTakeoff's catch point (`reindeer-targets.ts`).
- **Why not a declarative stage language.** A manifest-side language would amount to selectors and parameters, which the contract forbids. Fixed templates keep the asset declarative and the rules testable.

### D5. Section choice and splicing

- **Choice.** The adapter evaluates sections in their `ct:section` order and plays the first one whose stage qualifies, whose role resolves, and for which the span solver finds a span.
- **The time remap.**
  - The section path is the trunk, with each cut replaced by its paired fill. Because a fill has the same length as its cut, every trunk beat after a splice keeps its composition time.
  - The path is built with `buildSectionPath` over the trunk pieces and the fill ranges, extended for pairs.
  - The cycle repetitions (D8) are applied to that path.
- **SnowmanDelivery's splices.** The trunk is the `ledge-card` story.
  - `rim-card` replaces the pickup window (3.85–6.05 s, reach instead of jump) and the slot return (22.55–23.5 s), where its card goes back to the row above the composer.
  - `rim` and `platform` replace the story from the pickup to the end of the trunk (3.85–25 s) with the rig-sized drawn sled's, and show `ct-if:no-copy`. The fill runs to the trunk's end because the rig-sized sled is put back elsewhere, so the snowman leaves from another place: a splice at 23.5 s would pop him by 88 units on desktop and 146 on mobile. The compiled `rim-sled` and `platform` draw a 70 × 16 native sled, not a card-sized one. A card-sized sled made these sections about 86 px (desktop) and 100 px (mobile) longer than the compiled ones, so on phones they fell to the poster. The two sections share one story fill and lay out from their own references (D6), about 1,000 keyframes per variant (issue owner, 2026-11-23).
- **Pose matching.** The checker compares the actor's transforms at each cut boundary, within 0.25 native units and 0.25°.
- **Two remaps.** `ct-actor` gets the splices and the cycles. The root layers need no remap (D2).

**Alternatives considered:**

- **One whole story per section.** Four full 25 s stories would hold about 4 × 1,300 keyframes, more than the 4,000-keyframe cap, before the mobile variant is even counted. Only the drawn-sled geometry differs enough to need its own story, and its two sections share it.
- **Separate assets per stage.** The stage would have to be chosen before the data loads, and the 32-asset cap would be spent quickly.

### D6. Bind, stretch and follow

These rules apply to every `ct-track:*` null and to `ct-travel`. A shape's path cannot stretch, so the ground strip is two overlapping pieces on the `entry-edge` and `far` follow groups. Actor tracks are bound in stage coordinates: their authored actor-space value plus the authored travel at the key's time is bound, and the bound travel at that time is subtracted again (D8).

- **Side.** The story always travels toward +x on the stage. When the stage solver picks travel toward −x, the adapter mirrors the whole stage through the anchor mapping's `isMirrored`, converts the measured anchors through the mirrored mapping, and binds with σ = 1. Copy tracks are mirrored back in their WAAPI keyframes (x and rotation), so copies are never flipped. Per-range sides, which the Cat needs, are not used.
- **Bind.** `v' = A + (v − R)`, S4's formula with σ = 1. `A` is the measured anchor in stage units, and `R` is the reference null.
- **Stretch.** A key between bind ranges `P` (before) and `N` (after) gets the displacement
  `d = d_P + (d_N − d_P)·w`, where `d_X = A_X − R_X` and `w` is the key's own track's progress across the range: 0 at the track's value where the range starts, 1 at its value where `N` starts.
  - On the glide, the seat moves with `span-start` and the impact with `span-end`, and the 0.04·L and 0.10·L push keys keep their proportion of the span.
  - The sled corner sits about 116 units behind the seat. With its own progress it still moves in step with the seat. A weight taken from its authored x would leave it about 75 units behind at the minimum span.
  - A track that does not move across the range, such as the body and feet during the head flight, has `w = 0` and stays with `P`.
- **Rest.** A track keyframe equal to the one before it keeps that keyframe's bound value. Between 15.5 s and 21.0 s the snowman stands by the tree (`far`) while the card lies at the crash (`span-end`). Time ranges that apply to every track cannot express that. The rest rule can, and it is also the physically right behaviour: a still object never jumps.
- **Follow.** A `ct-follow:<anchor>` null's static position is translated by `d_anchor`. Its children keep their authored offsets.
  - The snowbank follows `span-end`, so the sled front meets it at impact, as `snowbankX = front + 9·s` does today.
  - The tree, branch, socket and needles follow `far`, so the head lodges in the socket.
- **Section references.** The solver, the binds, the stretches and the travel use the chosen section's references, its overrides in place of the base nulls. Follow groups and the band stay authored against the base references: a follow group moves to its measured anchor plus its offset from the base reference, and the band reaches past `far` by the base overhang. The snowbank group overrides its position for `rim` and `platform`, because the rig-sized sled's front is nearer the seat than a card's (`seatFromFront` 30 native against a quarter of the card).

Keyframe times, easing and count never change. An unbound key is malformed. `lottie-anchor-binding.ts` gains the track list, stretch and follow. Its existing single-null API stays a thin call for the Cat.

### D7. The span solver

- **References.** The asset authors every stretchable anchor at the maximum span (desktop 460 px, mobile 220 px, divided by the placement scale) and at the minimum span: 160 px on desktop; on mobile 140 px for the card sections and 100 px for the drawn-sled sections, through their overrides.
- **Placement.** For a candidate span L, each stretchable anchor is placed by linear interpolation between its two references. Every minimum lies where the compiled `flightFor` is proportional to L, so `far` scales exactly as it does. A mobile card's `minimumFlight` (a quarter of the card plus 4) would clamp the flight below 124 px; the compiled scene then lengthens the flight time, which fixed keyframes cannot, so the head would launch up to 38 % faster than the sled. Mobile card sections therefore start at 140 px (delta V9, issue owner 2026-11-23).
- **Search.**
  - L runs from the maximum down to the minimum in 8 px steps, on the preferred side first and then on the other.
  - L is accepted when the sled's rear edge is at least 8 px inside the welcome bounds, the band from `entry-edge` to `far` + 34·s fits under the viewport bottom and above 0, and the band intersects no host rect the stage forbids.
  - This is the compiled `layout()` search, with its constants expressed against the authored references.
- **No fit.** When no span fits, the stage does not qualify.

### D8. Step cycles on a treadmill

The remap replays the same keyframes on every repetition. So a cycle cannot carry the actor forward by itself: repeated root keys would snap back at every cycle. The travel is therefore split out of the cycle.

- **Authoring.**
  - A walk window is authored as one in-place cycle inside `ct-actor`. The body bobs, and each foot plants and slides back by one stride in actor space, like a treadmill.
  - The forward motion is on `ct-travel`, a root null that the actor precomposition is parented to.
  - `ct-travel` moves linearly over the window, holds outside every walk window, and keeps its value between windows.
  - The cycle is marked with `ct:cycle:<n>` and its window with `ct:cycle-window:<n>`.
- **Repetition.**
  - The actor's remap repeats the cycle `k = max(1, round(D / stride))` times inside the window, where D is the window's measured travel after binding. Each repetition maps the cycle's actor-local range onto `window / k` of composition time.
  - `ct-travel`'s two keys at the window's ends are bound like any track, so it covers D in the window's fixed time.
  - A planted foot's world velocity is the travel speed minus the treadmill speed, `D/T − k·stride/T`.
  - **Stride scale.** The cycle's track keys keep their times, and their x offsets from each track's key at the cycle start are multiplied by `D / (k·stride)`, so the treadmill speed equals the travel speed and a planted foot stands still. The cycle stays closed, because its last pose equals its first. A phone's walk holds only three to five stances, where rounding alone slid a foot up to 6 px (issue owner, 2026-11-23).
- **No keyframe is generated.** The cycle keys are replayed by the remap. The travel keys are only moved.
- **Binding actor keys.**
  - An actor key outside a cycle is bound in stage coordinates: its authored value plus the authored travel at its composition time is bound, and the bound travel at that time is subtracted.
  - A key inside a cycle uses the travel at the window's start, because its pose is relative to the travel.
- **Bounds.**
  - k is at most 24 per window. The residual foot slide per stance is at most `|D − k·stride| / k`, which is at most stride / (2k).
  - Rounding keeps `|D − k·stride|` at or below stride / 2, so the slide over the whole window is at most about 15 px at the reference stride of 30.6 px (34 native × 0.9).
  - Without the stride scale that is at most 2 px per stance from k ≥ 8, about 3 px at the minimum desktop span (k ≈ 5) and up to 6 px on phones. With it, the residual is the interpolation error only: at most 0.7 px measured over every mobile span from 100 to 220 px.
- **Which windows.** Only SnowmanDelivery's return carry (21.85–22.55 s) covers a variable distance, about the span. The entry, seat and exit walks cover nearly constant distances and are plain bound keys. The carry lies inside the story that `rim` and `platform` replace, so their drawn-sled fill declares its own cycle window and its own `ct-travel` override, and a trunk window inside a cut plays only for sections that keep that range.

**Alternatives considered:**

- **Stretching the authored steps.** Feet would slide by up to 2.9× the stride at the maximum span, which breaks "planted contact" in `new-year-snowman-delivery`.
- **A slide instead of steps.** An art change that weakens planted contact. The issue owner rejected it on 2026-11-22.

### D9. Copy roles and 2-D copy tracks

**`starter-card`.** It reuses the compiled eligibility rules as adapter rules:

- at most four starter buttons
- enabled, unfocused, not hovered or active, untransformed
- 36–240 × 24–96 px, unclipped, in the viewport, at most 40 nodes
- a bottom-row card, nearest the entry side
- **New:** the width must be within 0.75–1.5 × the reference card width, so that the authored grips land within the card (delta V1). With the 162 px reference this is 122–243 px, which the 240 px limit caps where the compiled scene does. It was 0.9–1.1 after amendment 3a.3, but the production starters on the local host measured 183, 303 and 288 px, so no card qualified where the compiled scene borrows the 183 px one (issue owner, 2026-11-23)

The copy is made by `prepareCelebrationSnapshots`: it is cloned during preparation, attached hidden on `onAnimationCreated`, and started on `timelineZeroMs`.

**`composer-word`.** The measurement and copy logic of `reindeer-text.ts` (first `\S{1,32}` run, opaque background, hidden mirror, cover plus span) moves into a shared internal module. ReindeerTakeoff imports it unchanged, and its suite guards the move. The adapter wraps it in the same prepare, attach, start and stop session shape as the snapshots.

**Tracks.** `lottie-track-keyframes.ts` gains a second mode. It reads x, y, rotation and opacity, and it ends at `ct:restore`, with no release and no physics. The existing release mode stays for the Cat. For each keyframe:

- `offset = t_comp / duration`
- the easing becomes `cubic-bezier(...)`, and a hold becomes `steps(1, end)`
- each authored key is emitted once per remap piece that shows it, so a key inside a cycle appears once per repetition
- `translate(dx, dy)` is measured from the original's centre after binding, and the rotation comes from the mirrored track

**Travel.** The copy's track is in actor space, so the copy's wrapper gets a second WAAPI animation: `ct-travel`'s bound keys as `translate(dx, 0)`, linear, on the same `timelineZeroMs`. The nested transforms compose the way Lottie's parenting does, with no sampling and no Bézier evaluation. `celebration-snapshots.ts` and the text-run session gain an optional wrapper track for this.

`hideAt` is `ct:entry` and `restoreAt` is `ct:restore`. Copies are never scaled or mirrored. A card wider than the reference keeps its own width, which the eligibility band bounds.

**Not a role:** the textarea itself. The `composer-word` copy never touches the textarea, as `reindeer-text.ts` promises today.

### D10. The spike, the gate and its thresholds

**Scope.** The spike runs these segments of SnowmanDelivery:

- the trunk from entry to lodge: the jump pickup, the ride at the minimum and maximum span, the impact, the head flight, the lodge
- the `rim` drawn-sled pickup splice
- one return-walk cycle window

Separately, a `rim-word` probe plays a minimal ribbon and word track.

The spike asset is bootstrapped by D11 and committed as a fixture. **There is no browser run** (issue owner, 2026-11-22). The gate is measured on data: the adapter prepares the fixture in jsdom against synthetic hosts, and a gate test evaluates the prepared Lottie properties at the marker frames. `SUPPORTED_CELEBRATION_CAPABILITIES` is unchanged until go, and no story enables the capability.

**Thresholds**, fixed before the spike runs. "Unit" means stage units of the prepared data, converted to CSS px at the placement scale.

| Criterion | Threshold |
| --- | --- |
| Binding exactness | At every `ct:contact` marker, every track's bound position keeps its authored offset from the anchor it is bound to within 2 CSS px, in 16 cells: 1024/1280/1440/1920 px × LTR/RTL × the `ledge-card` and `platform` sections |
| Head flight | The head's speed at separation is within 20 % of the sled's, from the bound keys. It lodges within 2 px of the bound far anchor |
| Planted feet | In the cycle window, the world position (actor + travel) of a planted foot moves ≤ 4 px per stance, at the longest and the shortest span the cells produce. Raised from 2 px by the issue owner on 2026-11-22 (delta V3) |
| Card return | The copy's WAAPI keyframes are within 0.5 px and 0.01° of the original between `slotted` and `ct:restore` |
| Word probe | The prepared word copy starts on the original word. The textarea's value, selection, focus and attributes are unchanged. Typing cancels in the same task |
| Code (non-empty, non-test lines) | The new copy-track adapter plus the new or changed generic lines are ≤ 1,560, which is half of SnowmanDelivery's 3,123 scene-specific lines at `f416f8c69` |
| Asset (projected full scene) | Per variant: ≤ 512 KiB, ≤ 30 layers, ≤ 4,000 keyframes, ≤ 8,000 vertices |

**Rows dropped with the browser run** (issue owner, 2026-11-22): the long-task recovery, rendering cost, heap retention, preparation p95 under throttling, and the reviewer watching normal-speed playback. The gate result states that these were not measured.

**Outcome.**

- **Go** means every row passes. A row may be amended only by the reviewer, with the reason recorded under "Gate result", as S4 did for its code and asset rows.
- **No-go** means:
  - record the measurements and failing rows here and on #9226
  - delete the spike adapter and its fixtures
  - keep only generic changes that an existing caller uses
  - leave the compiled scene as it is
  - the SnowmanDelivery row returns to `retain` with reason `adapter-pending`, reopening on the failing row

### D11. Bootstrapping the asset without keeping a generator

A throwaway script runs once and is never committed. It stays in the scratchpad, as in S4 D10.

1. It calls `getSnowmanDeliveryTargets` and `buildSnowmanDeliveryComposition` on synthetic hosts at reference geometry, for each section kind, at both the maximum and the minimum span, on desktop and mobile.
2. It rewrites the world-baked layers into the D2 structure:
   - the rig, feet, head, sled and copy tracks become `ct-track:*` nulls in reference coordinates
   - the scenery is split into the `ct-follow:span-end` and `ct-follow:far` groups
   - the art precomposition is kept
3. It writes the `anchor:*` references. The minimum-span run supplies each `@min` value.
4. It writes the trunk from `ledge-card`, the fills from the other kinds over the D5 windows, and one cycle per walk window.
5. It decimates the tracks (0.2 px, 0.25°, 0.01 opacity), writes the markers, and verifies the pose match at each cut and cycle boundary.

The output is reviewed in the pinned player and becomes the authored source: the fixture first, then the themes files. Afterwards, nobody regenerates it from code.

The poster is `SnowmanDeliveryStill` exported as SVG, at most 100 KiB.

### D12. Integration in the library

- **Selection.** `resolvePackSceneAdapter` gains a copy-track branch. `isCelebrationSceneSupported` gains the D-spec rules: anchored only, `direction: none`, at most one `interaction-*` capability.
- **Preparation payload.** `PackScenePreparation.borrow`, typed for the Cat, becomes an adapter-owned `companion` payload. Each adapter reads only its own. The cat adapter is updated mechanically, and its suites run unchanged.
- **Environment.** `PackSceneAdapterEnvironment` gains the supplied direction, read from `LottieScene`'s existing direction input. This is the only new input. It comes from `CelebrationVariantContext`, which the host already supplies.
- **Bundle.** Everything stays in the `packs` chunk. `lottie_light` stays a separate dynamic chunk, and the entry is untouched.
- **Host isolation.** The adapter reads only `CelebrationAnchors` class names and the direction. Loaders, the allowlist, the delivery mode and URLs stay in `apps/chat/src/context/CelebrationHost.tsx`, `apps/chat/src/hooks/celebration/useCelebrationPacks.ts` and `apps/chat/src/utils/celebration-pack.ts`. `apps/chat` needs no change.
- **i18n.** The scene uses `labelId: snowmanDeliveryToastMessage`, which already exists, so no key is added.

### D13. Publication in Themes, and the retention window

**Checker.** `scripts/check-celebration-packs.mjs` is extended:

- `interaction-copy-track-v1` is added to `CAPABILITIES`
- the combination rules become "at most one `interaction-*`, anchored, `direction: none` for cat-borrow and copy-track"
- a `checkCopyTrack` validates the D2 slots, the D3 grammar and order, splice pairing and duration, bind coverage, both references, cycle closure, the pose match and the caps
- tests and a README section are added, as for cat-borrow

**Manifest.** `new-year-default@1.2.0` carries `bullfinch-couriers` and `gift-wrapping` unchanged, plus `snowman-delivery`:

- **Variants.** Desktop and mobile JSON, plus the poster.
- **Placement.** `composer-anchor-v1`, with `scale.min = scale.max` per variant (0.9 desktop, 0.68 mobile), `fallback: stage-anchor` and `direction: none`.
- **Timing.** `playbackDurationMs` is 25,000. `maxLifetimeMs` is 27,500, the compiled `SNOWMAN_DELIVERY_MS + 2500`.
- **Capabilities.** `requiredCapabilities` lists `lottie-light-svg-v1`, `composer-anchor-v1`, `interaction-copy-track-v1` and `static-poster-v1`.
- **Index.** `defaults.new-year` moves to 1.2.0, and the revision is bumped.

**Retention blocks 1.2.0.**

- The checker allows three versions per pack, and it also requires every version directory to be listed in `index.json`. The README says to delete an older version, together with its index entry, in a separate change, "only once no `index.json` revision from the last 30 days names it".
- Read literally, that can never hold, because the entry has to stay until the directory is deleted. The issue owner chose the coherent reading on 2026-11-22: the 30 days run from the last index revision whose `defaults` named the version.
- `defaults.new-year` left `1.0.0` in `aafdbd2` (2026-11-18). So `1.0.0` may be deleted from **2026-12-18**, in its own Themes pull request. `1.2.0` follows in the next one.
- Until then, the spike, the library, the fixtures and the Storybook and browser evidence proceed from committed fixtures. Only the deployed-environment run waits.
- A one-off retention exception is the Themes owner's decision. It is not assumed here.

### D14. Measuring what stays in code

Counts use the `celebration-migration-baseline` rule and the batch 0 counting script, read from git objects at the merge revision:

- SnowmanDelivery's scene-specific lines: 3,241 physical and 3,123 non-empty at `f416f8c69`
- the new copy-track adapter
- the new or changed generic lines, counted once
- the asset size and keyframes per variant

The net removal is reported as available once the compiled scene is deleted after S8. It is not claimed now. The figures go on #9226 after the user approves the draft.

### Recorded visual deltas (to confirm in review)

| ID | Delta | Why it is accepted |
| --- | --- | --- |
| V1 | Grips are authored at the reference card size, and the copy follows the reference card's centre. Cards outside 0.75–1.5 × the reference width use the drawn sled. On a wider eligible card the hands sit inside its edges and its front edge enters the snowbank by half the extra width: about 10 px at 183 px, at most 39 px at 240 px | No IK in the browser; accepted by the issue owner on 2026-11-23 |
| V2 | The head's flight time is the authored one at every span, where the compiled scene lengthens it on short spans. Every authored minimum keeps `far` proportional to the span, so the head still launches at the sled's speed (V9) | Bounded by the head-flight row in D10 |
| V3 | Step cadence comes from a rounded cycle count, and the stride is scaled by `D / (k·stride)` to match it: within ±1/(2k), up to about ±17 % on a phone's three stances. A planted foot slides at most 0.7 px per stance | The walk lasts 0.7 s; the 4 px threshold was accepted by the issue owner on 2026-11-22, the stride scale on 2026-11-23 |
| V4 | `rim-card` always reaches. The compiled scene jumps when the card bottom is more than 124 native above the floor, so such cards use the drawn sled | Rare layout, and the story is unchanged |
| V5 | The reduced-motion and failure poster sits at the bottom centre, as for every anchored pack scene, while the compiled still uses `w-52 h-32` | Same art |
| V6 | S3 composer eligibility (height 36–260, 12 px margins, minimum width) applies to `rim`, so edge layouts fall to `platform` | Same rules as the other anchored scenes |
| V7 | Particle counts follow the variant (desktop 6 + 4, mobile 2 + 2), fixed in the asset | Same as compiled |
| V8 | A cycle's stride varies with the span (V3), where the compiled walk changes its step count | Planted feet matter more than stride length in a 0.7 s walk |
| V9 | Mobile card sections need a span of at least 140 px. On phones about 390 px wide or narrower, a host whose card the compiled scene borrows plays the drawn-sled `rim` or the poster instead | The head keeps the sled's speed; accepted by the issue owner on 2026-11-23 |

## Risks / Trade-offs

- **[The fills exceed the keyframe or layer cap.]** → The spike projects the count per variant. The art is shared through one precomposition, and the tracks are decimated. If the cap is still exceeded, the gate decides between a `celebration-pack-contracts` caps delta and no-go. The asset is never published over a cap.
- **[A pose pops at a splice or cycle boundary.]** → The bootstrap writes identical poses. The checker compares the transforms within tolerance, and the reviewer watches at normal speed.
- **[Stretch distorts motion that must stay rigid during the glide.]** → Only `ct-track:*` nulls stretch. The art keeps its authored local motion, and the spike's contact cells cover both span extremes.
- **[The generic grammar grows past the code budget.]** → The code row in D10 caps it. If the row fails, the reviewer either amends it with a reason, as S4 did, or chooses no-go.
- **[Moving `reindeer-text.ts` regresses ReindeerTakeoff.]** → The move is mechanical, and ReindeerTakeoff's component, target and composition suites run unchanged.
- **[`PackScenePreparation` refactor regresses the Cat.]** → The rename is mechanical, and the cat-borrow suites and the S4 browser specs run unchanged.
- **[Real starter cards are wider than the eligibility band.]** → The spike measures the real starter buttons at 360–1920 px. If most fail, a second reference width becomes a fill instead of a narrower band. That decision is recorded at the gate.
- **[The retention window delays the deployed run past the start of the season.]** → The fixtures and Storybook carry all the evidence except the deployed run. `1.0.0` becomes deletable on 2026-12-18. Rollout is S8 regardless.
- **[Cross-repository order.]** → Publishing 1.2.0 before Chat ships the capability is safe: older clients keep the compiled SnowmanDelivery (spec "Older client").

## Migration Plan

1. Record the Themes retention date: `1.0.0` is deletable from 2026-12-18 (D13).
2. In Chat, run the spike and record the gate result here. On no-go, clean up as D10 says and stop.
3. On go, land the library: the capability, the adapter, the generic extensions, the seam refactor, the `reindeer-text` move, the fixtures, the stories and the browser specs. It stays inert under `bundled`.
4. From 2026-12-18, delete `1.0.0` in its own Themes pull request, then publish `new-year-default@1.2.0` and bump the index.
5. In a test environment, set `UI_EVENT=new-year`, `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=new-year/gift-wrapping,new-year/snowman-delivery`. Capture the evidence protocol, then check rollback.
6. Production rollout is S8 (#9227).

**Rollback:** remove `new-year/snowman-delivery` from `UI_EVENT_EXTERNAL_SCENES` and bump `UI_EVENT_DELIVERY_REVISION`, or point `defaults.new-year` back to 1.1.1. The library changes are additive.

## Open Questions

- Where should binary evidence (recordings, contact frames) be stored durably? This is S0's open question 2. Until it is answered, follow S3 and S4: attach it to a #9226 comment and commit the summaries under this change.

## Gate result

**Decision: go, with amendments (reviewer, 2026-11-22).**

- The code row is accepted as measured. The adapter authors no pose, timing or keyframe count, and its generic parts serve later batches, as S4 argued for the Cat.
- The asset row is amended on three conditions, all met before any publication:
  - a `celebration-pack-contracts` caps delta raises the layer cap to fit the measured structure
  - fills are encoded by splitting boundary Bézier segments exactly and keying only the properties that differ from the trunk, so the full asset fits 4,000 keyframes and 512 KiB
  - the reference card is matched to the production starter size, with a width and height band
- The dropped rows stay unmeasured.

Measured on data at Chat `f416f8c69` with an uncommitted working tree. The spike fixture `copy-track-snowman-spike.lottie.json` is desktop only. The gate test is `copy-track-gate.spec.ts`, with 64 checks in 16 cells: 1024/1280/1440/1920 px × LTR/RTL × `ledge-card`/`platform`. The cells produced spans of 324–460 px. The 160 px minimum span was not reached.

| D10 row | Result |
| --- | --- |
| Binding exactness | ✅ 0.000 px in every cell for grip, seat, impact and catch. The pairs are root–card, card–snowbank and head–root. **Caveat (delta V1):** this proves only that the binding is consistent. The DOM copy keeps the real card's size, while the hands are authored for the 140 px reference card. Real starter buttons on the `ConversationInput` host measured 151, 164 and 172 px, so a hand on the far edge misses by up to about 16 px. The full asset needs a reference matched to the production starter size, plus a height band |
| Head flight | ✅ head speed within 1.9–4.7 % of the sled's; the head lodges in the socket within 2 px |
| Planted feet | ✅ at most 1.74 px per stance with the 140 px reference card. After amendment 3a.3 (162 px reference), it is 3.83 px at 1024 px on the platform, within the 4 px threshold the issue owner set |
| Card return | ✅ copy plus travel is within 0.5 px and 0.01° between `slotted` and `ct:restore` |
| Word probe | ✅ copy and cover on the original word; textarea value, selection, focus and attributes unchanged; typing cancels in the same task (`copy-track-adapter.spec.ts`, `text-run-copy.spec.ts`) |
| Code | ❌ about 2,437 non-empty lines against the 1,560 threshold: 1,931 new, plus 694 added to modified modules, minus 188 moved out of `reindeer-text.ts`. That is 78 % of SnowmanDelivery's 3,123 scene-specific lines. The adapter alone is 703 lines; the cat's was 543 |
| Asset | ❌ The spike is 280 KB, 3,103 keyframes, 225 vertices and **40 layers** against the 30-layer cap. One fill costs 1,568 keyframes, more than the 1,535 of the trunk, because its partial segments are sampled per frame. With the two missing fills (`rim-card` reach and the drawn-sled return), the projection is about 6,200 keyframes and 564 KB, against 4,000 and 512 KiB. Splitting the boundary Bézier segments exactly instead of sampling, and keying only the properties that differ from the trunk, would cut a fill's cost several times over; after amendment 3a.2 (exact slicing, worst error 1.5e-8), a fill costs 234 keyframes and the spike is 1,769 keyframes and 189 KB, so the full asset projects to about 2,240 keyframes |
| Long task, rendering, heap, preparation p95, normal-speed review | — dropped with the browser run (issue owner, 2026-11-22); not measured |

**Full asset (task 5.3, on data, 2026-11-23).** Both variants pass the gate test with 304 checks in 64 cells: desktop 1024/1280/1440/1920 px and mobile 360/390/600/900 px × LTR/RTL × one host per section (`ledge-card`, `rim-card`, `rim`, `platform`). The 16 checks skipped are the metrics of the four cells where the poster is expected.

| Check | Result |
| --- | --- |
| Stage choice | Equal to `getSnowmanDeliveryTargets` on the same host in every cell, except the four V9 cells: at 360 and 390 px on mobile, a card host below the composer plays `rim` where the compiled scene plays `ledge`, and a card host above it shows the poster where the compiled scene plays `rim` (390 px) or its still (360 px) |
| Contacts | Within 2 px in every playing cell: grip, seat, impact and catch for the card sections; seat, sled–snowbank impact and catch for the drawn-sled sections |
| Head flight | Within 20 % of the sled's speed, and lodged within 2 px of the socket, in every playing cell |
| Planted feet | At most 0.7 px per stance on mobile over every span from 100 to 220 px, after the stride scale (D8); 6 px before it |
| Card return | Within 0.5 px and 0.01° for `ledge-card` and `rim-card`, after the `rim-card` slot return fill |
| Reduced motion, missing anchors | Poster only and nothing loaded under reduced motion; without composer and starters the scene plays a drawn-sled section on the stage anchor and copies nothing (`LottieScene.spec.tsx`) |
| Asset | desktop 278,719 B, 3,021 keyframes, 46 layers, 219 vertices; mobile 286,910 B, 3,137 keyframes, 46 layers, 219 vertices; poster 4,362 B. All within 512 KiB, 48 layers, 4,000 keyframes, 8,000 vertices and 100 KiB |

Found and fixed while extending the gate (issue owner, 2026-11-23): the drawn sled at the rig's size with section references; the `rim-card` slot return; the stride scale; mobile card sections from 140 px; keys at the `rim-card` splice edges; a cycle window holding a whole number of cycles.

**Findings fixed during the spike**, folded into D2–D9 and the spec:
- the treadmill for walks
- stretch by each track's own progress
- the resting-object rule
- the travel as a relative carrier
- stage-level mirroring for travel toward −x
- shared fills
- the supplied direction
