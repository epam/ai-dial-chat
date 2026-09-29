## Context

The greeting is one `h1` string rendered by `ConversationInput` from host translations (`chat.greetingEvening`: "Good evening, {{name}}"; no-name variant "Good evening"). The library cannot and must not know which part is the user's name. Ravens already reads headings inside `welcomeRegion` (`halloween-raven-targets.ts:167`).

## Decisions

### Take the last word, not "the name"

The target is the last word of the first `h1`/`h2` in the composer's welcome region: the last non-empty text node (at most 16 visited), last run of non-space, non-punctuation characters. With the host's current greeting this is the first name; without a name it is "evening". The library stays unaware of users, sessions or locales. A copy of the word lives only inside the inert, `aria-hidden` artwork layer and is never logged or sent anywhere.

Eligibility: the heading passes the scene's existing visibility checks; the word rect is 4–320px wide, fully in the viewport, above the stage (`bottom ≤ stageY − 8`), and horizontally inside the stage band. The partner's reach is solved with `skeletonHandPoint`: a high word uses a raised arm (−75°) and a jump of at most 110 art units; a word within standing reach — the real chat renders the greeting only 36px above the input — uses a 12-unit hop with the arm angle solved for the word (an unreachable, clamped solve is rejected). Otherwise the scene keeps its previous ending.

### Hide without mutating

`CSS.highlights` registers a `Highlight` over the word's `Range`; `::highlight(celebration-skeleton-word) { color: transparent }` hides only that glyph run. It is set by one timer at the grab contact and removed by one timer when the thrown-back copy lands, and immediately by `stop()`. No `Highlight` API → no grab.

### Storyboard (replaces 10100–11400 ms for the partner)

| Time (ms)   | Beat                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| 10100–10250 | Partner turns to the word, looks up and crouches; showman cheers alone.                             |
| 10250–10450 | Jump; at 10450 the hand closes on the word's top edge — original hidden, copy shown.                |
| 10450–10700 | Lands with the word dangling from the hand (sampled every 50 ms from the same pose).                |
| 10650–10800 | Showman turns with arms out — "hey!".                                                               |
| 10800–11150 | Partner jumps off the edge with the word; showman follows 10850–11250.                              |
| 11100–11400 | The word is thrown back up from below, spins upright and lands exactly in place; highlight removed. |

The copy uses the heading's computed font, size, weight, letter spacing and colour and the measured word box. In RTL the artwork layer is mirrored, so the copy counter-mirrors its text.

### Budgets

+1 animation (the word copy), so 22 in total; ≤ 80 keyframes per track; +2 DOM nodes; 2 timers; the heading joins the observed anchors, so text or size changes cancel playback.

## Risks / Trade-offs

- Other locales may place the name elsewhere → the joke still steals a greeting word; documented as "last word".
- The copy might not match subpixel text rendering → it replaces the original only while moving; the landing frame hands back to the original.
- Highlight support varies (Chrome 105+, Safari 17.2+, Firefox 140+) → feature-detected fallback.
