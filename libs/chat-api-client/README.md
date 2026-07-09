# @epam/chat-api-client

Generated OpenAPI client for the AI DIAL Chat API.

## Overview

`@epam/chat-api-client` is a fully generated TypeScript client for the AI DIAL Chat backend API. It is produced automatically from the backend's OpenAPI/Swagger specification using the repository's `npm run openapi` script, which means all request/response DTOs, service method signatures, and endpoint paths stay in sync with the server contract without any manual effort. The package exposes typed service classes and DTO interfaces that can be imported in application-level code for making API calls. Because this client is generated, you must never edit its source files by hand — any change to the API contract should go through the backend Swagger source, followed by a regeneration step. To keep other hand-authored libraries free of app-specific transport knowledge, only application adapters (e.g. `apps/chat/src/server-api`) should import from this package; feature libs should remain unaware of the REST layer.

## Installation

```json
{
  "dependencies": {
    "@epam/chat-api-client": "*"
  }
}
```

## Regenerating the client

```sh
npm run openapi
npm run openapi:check
```

Run these commands after any backend endpoint change, then build and lint the client.

## Usage

```tsx
import { SomeService, SomeResponseDto } from '@epam/chat-api-client';

const result: SomeResponseDto = await SomeService.someEndpoint();
```

All exported types and service classes come from the generated source. Refer to the OpenAPI specification or the Swagger UI for the full list of available endpoints and types.

## Notes

- This library has no peer dependencies — it is safe to import from both apps and other libraries.
- Do not import this package from hand-authored `libs/*` libraries. Consume it through app-level adapters such as `apps/chat/src/server-api`.
