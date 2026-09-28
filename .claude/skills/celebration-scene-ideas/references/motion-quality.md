# Motion Quality for Story Scenes

Use for character choreography and improving an existing scene. Each scene and the repository contracts determine its numerical budgets and restoration rules.

## Make the action readable

- Show intention before a strong action: look at the target, shift the body, wind up. Allow enough anticipation for the viewer to understand the next movement.
- Derive contact from shared character/prop geometry. A prop falls after a push and follows the hand when carried. Check support points, not only illustration centers.
- Distinguish grounded movement, flight and landing. Preparation, takeoff, the arc apex, impact and recovery have different speeds. Uniform bobbing removes weight.
- A cloak, hat or broom may lag behind the body and settle after it. Limit the amplitude so secondary motion does not obscure the action.
- Silhouettes and poses must read at actual mobile size. Expression must not depend solely on color or tiny facial details. Deformed button copies must retain recognizable text.

## Choreography and easing

Choose easing for the action phase, not one curve for the entire story. A responsive control transition benefits from early movement and a soft stop; a character may need slow preparation followed by a sharp impulse. A long journey or heavy object needs different timing from a small gesture.

Objects moving together share a start time and coordinate system. Define intentional lag separately. Do not add ease-in-out between every pair of precomputed arc samples: it can cause repeated braking. Check velocity across phase boundaries and at contact.

Spring-like motion does not require another engine. A finite scene can precompute limited overshoot and decay within its keyframe budget. Dynamic springs are useful when gestures actually steer movement; ordinary UI-borrowing scenes cancel on input.

Do not apply a roughly 300ms UI-transition recommendation to a whole celebration story. Consistent easing for coupled objects does not mean identical movement styles for every character.

## Review and priorities

First watch normal playback: can the viewer understand intention, reaction and the joke without an explanation? Then use a recording or controlled timeline to inspect anticipation, contact, landing and restoration. Attractive still frames do not prove smooth transitions.

For confirmed issues, use a short table: **priority → code/timestamp → observation → change → verification**. Keep extra expressive ideas separate. Fix missing targets, broken contact, unreadable actions and restoration defects before timing/settling and minor embellishments. Preserve the approved plot.

Compare the same beat before/after on desktop and mobile, including RTL. Evaluate motion quality separately from frame time: no long tasks does not prove a character feels alive. OpenSpec tasks need both visual criteria and budget/cleanup checks. An idea or audit request alone does not authorize implementation.

## Implementation constraints

- Preserve the repository's static reduced-motion fallback and keyboard activation.
- Prefer `transform`/`opacity`, but do not promise GPU-only rendering. Profile actual SVG style/layout/paint costs.
- Do not hide incorrect geometry with blur or apply `will-change` to every element. Optimization needs an observed problem, a measurement and a bounded lifetime.
- Keep plans and verification in the OpenSpec change; implementation remains `opsx-propose` → `apply`.
