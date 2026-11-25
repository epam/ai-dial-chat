# Design

## Context

See proposal.md for the story and gap. Both repositories were clean when inspected. Cat forces gravity after release and copy-track supports one card/word; neither preserves this story. At proposal time the local runtime supported neither the new button capability nor its assets. No deployment is inferred from local support.

## Goals / Non-Goals

The shared player binds small inert props; Themes owns every pose, arc, pause and joke. No procedural animation generation occurs on activation. A one-time bootstrap can seed maintained native JSON/SVG. No new context, routes or controls are needed.

## Decisions

Use one composer-anchored composition with direction `none`: physical button positions determine contact offsets, copied text never mirrors. `bp-stage` is an identity root null carrying the art. One or two `bp-reference:N` static nulls identify authored button centers. `bp-weight:N` scalar opacity tracks (0–100) blend each reference-to-measured displacement into the stage position. Their weights never overlap above a total of 100. This moves actor and prop together during pickup/return, then brings the action back to the authored stage. Each `bp-prop:N` child null supplies independent position/opacity tracks. Shared key times and linear interpolation make copy and contact correspondence exact. All other acting tracks remain ordinary sparse Lottie tracks.

`bp:entry:N` and `bp:restore:N` markers delimit each original's hidden interval. Copies have zero opacity outside that interval, return to their measured centers before restoration, and never scale real content. Each prop has at most 128 keys; identity transforms, finite values, hierarchy and bounds are validated before snapshots. Reuse bounded button discovery, restricted further to 20–64 by 20–56 px, 40 total nodes and no transformed/animated ancestors. At most one button is eligible on mobile. Missing targets use the same authored action at the reference location with a drawn snow clump. Malformed content uses the poster before hiding anything.

The adapter prepares once, uses the existing shared clock, and observes composer/target changes. It reuses reversible snapshot sessions and stops on input, pointer, focus, scroll, viewport change, hidden tab, reset or unmount. There are no per-frame DOM reads or React updates. Geometry and a cached private data copy belong to the existing Lottie session.

The 26-second story is: pickup 0–5; juggling 5–9; interception and hat impact 9–13; fight and belly growth 13–18; oversized ball mishap and moustache 18–22; restoring props and departure 22–26. Art uses navy/cream penguin, red cap, teal scarf and blue-shadowed snow. Broad outlines and articulated flippers/mittens remain readable at mobile scale. First render pickup/effort/reaction before extending choreography. Reference: Cat's contact pauses and SnowmanDelivery's reaction/recovery.

Budget: 2 characters, 2/1 desktop/mobile copies, 40 nodes each, 3 small balls and 1 large, at most 8 impact flecks, 1 player, 48 layers, 2500 keys, 160 paths/1000 vertices, 500 generated SVG nodes, 512 KiB JSON and 30 KiB poster. No masks/filters. Structural limits do not establish frame rate; profile preparation, rAF intervals, long tasks and repeated cancellation separately.

The user requested standard-set integration after the standalone preview. Build `new-year-default@1.5.0` from updated Themes `development` commit `e596746`, preserving every scene, label and asset from `1.4.0`, and select it as the catalog default. Add only Snow Circus and its scene-local capability. Keep the standalone drafts in authoring history, outside the served catalog. Since three published versions already exist, permit exactly the four-version set 1.2.0–1.5.0 until a separate retention change can retire an old version; do not delete recently referenced immutable assets. The New Year event declares Snow Circus and Santa as external secret scenes, so the generic additional-scene path reserves both for `happy new year` and excludes them from gift clicks. With all scenes admitted, the gift pool has five scenes and the secret pool four. Local preview must use the ordinary app configuration and actual catalog, with a process-only allowlist of standard-pack scenes. No translation key, feature flag or telemetry is added.

## Risks / Trade-offs

- Contact retargeting can move the whole action too far: reject unsuitable geometry before borrowing; fall back to drawn snow.
- A constrained grammar costs authoring effort: accept linear shared contact keys and preserve independent eased art tracks.
- Static and frame evidence cannot prove full motion appeal: record what was inspected and leave unobserved artistic acceptance explicit.
- Themes is outside the writable root: prepare all source/pack changes in a temporary checkout and request only the filesystem escalation needed to apply the finished files.

## Migration Plan

Add the capability, validator and authored source; verify the production-player fixture; prepare a hash-addressed local pack. Existing clients omit the unsupported addition. Deploy assets before catalog/policy only in a later authorized release. Rollback removes the scene from the allowlist and restores the previous catalog default without touching older assets.

## Artwork revision after local-app feedback

The user rejected both original characters and requested the SnowmanDelivery / polar-bear style. Reference evidence: `tmp/polar-bears-preview/reference-snowman/native-actor-desktop-5.5.png` and `tmp/polar-bears-preview/evidence-side/authored-7a671954e024/1280-ltr-13.2.png`. Replace heavy navy outlines, isolated oval patches and the snowman's top hat with thin dark contours, broad blue crescent shadows, compact faces and connected soft silhouettes. Snowman uses three snowballs, burgundy scarf and blue mittens; penguin uses a pear-shaped coat, one coherent white face/belly treatment and muted fabric. Keep the story, prop tracks, contact endpoints and full exit. Work in maintained native vector sources, inspect representative pickup/juggle/reaction before packaging, and retain the existing budgets (48 layers / 160 paths / 1000 vertices / 500 SVG nodes). Publish a new local immutable pack version and update the running local preview. Frame and continuous-motion evidence remain distinct.

## Smaller cast and penguin refinement

The user requested smaller characters and clarified that the penguin, not the snowman, needs the style correction. Scale authored stage-space art, reference centers and prop positions together to 75% about (260, 300). Keep the stage identity, prop-null identity transforms, contact weights, times and full-size UI copies. This reduces the cast consistently across layouts without changing shared runtime placement. Snowman contours remain identical. Simplify penguin coat shading, soften its face and flipper contours and reduce facial detail to the reference's compact ink features. Retain the plot and existing numerical budgets; publish the result as local pack 1.0.2.

## Clear oversized-snowball ending

User feedback identifies the ending, starting at the large snowball attempt, as unreadable. Split 16.5–21.8 s into visible preparation, a two-handed supported lift, held anticipation, an unstable wind-up, distinct release and fall, impact pause and gradual emergence from the snow heap. Align mittens with the ball while carried and detach them only at release. Remove the detached flying mitten: impact spray visibly travels to the penguin and leaves the snow moustache. Keep the penguin back from the collision, hold its reaction, and let the snowman emerge head-first from the heap before both restore buttons. This clarifies causality without changing the smaller cast, character drawings, return tracks or overall lifetime. Retain current performance budgets and publish local version 1.0.3.
