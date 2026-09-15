# skill-details-panel Delta

## MODIFIED Requirements

### Requirement: The Content tab shows the manifest's description as its summary

`libs/catalog/src/models/item-details-data.ts` SHALL add an optional `description` to `CatalogItemPromptContent`, and `DetailsPanel` SHALL render `ContentTab`'s `description` prop as `item.details?.promptContent?.description ?? item.description`.

The ordering is unchanged, but both operands are now populated for skills: `mapSkillToCatalogItem` maps the listing-sourced `description` (DIAL Core PR #1970) onto `CatalogItem.description`, so the summary shows the listing description while the details fetch is in flight, and the manifest's own `description` frontmatter — the value Core itself derives the listing attributes from — takes over once the fetch resolves. Prompts pass no `description` on `promptContent` and SHALL be unaffected — they keep rendering `item.description`.

The Skill branch of `onFetchDetails` SHALL set `promptContent.description` from the parsed manifest's `description` frontmatter field, omitting it when the field is absent, and SHALL set `promptContent.content` to the manifest **body** — the text after the frontmatter fence — rather than the raw file.

No `About` tab SHALL be restored for skills. `CatalogEntityType.Skill` stays in `CONTENT_FIRST_ENTITY_TYPES`. The original rationale — that an About tab would appear mid-interaction once the fetch settled — no longer applies (the listing description exists at item construction), but the tab stays omitted because it would only repeat the summary line the Content tab already leads with; the stale code comments claiming a skill's metadata carries no description are corrected in the same change.

The manifest's parsed `name` field SHALL NOT be rendered anywhere in the Content tab — not in the summary, not in the body. The item's display name comes from `item.name` (set by `mapSkillToCatalogItem` from the skill's own metadata, independent of the manifest), and the parsed `name` field exists only because `parseSkillManifest` reads it; the Skill branch of `onFetchDetails` SHALL NOT thread it into `promptContent` at all.

A manifest that is nothing but frontmatter (no text after the closing fence) SHALL yield `promptContent.content` as an empty string — an empty-instructions state, distinct from an error: the manifest was read and parsed successfully, it simply describes no instructions.

#### Scenario: Manifest with a description

- **WHEN** a skill's `SKILL.md` frontmatter carries `description: Finds and cites sources`
- **THEN** the Content tab renders that text as its summary line above the divider, and the body below it

#### Scenario: Listing description shows before the details fetch lands

- **WHEN** a skill's listing entry carries `description: 'Finds and cites sources'` and its details panel is opened while the manifest fetch is still in flight
- **THEN** the Content tab's summary line already shows that listing description, and no per-skill download is performed for it

#### Scenario: Frontmatter is not rendered as body

- **WHEN** a skill's `SKILL.md` opens with a `---` fence
- **THEN** the Content tab body contains no `name:` or `description:` line and no heading or rule produced by the fence

#### Scenario: The parsed name field is never rendered as content

- **WHEN** a skill's `SKILL.md` frontmatter carries `name: revenue-finder`
- **THEN** neither the Content tab's summary nor its body contains the text `revenue-finder` as a consequence of the frontmatter parse (the item's own display name, shown in the panel header, is unaffected — it never came from the manifest)

#### Scenario: Manifest with no description

- **WHEN** the frontmatter carries no `description`
- **THEN** the Content tab renders no summary line and no divider, and the body renders unchanged

#### Scenario: Frontmatter-only manifest yields an empty-instructions body, not an error

- **WHEN** a skill's `SKILL.md` is entirely a `---`-delimited frontmatter block with no text after the closing fence
- **THEN** `promptContent.content` is `''`, the Content tab renders its existing empty-body state, and no error or notification appears

#### Scenario: Malformed frontmatter falls back to the whole file as body, not a second parser

- **WHEN** a skill's `SKILL.md` opens with a `---` fence whose YAML fails to parse
- **THEN** `promptContent.content` is the whole raw file text, exactly as `parseSkillManifest`'s existing degradation contract (see `skill-manifest-parsing`) already specifies, and no separate manifest parser is invoked to attempt a second parse

#### Scenario: Prompt content is unaffected

- **WHEN** a prompt's details panel opens
- **THEN** its Content tab summary is `item.description`, exactly as before

#### Scenario: Skill still opens on Content

- **WHEN** a skill's details panel opens
- **THEN** the tab row's first entry is `Content` and no `About` tab is rendered, before and after details resolve

#### Scenario: No Skill Builder control appears in the details panel

- **WHEN** a skill's details panel is open, on `SKILL.md` or on any picked supporting file
- **THEN** no editable form field, no frontmatter editor, and no Skill Builder action (save, validate, publish, upload) is rendered anywhere in the panel
