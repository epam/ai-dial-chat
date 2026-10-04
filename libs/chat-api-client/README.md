# @epam/ai-dial-chat-api-client

Generated OpenAPI client for the AI DIAL Chat API.

## Overview

`@epam/ai-dial-chat-api-client` is a fully generated TypeScript client for the AI DIAL Chat backend API. It is produced automatically from `apps/chat-api`'s OpenAPI document using the repository's `npm run openapi` script, which means all request/response DTOs, service method signatures, and endpoint paths stay in sync with the server contract without any manual effort. The package exposes typed API classes and DTO interfaces that can be imported in application-level code for making API calls. Because this client is generated, you must never edit its source files by hand — any change to the API contract goes through the NestJS controllers and DTOs, followed by a regeneration step. To keep other hand-authored libraries free of app-specific transport knowledge, only application adapters (`apps/chat/src/server-api`) import from this package; feature libs stay unaware of the REST layer.

Handler names in `apps/chat-api` become the generated method names through the
`operationIdFactory`, so a controller method called `listModels` surfaces here as
`listModels`. Name backend handlers accordingly.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-chat-api-client": "*"
  }
}
```

The Nx project is named `chat-api-client`, so Nx targets use that name:

```sh
npm exec nx build chat-api-client
npm exec nx lint chat-api-client
```

## Regenerating the client

```sh
npm run openapi        # emit the OpenAPI document and regenerate the client
npm run openapi:check  # fail if the committed client drifted from the document
```

Run both after any backend endpoint change, then build and lint the client and
commit the regenerated output. `npm run openapi:spec` and `npm run openapi:sdk`
run the two halves individually.

## Usage

```ts
import { ModelsApi, Configuration } from '@epam/ai-dial-chat-api-client';

const api = new ModelsApi(new Configuration({ basePath: '' }));
const models = await api.listModels();
```

The generated code targets the Fetch API. All exported types and API classes come
from the generated source under `src/generated/` — refer to the Swagger UI at
`/api/docs` (development builds) or the emitted OpenAPI document for the full
list of endpoints and types.

### Scheduled-task operations

`scheduledTasksApi.startScheduledTask({ scheduleId })` is the generated normal
method for the bodyless manual-run POST and resolves a `ScheduledTaskRunDto`
after HTTP 202. `scheduledTasksApi.getScheduledTaskRun({ scheduleId, runId })`
returns the same camelCase run DTO for a single status read. The optional
`resultStage` field contains the server's narrow credentials-stage projection.
Here `scheduledTasksApi` is a configured `ScheduledTasksApi` instance.
Applications use these methods through their configured app-level API adapter;
feature libraries do not construct this client.

### Custom Core API operations

`customApiApi.getCustomApiOperationRaw({ id })` and the normal
`customApiApi.getCustomApiOperation({ id })` call the disabled-by-default
`GET /api/v1/custom-api/:operationId` bridge (see
`apps/chat-api/README.md#custom-core-api-operations`). The request contract is
intentionally just the path ID — there is no query or body parameter, because
v1 supports neither parameterized calls nor writes.

`CustomApiResponseDto.data` is documented as a free-form object
(`{ [key: string]: unknown }`, since OpenAPI has no "any JSON value"
primitive) but the real runtime value may just as well be an array, string,
number, boolean, or null — the operation is opaque to this generated client by
design. **Do not treat `data`'s generated type as the real shape.** The app
adapter (`apps/chat/src/server-api/custom-api.api.ts`) decodes the whole
envelope as `unknown` using `getCustomApiOperationRaw` and the response's own
`.raw.json()`, rather than trusting `CustomApiResponseDto`'s generated typing;
follow that pattern rather than calling the normal `getCustomApiOperation`
method directly when you need the true unknown boundary.

## Notes

- This library has no hand-authored source and no peer dependencies beyond `tslib`.
- Do not import this package from hand-authored `libs/*` libraries. Consume it through app-level adapters such as `apps/chat/src/server-api`.
- `src/generated/README.md` is emitted by the OpenAPI generator; it is not maintained by hand.
- **Known divergence from `@epam/ai-dial-typescript-sdk`.** `LimitStatsDto` carries an optional
  `resetsAt` (the exclusive end of a stat's current calendar period), but
  `@epam/ai-dial-typescript-sdk@0.1.1` types `CostItemLimitStats` and `ItemLimitStats` as
  `{ total?: number; used?: number }` with no such field. The BFF already returns
  `result.data as unknown as UserLimitStatsResponseDto` from
  `apps/chat-api/src/deployments/details/deployments-details.service.ts`, and that cast is what
  carries `resetsAt` through to this client at runtime. The hand-authored DTO in
  `apps/chat-api/src/openapi/openapi-response.dto.ts` is authoritative for the BFF's published
  contract until the SDK types the field.
