## ADDED Requirements

### Requirement: Skills domain module uses generated client
`apps/chat/src/server-api/api-client.ts` SHALL export a `skillsApi` singleton, built from `SkillsApi` in `@epam/chat-api-client` using the shared `createApiConfiguration()` factory, alongside the existing `modelsApi`/`deploymentsApi`/`conversationsApi`/`filesApi` singletons.

`apps/chat/src/server-api/skills.api.ts` SHALL provide thin wrapper functions for all 10 skill operations, delegating to `skillsApi`, following the exact pattern `apps/chat/src/server-api/files.api.ts` already establishes for its own domain.

#### Scenario: skillsApi singleton is exported
- **WHEN** `apps/chat/src/server-api/api-client.ts` is inspected
- **THEN** it exports `export const skillsApi = new SkillsApi(config);` alongside the other domain singletons

#### Scenario: Binary skill downloads use Raw generated methods
- **WHEN** `downloadSkill`/`downloadSkillFile` are called from `apps/chat/src/server-api/skills.api.ts`
- **THEN** they call `skillsApi.downloadSkillRaw(...)`/`skillsApi.downloadSkillFileRaw(...)` to obtain the raw `fetch` `Response` (whose `.body` is a `ReadableStream`), documenting the same generator gap `files.api.ts:downloadFile` already documents for `application/octet-stream`/`application/zip` responses

#### Scenario: ETag-returning mutations use Raw generated methods
- **WHEN** `uploadSkill`, `uploadSkillFile`, `deleteSkillFile`, or `createSkillGroupingFolder` are called from `skills.api.ts` and the caller needs the returned `ETag` header
- **THEN** the wrapper calls the corresponding `*Raw` generated method to read `response.headers.get('etag')`, since the generator does not surface response headers on the non-`Raw` method's parsed return value

#### Scenario: Non-binary, non-ETag operations use normal generated methods
- **WHEN** `listSkills`, `listSkillFiles`, `deleteSkill`, or `deleteSkillGroupingFolder` are called from `skills.api.ts`
- **THEN** they use the normal (non-`Raw`) generated method, since their response is a small JSON body with no header the caller needs

#### Scenario: No hand-edited generated files
- **WHEN** the skills OpenAPI contract changes
- **THEN** `npm run openapi` and `npm run openapi:check` regenerate `libs/chat-api-client`'s `SkillsApi` and model classes — no file under `libs/chat-api-client/` is hand-edited
