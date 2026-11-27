# Publication record (archived batch 1 task 6.2)

Verified on 2026-11-26 from git objects of `epam/ai-dial-chat-themes` `origin/development`. The last change to `static/celebrations/index.json` there is `900b19a` (revision `2026-11-25.3`, `defaults.new-year` = `new-year-default@1.5.1`).

## Pull requests

| Repository | PR | Merge commit | Merged (UTC) | Index revision | What it did |
| --- | --- | --- | --- | --- | --- |
| `ai-dial-chat` | #9963 | `2c6a8a83f` | 2026-11-23 14:11 | — | Copy-track SnowmanDelivery and `interaction-copy-track-v1` |
| `ai-dial-chat-themes` | #186 | `d5e1775` | 2026-11-23 17:09 | `2026-11-23.1` | Deleted `new-year-default@1.0.0` and its index entry |
| `ai-dial-chat-themes` | #187 | `b170e2a` | 2026-11-23 17:57 | `2026-11-23.2` | Published `new-year-default@1.2.0` with `snowman-delivery`; default → `1.2.0` |
| `ai-dial-chat-themes` | #192 | `2cd5702` | 2026-11-24 16:55 | `2026-11-24.2` | `1.3.0` (Santa); default → `1.3.0` |
| `ai-dial-chat-themes` | #194 | `e596746` | 2026-11-25 07:36 | `2026-11-24.4` | `1.4.0` (polar bears in the gift pool); default → `1.4.0` |
| `ai-dial-chat-themes` | #197 | `900b19a` | 2026-11-25 12:26 | `2026-11-25.3` | `1.5.1` (Snow Circus); default → `1.5.1` |

`1.3.0`, `1.4.0` and `1.5.1` carry `snowman-delivery` on with the same three files.

## The `snowman-delivery` entry as published in `1.2.0` (Themes `b170e2a`)

- `requiredCapabilities`: `lottie-light-svg-v1`, `composer-anchor-v1`, `interaction-copy-track-v1`, `static-poster-v1`
- placement: `composer-anchor-v1` on the composer's top edge, `anchorRect` 240 × 56, `fallback: stage-anchor`; scale 0.9 (desktop) and 0.68 (mobile variant override)
- `direction: none`
- timing: `playbackDurationMs` 25,000, `maxLifetimeMs` 27,500, `loadTimeoutMs` 2,000, `readyTimeoutMs` 250
- poster `new-year-default-snowman-delivery-poster-9a5fcf2229c5f6db`, `posterDurationMs` 4,000

This matches archived task 6.2 (scale 0.9 / 0.68, `direction: none`, 25,000 / 27,500 ms).

## Hashes against the Chat fixtures

Recomputed with `git show <rev>:<path> | shasum -a 256`. The manifest `bytes`/`sha256` entries carry the same values. The fixtures are `libs/celebrations/src/stories/fixtures/copy-track-snowman.*`, pinned in `libs/celebrations/src/utils/tests/copy-track-fixtures.spec.ts`.

| File | Bytes | sha256 | `1.2.0` (`b170e2a`) | `1.5.1` (`900b19a`) |
| --- | --- | --- | --- | --- |
| `snowman-delivery.desktop.e102fb11b63505f4.json` | 278,719 | `e102fb11b63505f431b2f77fb66438cc6f9374242ea23e5c16f16f19187988af` | equal | equal |
| `snowman-delivery.mobile.655cd2599ddb1964.json` | 286,910 | `655cd2599ddb1964fc6c97033ff3d4f6fcb9ed7ffbd676b598c2de5238568f10` | equal | equal |
| `snowman-delivery.poster.9a5fcf2229c5f6db.svg` | 4,362 | `9a5fcf2229c5f6db023c9c9f276f9acad5d961dbd8f46b79cd6ac1a4846dc1df` | equal | equal |

## Themes check on the merged tree

On a clean `git archive 900b19a` extract (the Themes working tree was not touched):

- `node scripts/check-celebration-packs.mjs`: `Celebration packs are valid (0 warning(s)).`, exit 0
- `node --test scripts/check-celebration-packs.test.mjs`: 304 tests, 304 passed

## Retention of `new-year-default@1.0.0`

`new-year-default` on the index, from `git log origin/development -- static/celebrations/index.json`:

| Commit | Date | Revision | Default | Versions listed |
| --- | --- | --- | --- | --- |
| `0cf4b57` | 2026-11-12 | `2026-11-06.5` | 1.0.0 | 1.0.0 |
| `aafdbd2` | 2026-11-18 | `2026-11-18.1` | 1.1.0 | 1.0.0, 1.1.0 |
| `17d8c79` | 2026-11-18 | `2026-11-18.2` | 1.1.1 | 1.0.0, 1.1.0, 1.1.1 |
| `bdd2feb` | 2026-11-20 | `2026-11-20.1` | 1.1.1 | 1.0.0, 1.1.0, 1.1.1 |
| `d5e1775` | 2026-11-23 | `2026-11-23.1` | 1.1.1 | 1.1.0, 1.1.1 |
| `b170e2a` | 2026-11-23 | `2026-11-23.2` | 1.2.0 | 1.1.0, 1.1.1, 1.2.0 |
| `7182236` | 2026-11-24 | `2026-11-23.3` | 1.2.0 | 1.1.0, 1.1.1, 1.2.0 |
| `2cd5702` | 2026-11-24 | `2026-11-24.2` | 1.3.0 | 1.1.1, 1.2.0, 1.3.0 |
| `3b2ad35` | 2026-11-25 | `2026-11-24.3` | 1.3.0 | 1.2.0, 1.3.0 |
| `e596746` | 2026-11-25 | `2026-11-24.4` | 1.4.0 | 1.2.0, 1.3.0, 1.4.0 |
| `900b19a` | 2026-11-25 | `2026-11-25.3` | 1.5.1 | 1.2.0, 1.3.0, 1.4.0, 1.5.1 |

The README rule before #186 read: delete a version "only once no `index.json` revision from the last 30 days names it". On 2026-11-23 it was not met under either reading:

- **Literal:** `bdd2feb` (2026-11-20) still listed `1.0.0`, three days before #186.
- **`defaults` reading** (batch 1 design D13 and #186's own text): `defaults.new-year` last named `1.0.0` before `aafdbd2` (2026-11-18), so the window ended on 2026-12-18.

**Outcome: Themes-owner waiver.** The Themes owner, who authored #186, merged it early and confirmed on 2026-11-26 that the early deletion was the owner's decision. #186 was approved by one reviewer; its description still says "Do not merge before 2026-12-18" and was not updated, and no PR comment records the waiver. This file is the record.

Context only, outside batch 1: `1.1.0` (removed by #192) and `1.1.1` (removed by #193) were also deleted inside their 30-day windows. The current README allows exactly `1.2.0`, `1.3.0`, `1.4.0` and `1.5.1` together as a one-off exception to the three-version cap.

## Published

Posted on #9226 on 2026-11-26 after the issue owner approved the draft: https://github.com/epam/ai-dial-chat/issues/9226#issuecomment-7200891051
