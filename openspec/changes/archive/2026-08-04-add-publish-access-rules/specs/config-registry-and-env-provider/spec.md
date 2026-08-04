## ADDED Requirements

### Requirement: Registry declares the publish.publicationFilterSources key

`CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include a new entry:

- `key='publish.publicationFilterSources'`
- `type='config'`
- `valueType='json'`
- `visibility='client'`
- `defaultValue=['title', 'role', 'dial_roles']`
- `critical=false`
- `envVar='PUBLICATION_FILTER_SOURCES'`
- `description` — summarizes that this is the allowed set of claim/category names selectable as a publication access rule's `source`.
- `owner` — matches the ownership convention used by other registry entries (`'chat-team'`).

This follows the exact pattern of the existing `customVisualizers` and `uiFeatures.enabledUiFeatures` entries: a `valueType='json'` array resolved from a comma-separated environment variable, with a non-empty compiled-in default so the feature (the access-rules source picker) is always usable even when the operator has not configured anything.

**Feature flag:** Not gated. The registry entry is a backend implementation detail with no user-visible feature flag of its own — the rules editor UI is always shown (see `publish-access-rules-editor`), and this key only controls the *content* of its source list.

**RTL impact:** None. **i18n impact:** None (raw claim/category strings, not localized labels — see design.md's Open Questions).

#### Scenario: Registry contains the publish.publicationFilterSources key
- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='publish.publicationFilterSources'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='PUBLICATION_FILTER_SOURCES'`, and `defaultValue=['title', 'role', 'dial_roles']`

#### Scenario: Env resolves to a parsed, trimmed array
- **WHEN** `PUBLICATION_FILTER_SOURCES=roles, department , title` is set and the config is resolved
- **THEN** the resolved value is `['roles', 'department', 'title']` (trimmed, comma-separated)

#### Scenario: Missing env falls back to the product default
- **WHEN** `PUBLICATION_FILTER_SOURCES` is unset
- **THEN** the resolved value is `['title', 'role', 'dial_roles']`

#### Scenario: Empty env value falls back to the default, not an empty list
- **WHEN** `PUBLICATION_FILTER_SOURCES` is set to an empty string
- **THEN** the resolved value is `['title', 'role', 'dial_roles']`, not `[]` — an empty source list would make the access-rules source picker unusable, the same footgun already prevented for `uiFeatures.enabledUiFeatures`
