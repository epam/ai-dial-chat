## Why

After fixing the showman's skull the partner simply drops off the edge with him. The user asked for a final joke: the partner grabs the name from the start-page greeting and jumps away with it.

## What Changes

- Replace the partner's celebration hop with a theft: he looks up, jumps, closes his hand on the last word of the greeting heading ("Good evening, Valery" → "Valery"; without a name → "evening"), lands with it dangling, and jumps off the edge while the showman protests and follows. The word is thrown back up from below and settles exactly in place before the 11.5 s timeline ends.
- The original word is hidden only visually with the CSS Custom Highlight API (no DOM mutation); stopping the scene removes the highlight immediately.
- Without a reachable greeting word, the Highlight API, or a composer stage, the existing ending plays unchanged.
- **Non-goals:** knowing or passing the user's name, new host anchors or props, changes to the greeting component, new strings, a longer deadline.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: Skeletons ending, greeting-word borrowing and its restoration contract.

## Impact

Private Skeletons files in `libs/celebrations/src/halloween` (targets, plan, animation, component, styles, tests), the lib README and the main spec. Reads only the heading inside the host-supplied `welcomeRegion`, as Ravens already does. No public API, dependency or deadline change.
