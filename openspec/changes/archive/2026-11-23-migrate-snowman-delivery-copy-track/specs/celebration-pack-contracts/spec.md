# Spec Delta

## MODIFIED Requirements

### Requirement: Payload and structure caps

**[Contract]** v1 SHALL enforce these hard caps. Authors and publication checks SHALL stay at or under them, and the BFF and runtime SHALL reject anything that exceeds them. A manifest SHALL NOT raise a cap; only a library release can.

| Item | v1 cap |
| --- | --- |
| `config.json` | 256 KiB (inspected file: 15,463 bytes) |
| `manifest.json` | 64 KiB, JSON depth ≤ 32 |
| Lottie JSON per variant | 512 KiB raw, JSON depth ≤ 64, layers ≤ 48, keyframes ≤ 4,000, path vertices (all keyframes) ≤ 8,000 |
| Poster or icon | 100 KiB, intrinsic size ≤ 2,048 × 2,048 |
| Assets per manifest | 32 |
| Scenes per manifest | 16 |
| Labels | ≤ 280 characters each, ≤ 16 locales |
| Generated SVG DOM per scene (runtime check) | ≤ 800 elements |
| `maxLifetimeMs` | ≤ 32,000 |

These caps started as pilot limits from source inspection. S4 (#9223) raised the Lottie JSON caps from 300 KiB and 2,000 keyframes to 512 KiB and 4,000 keyframes. Its spike measured about 70 keyframes and 8.2 KB per second of continuous articulated acting, and the full Halloween Cat (about 46 s of rig time in three story sections) projects to about 3,200 keyframes and about 370 KiB. The BFF applies the byte cap per media type, so the raised cap applies to every pack. S7 batch 1 (#9226) raised the layer cap from 30 to 48. Its copy-track spike measured 40 layers: track, follow and reference nulls, plus fill copies of partly visible layers. Later stages SHALL confirm or revise the caps through a delta to this capability.

#### Scenario: An oversized animation
- **WHEN** a variant's actual bytes exceed 512 KiB, whatever its declared `bytes` says
- **THEN** the BFF stops reading at the cap and the asset is unavailable

#### Scenario: A dense interaction scene
- **WHEN** a variant has 3,400 keyframes and 380 KiB
- **THEN** publication accepts it, and the BFF serves it

#### Scenario: Too many keyframes
- **WHEN** a variant has 4,001 keyframes
- **THEN** publication rejects it

#### Scenario: A copy-track scene's layers
- **WHEN** a variant has 44 layers
- **THEN** publication accepts it
