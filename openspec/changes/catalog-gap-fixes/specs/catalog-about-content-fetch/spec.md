## ADDED Requirements

### Requirement: fetchEntityAboutContent server-api adapter

`apps/chat/src/server-api/catalog.api.ts` SHALL export a function `fetchEntityAboutContent(id: string): Promise<string | undefined>`.

The function SHALL:
- Call `GET /api/v1/catalog/{id}/about` through the generated `@epam/chat-api-client` (operationId: `catalogControllerGetAboutContent`; SDK method: `CatalogApi.catalogControllerGetAboutContent({ id })`).
- Return the `content` string from the response body on success.
- Return `undefined` when the endpoint responds 404 (item has no about content) without throwing.
- Propagate any other HTTP error as a thrown error.
- Not import from apps/chat-api, not call `base.ts` helpers, and not access session/cookie state.

Response DTO: `{ content: string }`. Example response:
```json
{ "content": "## GPT-4o\nOpenAI's flagship model…" }
```

i18n keys: none.
RTL impact: none.
Feature gate: none — the adapter function is always available; its caller (`CatalogView`) gates behavior by whether `onFetchAboutContent` is provided.
Observability: none.
Cache: none on the frontend; backend caching is out of scope for this change.

#### Scenario: Successful about-content fetch

- **WHEN** `fetchEntityAboutContent('model-gpt4o')` is called and the server responds `200 { content: '## GPT-4o\n…' }`
- **THEN** the function resolves with the string `'## GPT-4o\n…'`

#### Scenario: 404 — no about content for item

- **WHEN** `fetchEntityAboutContent('model-no-about')` is called and the server responds `404`
- **THEN** the function resolves with `undefined` without throwing

#### Scenario: Non-404 error propagates

- **WHEN** `fetchEntityAboutContent('model-x')` is called and the server responds `503`
- **THEN** the function throws (rejects) so the caller can handle the error

---

### Requirement: CatalogView wires fetchEntityAboutContent

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL replace the `Promise.resolve(undefined)` stub for `fetchAboutContent` with a call to `fetchEntityAboutContent(item.id)` imported from `@/server-api/catalog.api`.

The `// TODO: replace with a real API call` comment SHALL be removed.

The `/* eslint-disable @typescript-eslint/no-empty-function */` directive at the top of `CatalogView.tsx` SHALL be removed if `fetchAboutContent` was the only empty function.

i18n keys: none.
RTL impact: none.
Memoisation: the `fetchAboutContent` callback SHALL remain wrapped in `useCallback` with an empty dependency array.

#### Scenario: Details panel triggers real fetch

- **WHEN** the user opens the details panel for a catalog item
- **THEN** `onFetchAboutContent` calls `fetchEntityAboutContent` with the item's id

#### Scenario: Undefined returned when no content — panel shows fallback

- **WHEN** `fetchEntityAboutContent` resolves `undefined`
- **THEN** `DetailsPanel` displays the item's `longDescription` as the About-tab fallback (existing behaviour unchanged)
