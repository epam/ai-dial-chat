# Design

## Findings

- **F1 — prompt ids are the only ones re-encoded on the way out.**
  `toShareResourceUrl` (`apps/chat-api/src/share/utils/share-resource.util.ts`)
  encodes a prompt id before the share is created and leaves every other kind
  alone, with the reason documented in place: prompt ids are deliberately
  decoded at listing time (`buildPromptId` over a path from `urlToPromptPath`),
  while conversations/applications/toolsets pass DIAL Core's own metadata url
  through.
- **F2 — nothing decodes them on the way back in.** `acceptInvitation` reads the
  invitation's `resources[].url` and returns it verbatim as `itemId`, so a
  prompt shared as `Work/tone of voice` comes back as `Work/tone%20of%20voice`.
- **F3 — the catalog match is exact.** `Catalog`'s initial-details effect does
  `items.find(item => item.id === initialDetailsItemId)` and returns silently
  when nothing matches; there is no fallback and no error surface, which is why
  the symptom is "the catalog page, with nothing open".
- **F4 — prompts were left out of the post-accept refetch.**
  `SharedInvitationPage` refetches deployments, toolsets, and skills only.
- **F5 — a prompt has no summary to merge.** `resolveSharedItemSummary` returns
  `{}` for a prompt id by design, so the refetch is the only path into the list.
  There is nothing equivalent to `mergeSharedItem`/`mergeSharedSkill` to add.

## Decisions

- **D1 — the decode lives next to the encode.** `toPublicItemId` is added
  directly below `toShareResourceUrl` in the same file, so the pair is read
  together and the same `isPromptResourceUrl` condition governs both. When the
  TODO already recorded above `toShareResourceUrl` is done (prompts stop
  decoding at listing time), both functions collapse to identity and are
  removed together.
- **D2 — decode per path segment, not the whole string.** `decodeURIComponent`
  over the full id would turn an encoded `%2F` inside a name into a path
  separator. Splitting on `/` first and decoding each segment mirrors
  `encodeDialResourcePath` exactly, so the two are true inverses.
- **D3 — decode at the response boundary, not before the lookups.**
  `resolveSharedItemSummary` and the DIAL Core accept/peek calls keep the raw
  upstream url; only the value returned to the frontend is converted. The
  conversion therefore cannot change which upstream resource is addressed.
- **D4 — refetch rather than merge for prompts.** Adding a `sharedPrompt`
  summary to the accept response would mean a new resolution path in the BFF
  and a new merge in `PromptsContext`, to cover a race that has not been
  observed for prompts. The refetch already runs; prompts simply join it.

## Risks

- **Double-decoding a literal `%`.** A prompt named `100%` would round-trip as
  `100%25` and decode back correctly; a malformed sequence is handled because
  `encodeDialResourcePath` itself decodes defensively via
  `safeDecodeURIComponent` before re-encoding. The decode side uses the same
  helper, so a raw `%` that is not a valid escape is left literal rather than
  throwing.
- **DIAL Core not yet reflecting the grant in `getSharedResources`.** If it
  ever lags, the refetch would come back without the prompt and the panel would
  stay closed — the same exposure the deployments path answered with a merge.
  Left unaddressed deliberately (D4); the merge remains the escape hatch.
