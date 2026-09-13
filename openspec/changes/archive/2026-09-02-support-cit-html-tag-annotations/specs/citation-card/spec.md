## MODIFIED Requirements

### Requirement: Citation popup state managed by `useCitationCard` hook and `CitationCardContext`

`libs/quotations/src/utils/useCitationCard.ts` SHALL export `useCitationCard` that:
- Tracks `openGroupKey: string | null` (which group's popup is open, or null when closed) — keyed by `AnnotationGroup.groupKey`, not `sourceUrl`, so two groups that share the same `sourceUrl` (e.g. two `cit`-id groups citing the same document) never share open/active-index state.
- Tracks `activeIndexByGroup: Record<string, number>` (the current switcher index per `groupKey`).
- Exposes: `openPopup(groupKey: string)`, `closePopup()`, `setActiveIndex(groupKey: string, index: number)`.
- Returns derived state: `isOpen(groupKey: string): boolean`, `getActiveIndex(groupKey: string): number`.

**Memoisation**: exposed callbacks SHALL be wrapped in `useCallback`; state object SHALL be wrapped in `useMemo`.

`libs/quotations/src/context/CitationCardContext.tsx` SHALL export:
- `CitationCardProvider` — the React context provider component.
- `useCitationCardContext()` — hook that returns the current `CitationCardHook` value; throws if used outside a provider.
- `CitationCardHook` — the inferred return type of `useCitationCard`.

The consuming app's message-item component SHALL wrap its return value in `<CitationCardProvider value={citationCard}>` so that all `CitationDropdown` instances rendered via `markdownComponents` can access the shared citation state without prop drilling.

`CitationDropdown` SHALL call `citationCard.isOpen(group.groupKey)`, `citationCard.getActiveIndex(group.groupKey)`, `citationCard.openPopup(group.groupKey)`, and `citationCard.setActiveIndex(group.groupKey, i)` — never `group.sourceUrl` — when reading or updating shared popup/switcher state. It SHALL still use `group.sourceUrl` where the meaning is "the attachment to preview/download", which is unaffected by this change. The React `key` prop for each rendered `CitationDropdown` in `useCitationMarkdownComponents` SHALL likewise be derived from `group.groupKey`.

`useCitationMarkdownComponents` SHALL NOT accept `citationCard` as a parameter; it reads `CitationCardContext` internally via `CitationDropdown`. The `markdownComponents` returned SHALL only depend on `groups`, `onPreview`, `onOpenInBrowser`, and `buildLabels` — all of which are stable between switcher-index changes — so that ReactMarkdown never unmounts the paragraph subtree in response to a citation state update.

#### Scenario: Opening a popup sets the open group by groupKey

- **WHEN** `openPopup("cit:e43864")` is called
- **THEN** `isOpen("cit:e43864")` returns `true`

#### Scenario: Two groups sharing a sourceUrl have independent open state

- **WHEN** two `AnnotationGroup`s share the same `sourceUrl` but have `groupKey` values `"cit:e43864"` and `"cit:e52dc2"`, and `openPopup("cit:e43864")` is called
- **THEN** `isOpen("cit:e43864")` returns `true` and `isOpen("cit:e52dc2")` returns `false`

#### Scenario: Closing the popup clears the open state

- **WHEN** `closePopup()` is called after a popup was opened
- **THEN** `isOpen` returns `false` for every `groupKey`

#### Scenario: Index changes are tracked per groupKey

- **WHEN** `setActiveIndex("cit:e43864", 2)` is called
- **THEN** `getActiveIndex` returns `2` for `"cit:e43864"`

#### Scenario: URL-keyed group's groupKey still equals its sourceUrl

- **WHEN** a `text_character_range` `AnnotationGroup` is produced by `groupAnnotationsBySource` with `sourceUrl = "https://files.example.com/report.pdf"`
- **THEN** its `groupKey` also equals `"https://files.example.com/report.pdf"`, preserving prior behavior for that family of groups
