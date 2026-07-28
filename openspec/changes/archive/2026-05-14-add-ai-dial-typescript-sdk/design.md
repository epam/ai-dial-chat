# Design: add-ai-dial-typescript-sdk

## Overview

Enable the `@epam/ai-dial-typescript-sdk` client in the `chat-api` NestJS backend, replacing the commented-out stub in `AppService`. Add two new feature modules — `DeploymentsModule` and `ChatModule` — that expose AI DIAL Core endpoints to the frontend over the existing REST API. Environment variable validation is tightened so `DIAL_CORE_URL` and `DIAL_API_KEY` become required fields that fail fast at startup.

## Architecture

### Updated Application Structure

```
apps/chat-api/src/
├── main.ts                            # (updated) add deployments/chat Swagger tags
├── app/
│   ├── app.module.ts                  # (updated) import DeploymentsModule, ChatModule
│   ├── app.controller.ts              # unchanged
│   └── app.service.ts                 # (updated) uncomment createSDK, expose client
├── config/
│   ├── environment.config.ts          # (updated) DIAL_CORE_URL + DIAL_API_KEY required
│   └── validation.ts                  # unchanged
├── common/
│   └── interceptors/
│       └── metrics.interceptor.ts     # unchanged
├── health/
│   └── health.controller.ts           # unchanged
├── themes/
│   ├── theme.controller.ts            # unchanged
│   ├── theme.service.ts               # unchanged
│   └── ...
├── deployments/
│   ├── deployments.module.ts          # new
│   ├── deployments.controller.ts      # new
│   └── deployments.service.ts         # new
└── chat/
    ├── chat.module.ts                 # new
    ├── chat.controller.ts             # new
    ├── chat.service.ts                # new
    └── dto/
        └── chat-completion.dto.ts     # new
```

### SDK Client Injection Pattern

`AppService` initialises the typed DIAL SDK client and exposes it as a `protected` property so feature services can extend `AppService` and inherit the client without re-instantiating it.

```typescript
// app.service.ts
import { createSDK } from '@epam/ai-dial-typescript-sdk';

@Injectable()
export class AppService {
  protected client: ReturnType<typeof createSDK>;

  constructor(private configService: ConfigService<EnvironmentVariables>) {
    this.client = createSDK({
      baseUrl: this.configService.get('DIAL_CORE_URL', { infer: true }),
      apiKey: this.configService.get('DIAL_API_KEY', { infer: true }),
    });
  }
}
```

Feature services that need the SDK client extend `AppService`:

```typescript
@Injectable()
export class DeploymentsService extends AppService {
  async getDeployments() {
    return this.client.getDeployments();
  }
}
```

This avoids a global DI token for the SDK instance while keeping the client construction centralised.

## Environment Variables

| Variable                    | Type   | Required | Default                 | Description                                   |
| --------------------------- | ------ | -------- | ----------------------- | --------------------------------------------- |
| `DIAL_CORE_URL`             | string | **Yes**  | —                       | Base URL of the DIAL Core API                 |
| `DIAL_API_KEY`              | string | **Yes**  | —                       | API key sent as `Api-Key` header to DIAL Core |
| `PORT`                      | number | No       | `5000`                  | HTTP port the NestJS server listens on        |
| `API_PREFIX`                | string | No       | `api`                   | Global REST prefix                            |
| `CORS_ORIGIN`               | string | No       | `http://localhost:4207` | Allowed CORS origin                           |
| `THEMES_CONFIG_URL`         | string | No       | —                       | External themes service URL                   |
| `THEMES_SERVICE_TIMEOUT_MS` | number | No       | `5000`                  | Timeout (ms) for theme service calls          |

`DIAL_CORE_URL` and `DIAL_API_KEY` change from `@IsOptional()` to `@IsNotEmpty()` + `@IsUrl()` / `@IsString()`. The existing `validate()` function in `config/validation.ts` uses `plainToInstance` + `validateSync`, so any missing required field will throw during `bootstrap()`.

## New API Endpoints

### Deployments

#### GET /api/deployments

Lists all deployments available in DIAL Core.

**Response**: JSON array of deployment objects from the SDK.

**Errors**:

- `502 Bad Gateway` — DIAL Core returned an unexpected response
- `503 Service Unavailable` — DIAL Core is unreachable

**Swagger Tags**: `deployments`

---

#### GET /api/deployments/:deployment

Returns a single deployment by name.

**Path Parameters**: `deployment` — deployment/model identifier

**Response**: Deployment object.

**Errors**:

- `404 Not Found` — deployment does not exist
- `502 Bad Gateway` — unexpected response from DIAL Core

**Swagger Tags**: `deployments`

---

### Chat

#### POST /api/chat/completions/:deployment

Proxies a chat completion request to DIAL Core for the given deployment.

**Path Parameters**: `deployment` — deployment/model identifier

**Request Body**: `ChatCompletionDto`

```typescript
export class ChatCompletionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;
}

export class MessageDto {
  @IsEnum(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content: string;
}
```

**Response**: Chat completion object from DIAL Core (non-streaming).

**Errors**:

- `400 Bad Request` — invalid request body
- `404 Not Found` — deployment does not exist
- `502 Bad Gateway` — DIAL Core returned an invalid response
- `503 Service Unavailable` — DIAL Core is unreachable

**Swagger Tags**: `chat`

## Error Handling Strategy

Feature services wrap SDK calls in try/catch and translate HTTP errors:

| DIAL Core status | NestJS exception              |
| ---------------- | ----------------------------- |
| 404              | `NotFoundException`           |
| 400              | `BadRequestException`         |
| 5xx / network    | `ServiceUnavailableException` |
| Unexpected body  | `BadGatewayException`         |

A shared helper `handleDialError(error: unknown)` in `common/utils/dial-error.ts` centralises this translation so controllers stay thin.

## Testing Strategy

- **Unit tests** for `DeploymentsService` and `ChatService`: mock `AppService.client` using `jest.spyOn` on the service instance after construction; verify correct SDK methods are called and errors are translated.
- **Unit tests** for `DeploymentsController` and `ChatController`: mock the service layer, verify response shapes.
- **Integration tests** (supertest): wire up real NestJS app with mocked `AppService` (inject a stub client), call endpoints, verify HTTP status codes and response structure.
- `AppService` itself is not directly unit-tested for the SDK client; the SDK is third-party and the integration is validated via service tests.

## Swagger Registration

`main.ts` additions to `DocumentBuilder`:

```typescript
.addTag('deployments', 'List and inspect available AI DIAL deployments')
.addTag('chat', 'Chat completion proxy to DIAL Core')
.addBearerAuth()  // placeholder for future user-token forwarding
```
