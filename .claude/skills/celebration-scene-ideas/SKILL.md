---
name: celebration-scene-ideas
description: 'Propose and improve story-driven celebration scenes in AI DIAL Chat, including interaction with page components, character motion, SVG/Lottie artwork and performance. Use for event scene ideas, celebration animation improvements, or more realistic vector characters. Produce concepts, storyboards or prioritized findings; implement only when requested.'
---

# Celebration Scene Ideas

Design scenes in which characters treat page components as props. Use this repository's Halloween scenes as a quality reference: a readable intention, action, interface reaction, unexpected resolution and restoration of the page. Respond in the user's language.

## Establish the request

Use the event named in the request or already selected by the user. If missing, ask one short question while inspecting examples. Halloween is a quality reference, not the default event; the application's active event is not evidence of the user's choice.

Preserve requested characters, mood, number of ideas, duration, page elements and unwanted effects. Make reasonable choices for the rest. Ideas for an event without an existing module are valid; identify the module as additional work.

The default deliverable is an idea in the response. Do not create OpenSpec changes, scene files or images until the corresponding work is requested. If implementation is already authorized, use the concept as a brief foundation and continue without asking for the same permission again.

Implement scenes through `openspec-propose` (`/opsx:propose`, also called `opsx-propose`), then `openspec-apply-change` (`/opsx:apply`). Continue a suitable existing change instead of duplicating it. Include the plot, fallbacks, cleanup and numerical performance budgets in proposal/design/specs/tasks; verify them with tests and browser profiling during apply. Authorization for both proposal and implementation permits proceeding to apply without another confirmation. Archive only when requested.

## Ground the idea in the repository

Paths below are relative to the AI DIAL Chat root. Follow AGENTS.md: use `nx-workspace` before workspace exploration and `dial-docs` before explaining documented behavior. If the repository is unavailable, distinguish assumptions from confirmed capabilities.

1. Read `libs/celebrations/README.md` and the selected event's `libs/celebrations/src/<event>/event.ts` or `event.tsx`. Check existing scenes to avoid proposing a duplicate.
2. Use the [repository examples](references/repository-patterns.md) to choose one or two relevant techniques. Read their component, animation plan and target selection as needed; do not preload all of Halloween.
3. Inspect `libs/celebrations/src/models/celebration.ts` and `apps/chat/src/context/CelebrationHost.tsx` for actual host anchors and triggers. An anchor does not guarantee a visible, eligible target in the current layout.

If paths have moved, locate them with `rg --files`. Cite one or two inspected sources and explain the technique they demonstrate. Reading source code is not browser observation.

## Build action and character

Start with an event-specific motive: what does the character want, and why does it touch the interface? Give page elements physical roles: a composer edge becomes a ledge, a button a weight, a starter card a platform, a history row a ribbon.

Build a causal sequence: entrance → intention → contact → reaction → complication or joke → departure and restoration. Specify the contact point, weight transfer or impulse, and when the prop starts moving. A carried object follows its grip; a push precedes a fall; stopping and returning have a reason. Gaze, anticipation, pauses and reactions to failure establish personality.

Each main concept needs a meaningful interaction with a page component. Snow, confetti, glow and flybys can support the plot but are not sufficient by themselves. Borrow Halloween's principles while inventing an original action for the selected event; replacing its cat with another character is not a new story.

Distinguish three kinds of interaction:

- **User trigger:** the event's existing decor trigger or secret phrase. A decor click selects from a pool; do not promise a particular scene without a separate configuration.
- **Interface choreography:** after activation, characters interact with inert visual copies or measured component geometry.
- **Live user control:** pointer movement, typing or dragging during playback. Decor has separate reactive behaviors, while scenes borrowing UI usually cancel on input or clicks. If a concept needs direct control, identify the contract change and how ordinary chat interaction remains usable; do not describe it as an existing feature.

## SVG artwork

For new SVG characters or requests to improve drawing, volume or realism, read [SVG character quality](references/svg-character-quality.md). It connects silhouette, proportions, expression, lighting and materials to animation geometry and rendering budgets. If the user asks for realism without choosing a style, propose stylized realism and inspect it at the actual scene size. Preserve an explicitly chosen style.

Separate artwork quality from motion quality. Preserve the plot, grips, supports and props when redrawing; geometry changes require contact checks. Define observable visual criteria and a numerical SVG budget before implementation. A PNG concept is not an articulated SVG asset.

## Motion and existing-scene review

For character choreography and animation improvements, read [motion quality](references/motion-quality.md). It covers easing, anticipation, coordinated movement and visual review. All guidance needed for this workflow lives in this skill and its local references.

Describe the action's feel as well as its route: anticipation, contact, weight transfer, reaction and settling. Give each beat a visual focus; secondary motion supports it. Distinguish characters through timing and movement style.

Separate confirmed defects from expressive suggestions. For each substantial finding, provide a code location or recording timestamp, observation, proposed change and verification method. Prioritize readability, correctness and cost. Without browser observation, label perceptual conclusions as hypotheses. When implementation is authorized, put selected improvements into the OpenSpec change and continue apply.

## Choose the animation mechanism

For a new character-led scene, start by considering a scene-local Lottie SVG composition. Prefer it when articulated poses, several synchronized characters or props, or vector shape changes benefit from one authored timeline. Use the repository's existing light player and keep geometry, grips and UI reactions on that timeline. If the user explicitly requests Lottie, plan for Lottie unless a required interaction cannot reasonably be represented in it; explain that constraint and use a coordinated companion animation only where needed.

Use CSS/WAAPI for simple decor loops, brief element transforms or UI snapshots that need direct DOM control. Do not migrate a working scene merely to change its animation engine. Lottie is a way to author motion, not a performance or realism guarantee. Read [Lottie scene quality](references/lottie-scene-quality.md) when proposing or implementing it; include the player, composition and fallback in the scene design.

## Check feasibility

- Move inert visual copies when borrowing UI. Preserve real data, chat ordering, drafts, selection, focus and layout; never send a message or navigate for an effect. Prefer measuring the composer as a support over copying it. For apparent composer displacement, inspect the specialized Mummy implementation.
- Use visible, eligible targets. Copying usually excludes editable, expanded and focused controls; measuring a safe focused composer can still be appropriate. Base exceptions on the specific mechanism. Name a small copy/character budget and the main risk: snapshot size, deformation, contact synchronization or a new anchor.
- Completion and interruption restore originals immediately. Input, focus, scrolling, viewport/target changes, navigation and reduced-motion changes must not leave hidden controls or stranded copies. Include prop restoration and character departure in the finite lifetime.
- Mobile keeps the central story without an open history panel or hover. Specify alternate targets, reduced cast or a decorative resolution when anchors are missing. A composer-only host must still have a coherent scene.
- For RTL, use actual target positions and logical sides; never mirror copied text. Reduced motion needs a meaningful static composition without borrowing UI. Keep keyboard activation and an inert, pointer-transparent decorative layer. The story must work without sound.
- The host supplies anchors, translations and settings. Keep app routes, another package's classes, i18n and app contexts out of `libs/celebrations`. Identify a new anchor, trigger or contract as an extension, not an existing API.

Verify details against current code. Keep the animation mechanism local to the scene; do not make an event-wide engine change for one idea.

## Performance is part of the concept

Keep the chat responsive, especially on mobile. Consider cost when choosing mechanics and carry constraints into the design, acceptance criteria and verification tasks.

- Set scene-specific numerical budgets: characters, concurrently borrowed elements, DOM snapshot size/complexity and duration. Explain the mobile reduction. Example counts are not universal library limits.
- Precompute choreography and measure host geometry during preparation. Avoid per-frame DOM reads, React updates and interleaved layout reads/writes. Event-driven geometry rechecks for safe cancellation are different from continuous polling.
- Bound DOM traversal and copying; use a small element or fragment when it serves the story. Budget total animations and keyframes; for Lottie also budget composition bytes, layers, paths/vertices, generated SVG nodes and concurrent players. Avoid expensive blur/filter effects, full-screen repainting and unbounded particles.
- Missing targets, reduced motion and unsupported APIs need inexpensive fallbacks. Completion, interruption and hidden tabs release copies, animations, timers, observers and listeners. Preserve event lazy loading.
- Name the main performance risk and how to detect it: tested limits, no playback measurements, replay/cancellation without resource accumulation, and mobile/desktop browser profiles. Structural budgets are not measured frame times; unit tests are not a browser profile. Do not promise 60 FPS without evidence.

Simplify secondary effects while preserving character, interface contact and the resolution. Discuss optimizations that change approved behavior instead of silently removing a beat.

## Present the result

Unless a count is requested, offer one strong concept. For several options, vary the mechanics and plot, compare briefly and recommend one. Detail that option's storyboard unless all were requested.

Scale the response to the request; useful content includes:

- **Title and premise:** event, cast and central action in two or three sentences; why it fits the event.
- **Storyboard:** ordered beats and approximate timing for entrance, interaction, climax, restoration and departure. Timing is an estimate, not a library-wide limit.
- **Motion character:** anticipation/contact, weight, reaction pause, secondary motion and differences between characters.
- **Artwork, when relevant:** silhouette, proportions, light/materials, details visible at actual size and visual comparison criteria.
- **Page props:** components, their roles, available anchors and any required integration extensions.
- **Activation and user behavior:** trigger, permitted interaction and cancellation.
- **Adaptations:** mobile/missing targets, RTL, reduced motion and restoration for this plot.
- **Performance:** mobile/desktop object and snapshot budgets, playback mechanism, primary risk and verification.
- **Animation mechanism:** for implementation proposals, say whether Lottie or CSS/WAAPI carries the story, why, and how synchronized UI props and fallbacks work.
- **Code references and effort:** one or two examples, reusable mechanisms, new work and a reasoned complexity estimate.

Lead with a scene the user can picture. Technical details support it. End with a meaningful resolution and assessment, not an obligatory approval question or automatic implementation.
