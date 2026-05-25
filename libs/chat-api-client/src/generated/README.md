# @epam/chat-api-client

> **Auto-generated** TypeScript/Fetch client for the Chat API (`apps/chat-api`).  
> Do not edit files under `src/generated/` by hand — regenerate them instead (see below).

## Overview

This library is produced by [OpenAPI Generator](https://openapi-generator.tech) (`typescript-fetch`) from
`libs/chat-api-client/openapi.json`, which is itself generated from the NestJS controllers in `apps/chat-api`.

The full pipeline:

```
NestJS controllers (@ApiProperty decorators)
  → openapi.json  (libs/chat-api-client/openapi.json)
  → TypeScript Fetch client  (libs/chat-api-client/src/generated/)
```

## Available API classes

| Class | Base path | Auth required |
|---|---|---|
| `AuthApi` | `/api/v1/auth` | public |
| `ThemesApi` | `/api/themes` | public |
| `HealthApi` | `/api/health` | public |
| `DeploymentsApi` | `/api/deployments` | session cookie |
| `ModelsApi` | `/api/v1/models` | session cookie |
| `ChatApi` | `/api/chat/completions` | session cookie |
| `ConversationsApi` | `/api/v1/conversations` | session cookie |
| `RateApi` | `/api/v1/rate` | session cookie |

## Usage

```ts
import { Configuration, ModelsApi, ConversationsApi } from '@epam/chat-api-client';

const config = new Configuration({ basePath: 'http://localhost:3005' });

const modelsApi = new ModelsApi(config);
const models = await modelsApi.getModels();

const conversationsApi = new ConversationsApi(config);
const conversation = await conversationsApi.createConversation({
  createConversationDto: { title: 'My chat' },
});
```

## Regenerating the client

> **Prerequisites:** Java must be installed (the OpenAPI Generator CLI is Java-based).

### Full pipeline (spec + client)

```bash
npm run openapi
# equivalent to:
npm exec nx run chat-api:openapi
```

### Step by step

```bash
# 1. Regenerate openapi.json from NestJS controllers
npm exec nx run chat-api:openapi-spec

# 2. Regenerate the TypeScript client from openapi.json
npm exec nx run chat-api:openapi-sdk
```

### Windows note

The Nx targets use the `env` option in `apps/chat-api/package.json` to set environment variables
cross-platform (e.g. `SWC_NODE_PROJECT`, proxy vars). Do **not** use the `VAR=value cmd` inline
syntax — it only works on Unix shells.

## Development

The generated files live in `src/generated/` and are committed to the repository.
The only hand-written file is `src/index.ts`, which re-exports everything:

```ts
export * from './generated/src/index';
```

After any change to a controller, DTO, or Swagger decorator in `apps/chat-api`, run the pipeline
above and commit both `openapi.json` and the updated `src/generated/` files together.
