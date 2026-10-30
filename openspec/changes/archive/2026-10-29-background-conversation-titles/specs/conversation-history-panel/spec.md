## ADDED Requirements

### Requirement: Progressive conversation titles

The app SHALL render the metadata list before resolving pending display titles. It SHALL request at most 25 IDs per background batch, merge successful titles by stable identity without changing ordering or pin/unread state, and stop obsolete work when the list snapshot or authenticated identity changes or the provider unmounts. Failed or missing title reads SHALL not remove an otherwise listed conversation or leave progress permanently active. A newer manual or opened-conversation title SHALL win over an older background response.

The shared panel SHALL receive only updating state and translated labels; API calls, auth and lifecycle state SHALL remain in the app. The behavior SHALL be identical in the desktop sidebar and mobile drawer and SHALL preserve RTL layout. A status message SHALL be available to assistive technology without hiding the existing list.

#### Scenario: List is usable before titles finish

- **WHEN** a title batch remains unresolved after metadata has loaded
- **THEN** conversations are visible and interactive while title progress is shown

#### Scenario: Changed identity or newer edit

- **WHEN** a prior batch completes after the user changes identity or renames a conversation
- **THEN** it cannot overwrite the new identity's list or the newer title

#### Scenario: Background failure

- **WHEN** a title batch fails
- **THEN** existing rows remain usable and the current attempt can finish without an infinite retry loop

### Requirement: Search remains stable while titles are updated

While titles are pending, the panel SHALL distinguish a provisional empty search from a completed search with no results. An opened conversation that matched the active query SHALL remain visible through a background title correction until the query changes. Current titles SHALL still contribute new matches as they arrive. Highlighting SHALL continue to use the shared Highlight component.

#### Scenario: Opened match gets a new title

- **WHEN** an opened matching row receives a title that no longer contains the unchanged query
- **THEN** the row remains accessible in the current results

#### Scenario: Query changes after retention

- **WHEN** the user changes the search query
- **THEN** filtering is recalculated against current titles without retaining a match from the old query
