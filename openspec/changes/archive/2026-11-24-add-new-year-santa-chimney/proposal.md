# Proposal

## Why

The user rejected the chimney scene during apply and requested a different Santa story grounded in the conversation history. Preserve the selected Santa D drawing with its large round beard. The new comedy is a slipping conversation row, a recovery, gifts delivered at the bottom, and a phone call for a reindeer ride home.

This is a user-directed replacement within the existing apply workflow. The change directory retains its original name; the new asset and scene ID is `santa-history-delivery`. `scope-revision.md` records the superseded local work. Previous chimney checks are not acceptance evidence for this scene.

## What Changes

- Author the complete story as maintained native Lottie JSON/SVG in Themes, with desktop/mobile variants and a poster. Keep Santa D, two reindeer, one sleigh, three presents and one phone. Santa carries a clearly visible gift sack behind his shoulder and keeps his head centered over the torso without a persistent sideways tilt; preserve the face and grip silhouette.
- Correct support and viewport travel: Santa descends the left row edge in LTR; fallback rope reaches beyond the window top; a fixed-scale sleigh enters from the side, brakes for boarding and accelerates with Santa beyond the inline-end edge. Mirror the route in RTL.
- Add `interaction-history-ladder-v1`: measure six safe visible history-row stations, bind authored tracks to them once and move one inert visual row copy on the existing player clock. Never change conversation data, order, navigation or real layout.
- If history is absent, closed or unsuitable, Santa descends an authored rope near the composer, briefly slips and catches the rope, then completes the same gift/phone/rescue ending. The user's latest correction supersedes the previously selected drawn-card ladder. Insufficient room or reduced motion uses a safe poster; if none fits, retain only the festive notification.
- Add Santa to the existing `happy new year` secret pool; gift clicks never select Santa. Preserve all existing click and secret scenes. Delivery remains unpublished until the existing ordinary-pack retention prerequisite is independently satisfied.

## Capabilities

### New Capabilities

- `new-year-santa-history-delivery`: story, artwork, mobile parity, finite cleanup, delivery and verification.
- `celebration-history-ladder`: reusable geometry binding and one inert falling row; no Santa-specific runtime choreography.

### Modified Capabilities

- `celebration-source-selection`: admitted external Santa joins the compiled New Year secret pool instead of the click pool.
- `celebration-pack-contracts`: the compiled event owns routing of admitted additional scene IDs; packs still cannot define a secret phrase.

- `celebration-lottie-authoring-profile`: one explicitly gated interaction on viewport placement, its native slots/markers and safe fallback.

## Impact

Chat changes are confined to the shared pack capability/adapter, production player dispatch, preview fixtures/stories, focused coverage and documentation. Host history hooks already exist in `CelebrationAnchors` and `CelebrationHost`; no new API, provider, routing, i18n mechanism or environment setting is required. Themes owns artwork, poses, timelines, variants, label and manifest. Its checker must validate the new grammar before publication.

Current local sources include the rejected chimney prototype and its generic corner adapter; preserve them while implementing the replacement, then remove unneeded unpublished implementation from the final candidate after dependency review. The source backup is local and is not an OpenSpec archive.

The ordinary `new-year-default` catalog inspected for the preceding implementation retained three versions. Publication remains dependent on a separately eligible retirement and confirmed policy interpretation. Do not delete a version, increase the cap, or create a separate event as a workaround. The accepted implementation is archived and prepared for paired Chat/Themes pull requests. Deployment and ordinary-pack publication remain separate release steps.
