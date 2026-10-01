# Motion Quality for Story Scenes

Use for character choreography and improving an existing scene. Each scene and the repository contracts determine its numerical budgets and restoration rules.

## Make the action readable

- Show intention before a strong action: look at the target, shift the body, wind up. Allow enough anticipation for the viewer to understand the next movement.
- Derive contact from shared character/prop geometry. A prop falls after a push and follows the hand when carried. Check support points, not only illustration centers.
- Distinguish grounded movement, flight and landing. Preparation, takeoff, the arc apex, impact and recovery have different speeds. Uniform bobbing removes weight.
- A cloak, hat or broom may lag behind the body and settle after it. Limit the amplitude so secondary motion does not obscure the action.
- Silhouettes and poses must read at actual mobile size. Expression must not depend solely on color or tiny facial details. Deformed button copies must retain recognizable text.
- Show locomotion through changing support points and body weight, not a static pose sliding along a path. A character's walking, bracing and seated/pushing poses should look like the same body.
- Let the character attend to the action: look toward the viewer or surroundings, then toward the prop during contact, then back after the result. For repeated pushes or attempts, repeat this attention cycle with small changes rather than a fixed stare.
- Hold the intention or outcome long enough to read. A character settling on the composer before a first push, or reacting after the last object falls, needs visible time; lengthening only the travel path does not create that pause.
- In group scenes, assign different targets and exit paths so characters do not converge into one unexplained pile. Match each character's facing, wing or limb action to its actual travel direction, including turns and reverse paths.

## Choreography and easing

Choose easing for the action phase, not one curve for the entire story. A responsive control transition benefits from early movement and a soft stop; a character may need slow preparation followed by a sharp impulse. A long journey or heavy object needs different timing from a small gesture.

Objects moving together share a start time and coordinate system. Define intentional lag separately. Do not add ease-in-out between every pair of precomputed arc samples: it can cause repeated braking. Check velocity across phase boundaries and at contact.

For a gradual push, keep the paw or tool attached through the effort phase and advance the prop a small amount with each attempt. Inspect the contact frame before, during and after movement; an object that jumps early or moves after the hand has lifted breaks the cause-and-effect story.

The scene ends after its last meaningful action and recovery, not when the first characters meet or an early sub-animation completes. Check the full timeline and keep the final reaction and departure visible before cleanup.

Spring-like motion does not require another engine. A finite scene can precompute limited overshoot and decay within its keyframe budget. Dynamic springs are useful when gestures actually steer movement; ordinary UI-borrowing scenes cancel on input.

Do not apply a roughly 300ms UI-transition recommendation to a whole celebration story. Consistent easing for coupled objects does not mean identical movement styles for every character.

## Review and priorities

First watch normal playback: can the viewer understand intention, reaction and the joke without an explanation? Then use a recording or controlled timeline to inspect anticipation, contact, landing and restoration. Attractive still frames do not prove smooth transitions.

For confirmed issues, use a short table: **priority → code/timestamp → observation → change → verification**. Keep extra expressive ideas separate. Fix missing targets, broken contact, unreadable actions and restoration defects before timing/settling and minor embellishments. Preserve the approved plot.

Compare the same beat before/after on desktop and mobile, including RTL. Evaluate motion quality separately from frame time: no long tasks does not prove a character feels alive. OpenSpec tasks need both visual criteria and budget/cleanup checks. An idea or audit request alone does not authorize implementation.

## Implementation constraints

- Preserve the repository's static reduced-motion fallback and keyboard activation.
- Choose Lottie or CSS/WAAPI according to the scene's motion and DOM needs. Neither guarantees GPU-only rendering; profile actual SVG style/layout/paint costs.
- Do not hide incorrect geometry with blur or apply `will-change` to every element. Optimization needs an observed problem, a measurement and a bounded lifetime.
- Keep plans and verification in the OpenSpec change; implementation remains `opsx-propose` → `apply`.
