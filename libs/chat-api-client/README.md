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

## Notes

- This library has no hand-authored source and no peer dependencies beyond `tslib`.
- Do not import this package from hand-authored `libs/*` libraries. Consume it through app-level adapters such as `apps/chat/src/server-api`.
- `src/generated/README.md` is emitted by the OpenAPI generator; it is not maintained by hand.
