## ADDED Requirements

### Requirement: Highlight ids are unique within the gathered same-source list

When `annotationToOoxmlCanvasContent` builds `highlights` over the annotations returned by `gatherSameSourceAnnotations`, the minted `id` of each `OoxmlHighlight` SHALL be unique within that list. The same invariant SHALL hold for the PDF sibling path, whose ids must stay comparable with the Office path's.

The current minting rule, `String(annotation.index ?? positionInList)`, mixes a wire-supplied `index` with an array position and therefore admits collisions — for example an entry carrying `index: 1` alongside an entry with no `index` at position 1, or a wire payload that repeats an `index`. A collision is user-visible: `OoxmlContent` applies the selected treatment to **every** rectangle whose `highlightId` equals `selectedHighlightId`, so two passages in different parts of the document are both emphasised, while navigation resolves only the first match and scrolls to one of them.

Uniqueness SHALL be achieved without weakening the existing stability contract: an `annotation.index` SHALL continue to be used as the id wherever it is unambiguous within the gathered list, so ids stay stable across reopenings and comparable with `annotationsToPdfHighlights`. Only a colliding entry SHALL be disambiguated.

`selectedHighlightId` SHALL continue to name the clicked annotation's own highlight, identified by reference identity, and SHALL continue to be omitted when the clicked annotation produced no highlight — disambiguation SHALL NOT cause a different annotation's highlight to be selected.

This requirement SHALL NOT reduce what is highlighted. `gatherSameSourceAnnotations` SHALL keep returning every annotation citing the same source URL, every such highlight SHALL keep rendering as a background highlight, and the selected target SHALL keep its two-channel visual distinction. Nothing is removed from the overlay to fix duplicate popup cards.

One annotation carrying an array of selectors SHALL continue to resolve to several locations under a single id, all of them emphasised when that id is selected, with navigation targeting the first location. That is the existing contract for a passage that spans pieces and is not a collision.

#### Scenario: Two same-source annotations never share an id

- **WHEN** two annotations cite one DOCX file, the first carries `index: 1` and the second carries no `index`, and both resolve to locations
- **THEN** the two `OoxmlHighlight` entries carry different `id` values

#### Scenario: A repeated `index` on the wire is disambiguated

- **WHEN** two annotations citing one file both carry `index: 0`
- **THEN** the two highlights carry different `id` values and neither is dropped

#### Scenario: Unambiguous wire indices are preserved

- **WHEN** three annotations citing one file carry `index` values `0`, `1`, and `2`
- **THEN** the highlight ids are `"0"`, `"1"`, and `"2"` — unchanged from the prior behaviour

#### Scenario: Exactly one highlight is selected after disambiguation

- **WHEN** ids would have collided and the user previews one of the colliding annotations
- **THEN** `selectedHighlightId` names that annotation's own highlight, and the overlay marks the rectangles of exactly that one highlight selected

#### Scenario: Background highlights are still gathered

- **WHEN** four annotations cite one DOCX file and the user previews the third
- **THEN** all four highlights are present in `highlights`, and only the third's is selected

#### Scenario: A multi-selector annotation is not treated as a collision

- **WHEN** one annotation carries two valid DOCX selectors and is the clicked annotation
- **THEN** one highlight with two locations is produced, both locations are emphasised, and navigation targets the first
