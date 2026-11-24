# Proposal

## Why

### Problem

The user wants to try one new local New Year scene with the physical storytelling of Halloween Mummy: an unsuccessful solo attempt to pull the composer away, a second character, a failed joint attempt, a successful removal, and a decorated return. Existing external adapters cannot carry the whole composer out and back. The inspected Chat baseline is development `dd37ad783`; planned S7 copy-track support is not present on this baseline.

## What Changes

### Solution

Author a 28-second external scene, `polar-bears-workshop`, with two polar bears, distinct scarves, readable effort poses, and a glowing garland with baubles. The native Lottie JSON/SVG pack was iterated locally under ignored `tmp/polar-bears-preview/`; the requested companion PR now packages the final assets in Themes. Add the host-independent `interaction-composer-carry-v1` adapter and retain a replayable preview. Decorations disappear after a short final hold, as the user explicitly selected.

Reuse the inert snapshot lifecycle from `libs/celebrations/src/utils/celebration-snapshots.ts:133`, authored copy tracks from `libs/celebrations/src/utils/lottie-track-keyframes.ts:131`, and Mummy's composer eligibility from `libs/celebrations/src/halloween/utils/halloween-mummy.ts:18`. This touches the shared celebrations library, but introduces no app integration: the host still supplies anchors, descriptors and loader callbacks. No new context or state store is needed.

### Alternatives

Extending the compiled Mummy would reuse its geometry but put new artwork and choreography into Chat. Waiting for S7 would block this local trial on an unrelated branch. A bounded out-and-back adapter reuses safe copying now and keeps the scene's authored poses and timing in JSON; it is the chosen approach. Publication compatibility remains separate from this local trial.

### Non-goals

No deployment, new app, migration of existing scenes, persistent input decoration or broad S7 interaction portfolio. The final scope includes Chat and Themes PRs and OpenSpec archival, as subsequently requested. Local skills, environment files and scratch preview tooling remain excluded from Git.

### Acceptance criteria

- Both viewport variants visibly tell the requested solo failure, helper arrival, joint failure, successful removal and decorated return, with grounded grip/effort/recovery poses.
- Production LottieScene plays the local pack; the real input's value, focus and selection survive completion and interruption.
- Native JSON, poster and runtime meet the scene budgets; browser checks cover light/dark, mobile/desktop, RTL, reduced motion and cleanup.
- A local replayable Storybook URL and measured/visual evidence are available. No deployed-path acceptance is claimed.

### Compatibility and rollback

The capability is opt-in and unavailable on older clients, which keep their normal unsupported-scene fallback. Existing scenes and pools are unchanged. Stop using the local descriptor to roll back; no data migration exists. Manifest labels and Storybook controls are English; no new production translation keys are required.

## Capabilities

### New Capabilities

- `celebration-composer-carry`: bounded authored horizontal out-and-back movement of an inert composer snapshot.
- `new-year-polar-bears-workshop`: external scene story, art, variants and performance budget.

### Modified Capabilities

- `celebration-lottie-authoring-profile`: recognize the additional opt-in carry adapter.

## Impact

Chat changes cover the celebrations runtime/adapter tests, library documentation, main specs and this archived change. The companion Themes PR owns final scene assets, publication metadata and matching validation support. Existing HTTP/BFF delivery policy remains unchanged. PR creation does not imply either repository has been merged or deployed.

## Requested visual revision

The user rejected the first bear drawing and jerky movement, and explicitly selected the existing SnowmanDelivery as the visual reference. Redraw the bears with round connected masses, compact limbs, a restrained dark contour, simple faces and broad flat white/blue shading. Add a visible rope-tying action before pulling, followed by slack, tension and recoil. Preserve the two-character plot and decorated return. The first rope revision used the top-center anchor; subsequent feedback rejected that staging. Place the bears beside the measured composer on desktop. For mobile, the user explicitly selected placement below a side corner, retaining the input's size and initial position. Add only an optional measured side/corner slot to the existing carry adapter. Refresh the already authorized local full-stack preview after verification. Keep artistic assessment open when evidence is limited to frames and automated playback.
