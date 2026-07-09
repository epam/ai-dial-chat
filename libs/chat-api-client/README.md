# @epam/chat-api-client

Generated OpenAPI client for the AI DIAL Chat API.

## Overview

This package exports a fully generated TypeScript client derived from the Chat API's OpenAPI specification. It provides typed request/response DTOs and service methods for every endpoint. Do not hand-edit the generated files — update the backend Swagger source and regenerate using the repository's OpenAPI scripts.

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
