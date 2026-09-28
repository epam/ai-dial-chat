## Context

Candy currently uses 18/32 randomized CSS falling tracks with per-sweet drop shadows and an 11s provider deadline. Ravens and Mummy already supply visual references, but their existing grip/push drawings are not pecking/sweeping rigs. Footprints demonstrates stable preparation, bounded target discovery and interruptible WAAPI ownership. Root AGENTS.md applies; no celebrations-local AGENTS.md exists.

## Goals / Non-Goals

**Goals:** all approved story beats, readable contact and character, composer-only support, preserved working chat and bounded rendering on mobile and desktop.

**Non-Goals:** real physics, new dependencies/public APIs, cloning the input, changing other scenes, audio, pointer steering or host-owned integration in libs.

## Decisions

### One private Candy scene with one clock

Extract only Candy from Extras into `HalloweenCandy.tsx`, with private `halloween-candy-targets.ts`, `halloween-candy-plan.ts`, `halloween-candy-animation.ts` and Candy artwork. Pure plan and lifecycle are separate; no new provider/context/shared engine. Existing environment supplies anchors/mobile; CSS/computed direction supplies RTL without app i18n. Use Tailwind/computed styles for layout and CSS-module pigments for art. This explicit library isolation check excludes app imports, routes, flags, storage, APIs and transports.

Use a 35000ms scene clock and 35500ms provider deadline. Beats: 0–5 falling/settling; 5–9 two feeding ravens; 9–14 mummy sweeps and expels them to the starting edge; 14–20 returning larger flock expels mummy at the opposite edge; 20–24 second feast; 24–31 mummy and two skeleton helpers advance and expel the flock; 31–35 final sweep and departure. A finite return pause makes each reversal readable. Keep all three janitors on mobile.

### Contact geometry rather than snapshots or simulation

Measure at most four composer candidates and twelve starter buttons, with cached geometry/styles and up to 32 ancestors. Keep at most 2 mobile / 3 desktop visible top-edge targets. Accept card positions on either side of the composer and discover the composer even without a starter anchor. Reject clipped, hidden, transformed/filtered/transparent geometry and edits unsafe to use as targets. No controls are copied or animated. Sweet flight segments meet measured edge coordinates before changing velocity; route around an edge before descending. Without targets, bounce onto the floor and retain the entire battle.

Use one bottom stage, constrained to available viewport dimensions. LTR birds enter/retreat left, janitors enter/retreat right; mirror story coordinates for RTL while retaining physical target bounds. Candy objects persist between feeding and sweeping rounds. Store explicit contact events so a bird beak or broom tip and the contacted candy derive from the same pose. Floor sweets stop animating between finite nudges. Plan arcs and all part motion before playback; no runtime physics, RAF loop, layout polling or React frame updates.

### Articulation and personality

Candy-specific raven rig: grounded feet, folding/flapping wing and separate head/beak for pecks. Mummy and skeleton janitors: planted/stepping legs, torso, arms holding a common broom group, clear sweep/brandish poses. Match feet and bristles to the floor. Use contrasting silhouettes, restrained static shading and wrapper folds. Leave existing Raven/Mummy/Skeleton scenes untouched. Render details at mobile size; no animated SVG path deformation or filter effects.

### Budgets and cleanup

12/18 sweets, initial two ravens returning as 4/6, exactly one mummy + two skeletons, zero DOM snapshots. At most 60/80 simultaneous animation tracks, 400/520 SVG nodes and 160 keyframes per track. Use finite phase tracks where repeated motion would otherwise exceed the frame cap; stop/cancel every track on completion/interruption. Measure actual setup/steady reads, active tracks, SVG nodes, long tasks and native rendering cost before/after. No FPS claim without device evidence.

Cancel on input/composition, pointer/focus, scroll/resize, hidden document, source mutation/removal/resizing, changed environment/motion, replacement and unmount. Cancelled preparation must not restart; setup failure and StrictMode cleanup are idempotent. Unrelated toast removal revalidates anchors only if needed. Static reduced/unsupported mode skips measurements and depicts the contest without motion. Existing trigger and notification remain; no new i18n, telemetry, persistence or feature flag.

## Risks / Trade-offs

- Contact drift across mirrored/rotated poses → derive candy/beak/bristle contacts from shared geometry and test rendered positions.
- Mobile crowding → smaller drawings, four returning birds, separated queues and shared floor; no omitted plot beat.
- Longer duration → ordinary chat remains usable and any interaction cancels immediately.
- Larger SVG cast → phase-gated part motion, bounded nodes/tracks, mobile CPU ×4 profile and real-size visual inspection.

## Migration Plan

Replace Candy's private renderer and deadline together, update old count/deadline tests and lib README. No host migration. Revert these Candy changes to restore the rain. No archive/commit/push is part of this request.

## Open Questions

None blocking: the user approved the story and implementation. Proposed per-scene budgets will be verified, not treated as measured performance.
