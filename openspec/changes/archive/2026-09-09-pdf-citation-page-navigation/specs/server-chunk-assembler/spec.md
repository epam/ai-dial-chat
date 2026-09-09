## ADDED Requirements

### Requirement: PDF citation selectors survive server assembly and serialization

The server SHALL preserve optional `body.selector` and supplied annotation indexes when normalizing raw `html_tag` citations. Quote-only updates SHALL preserve prior selector data. Legacy `pdf_region` normalization SHALL place its PDF location in `body.selector`, consistent with the frontend. The conversation message DTO and generated OpenAPI client SHALL support object-or-array body selectors and nested validation without adding an endpoint or changing authorization.

#### Scenario: Streamed PDF citation followed by a quote-only delta

- **WHEN** an indexed citation with page 3 in its body selector is assembled and later receives a quote-only delta for that index
- **THEN** serialization and reload retain page 3, the index and the html-tag marker target

#### Scenario: Validated message carries an object or array selector

- **WHEN** a conversation message passes through the production-style transforming, whitelisting validation pipe with either selector shape
- **THEN** the PDF location survives serialization; a string-valued nested page fails numeric validation
