# Spec Delta

## MODIFIED Requirements

### Requirement: Input/Output modalities render as friendly labels, and internal-only capability flags are hidden

`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL render a model's and application's
`inputAttachmentTypes`/`outputAttachmentTypes` (surfaced as `ModelSpecification.inputTypes`/
`outputTypes` and `AgentConfiguration.inputAttachmentTypes`/`outputAttachmentTypes`) as
human-readable labels via `mimeTypesToExtensionLabels` (`@epam/ai-dial-attachment-input`) rather
than the raw MIME type strings DIAL Core returns. A wildcard major type (`image/*`, `audio/*`,
`video/*`, `text/*`) SHALL render as `"<Major> files"` (e.g. `"Image files"`); the catch-all
wildcard `*/*` SHALL render as `"All files"` rather than falling through to the generic
`"<major> files"` template (which would otherwise render the nonsensical `"* files"`); a
known concrete MIME type SHALL render as its uppercased extension from `MIME_TYPE_EXT_MAP`
(e.g. `application/pdf` → `"PDF"` and
`application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `"DOCX"`), while
an unknown concrete MIME type SHALL fall back to its uppercased subtype.
The `Specification` section's row labels for these two fields SHALL use the i18n keys
`catalog.details.modelSpecification.inputModalities` / `.outputModalities`
(`CatalogI18nKeys.DetailsModelInputModalities` / `DetailsModelOutputModalities`), replacing the
previous untranslated `'Input type'`/`'Output type'` literals. The `Configuration` section's
`Input attachments`/`Output attachments` rows (Agent only) SHALL use the same
`mimeTypesToExtensionLabels` formatting for their values, keeping their existing labels.

The model, application, and toolset `Capabilities` sections built by `mapModelDetails`/
`mapAgentDetails`/`mapToolsetDetails` SHALL NOT render rows for `hasMcp`, `hasCaching`,
`hasUrlAttachments`, `hasFolderAttachments`, `hasSeed`, `hasSystemPrompt`, or `hasResume`, even
though the backend continues to return these flags (`DeploymentFeaturesDetailsDto.mcp`/`cache`/
`urlAttachments`/`folderAttachments`/`seed`/`systemPrompt`/`allowResume`) and the frontend
`ModelCapabilities`/`AgentCapabilities`/`ToolsetCapabilities` types continue to carry them —
they are collected but intentionally unrendered, kept for a future or other consumer. A
toolset's `Capabilities` section — which, before this change, only ever rendered a subset of
these now-hidden flags — SHALL therefore never render at all (its `specs` array is always
empty). Model and application `Capabilities` sections continue to render `Tools`, `Parallel
tool calls`, `Reasoning efforts` (model only), and `Configuration schema` (application only),
and SHALL additionally render a `Skills` row driven by a new `hasSkills` flag, mapped from
`DeploymentFeaturesDetailsDto.skillsSupported` via `mapFeaturesToCapabilities`. Unlike the
seven flags above, `hasSkills` is not deliberately hidden: it SHALL be added to
`ModelCapabilities` and `AgentCapabilities` and rendered as the last row of each entity's
`Capabilities` section, following the same plain-string-literal, boolean Yes/No row pattern as
the existing rows. `ToolsetCapabilities` SHALL NOT gain a `hasSkills` field, since the
toolset `Capabilities` section never renders.

**Feature flag:** Not gated. **RTL impact:** None (label text only). **i18n impact:** New keys
`catalog.details.modelSpecification.inputModalities`/`.outputModalities` added to
`translation-keys.ts`/`en.json`; the seven hidden capability rows had no i18n keys to remove
(they were untranslated string literals); the new `Skills` row likewise uses a plain,
untranslated string literal, consistent with the other rows in this section.

#### Scenario: Wildcard MIME types render as group labels

- **WHEN** a model's `input_attachment_types` is `["text/*", "image/*"]`
- **THEN** the `Specification` section's Input modalities row renders `"Text files, Image files"`

#### Scenario: The catch-all wildcard renders as "All files"

- **WHEN** a model's `input_attachment_types` is `["*/*"]`
- **THEN** the Input modalities row renders `"All files"`, not `"* files"`

#### Scenario: A known concrete MIME type renders as its extension label

- **WHEN** an application's `input_attachment_types` is `["application/pdf"]`
- **THEN** the `Configuration` section's Input attachments row renders `"PDF"`

#### Scenario: A structured vendor MIME type does not render as a raw subtype

- **WHEN** a model's `input_attachment_types` is `["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]`
- **THEN** the `Specification` section's Input modalities row renders `"DOCX"`

#### Scenario: Toolset Capabilities section never renders

- **WHEN** a toolset's `features` includes `mcp: true`, `cache: false`, and `systemPrompt: true`
- **THEN** the toolset's Overview tab data contains no `Capabilities` section at all

#### Scenario: Model Capabilities section omits the seven hidden flags

- **WHEN** a model's `features` includes `mcp`, `cache`, `urlAttachments`, `folderAttachments`,
  `seed`, `systemPrompt`, `allowResume`, `tools: true`, and `parallelToolCalls: true`
- **THEN** the model's `Capabilities` section renders only `Tools` and `Parallel tool calls`
  (plus `Reasoning efforts` when present, plus `Skills` when `skillsSupported` is present),
  with no rows for the seven hidden flags

#### Scenario: Model Capabilities section renders Skills when supported

- **WHEN** a model's `features` includes `skillsSupported: true`
- **THEN** the model's `Capabilities` section renders a `Skills` row with value `true`, after
  the `Tools`, `Parallel tool calls`, and `Reasoning efforts` rows

#### Scenario: Agent Capabilities section renders Skills when supported

- **WHEN** an application's `features` includes `skillsSupported: true`
- **THEN** the application's `Capabilities` section renders a `Skills` row with value `true`,
  after the `Tools`, `Parallel tool calls`, and `Configuration schema` rows

#### Scenario: Skills row is omitted when the backend does not report the flag

- **WHEN** a model's or application's `features` omits `skillsSupported` entirely
- **THEN** the entity's `Capabilities` section renders no `Skills` row, consistent with how
  every other optional Capabilities row is omitted when its backing flag is absent

#### Scenario: Toolset Capabilities section still never renders, even with skillsSupported present

- **WHEN** a toolset's `features` includes `skillsSupported: true`
- **THEN** the toolset's Overview tab data contains no `Capabilities` section at all, since
  `ToolsetCapabilities` does not carry `hasSkills`
