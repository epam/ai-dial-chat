## Decisions

- **D1 — a label per type in `ItemDetailsTexts`.** `entityTypeLabels` is a `Partial<Record<CatalogEntityType, string>>` rather than a single string, because `DetailsPanel` renders many items and `ItemDetailsTexts` is shared across them; a per-render string would force hosts to rebuild `texts` per item.
- **D2 — `label` falls back to `type`.** Keeps every existing render byte-for-byte and the uppercase lead typography unchanged; a host passes the text in the case it wants shown.
