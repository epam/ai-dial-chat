## Why

### Problem

The Halloween chat phrase always drops spiders. The user wants new scenes exclusive to messages, rather than reusing pumpkin scenes.

## What Changes

### Solution

- Add a bubbling cauldron, a toothy mimic chest, pumpkin bowling and a straining mummy to the message-only pool, alongside the existing spider drop.
- Make each new scene interact with visual snapshots of the existing page UI: mummy slowly pushes the chat input offscreen after a failed first effort; cauldron bubbles return rows; mimic chews and spits rows back; pumpkin bowling scatters and regroups up to six rows.
- Let event modules declare multiple secret scene IDs. Select randomly without consecutive repeats, independently of pumpkin clicks.
- Preserve start-page-only interception, per-scene cleanup, notifications, RTL and reduced motion.

### Non-goals

No new phrases, backend calls, conversation data mutations, pumpkin scenes, configuration switches or dependencies. No edits to core page components.

### Acceptance criteria

- Repeated exact `trick or treat` messages can play all five secret scenes without consecutive repeats; the four new scenes never appear on pumpkin clicks.
- Invalid or empty secret pools do not consume messages. New Year's existing single secret scene keeps working.
- Each new scene has detailed vector artwork, finite playback, a static reduced-motion view and a localized notification with the secret phrase hint.
- Scenes fit mobile and desktop viewports, remain click-through and clean up on replacement, navigation or event changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `celebration-events`: Support an independent random secret scene pool.
- `halloween-easter-egg`: Add four scenes exclusive to secret chat messages.

## Impact

Extends the existing application provider (`apps/chat/src/context/CelebrationContext.tsx:139`) and module contract, with no new context or library changes. Artwork follows `apps/chat/src/components/Halloween/HalloweenExtras.tsx`; the event definition remains the only registration point. Four new `halloween.*ToastMessage` keys require translations. Update the app README and architecture runtime summary.

Alternatives: reusing all pumpkin scenes was rejected by the user; separate per-scene phrases add unnecessary discovery complexity. Reuse the existing random selection helper.

Compatibility: `secretTrigger.sceneId` becomes internal `sceneIds`; migrate both compiled modules together. No external API or persisted schema changes. Revert this change to restore spider-only messages.
