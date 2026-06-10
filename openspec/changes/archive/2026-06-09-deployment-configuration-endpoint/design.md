## Context

DIAL Core exposes `GET /v1/deployments/{deployment_name}/configuration` returning a JSON Schema object. A deployment advertises support for this via `features.configuration: true` in its listing. The chat-api backend already proxies DIAL Core calls through the `@epam/ai-dial-typescript-sdk` client (the `configurationDeployment` method is available).

Current state (after implementation):
- `apps/chat-api/src/deployments/` has `getDeployments`, `getDeployment`, and `getDeploymentConfiguration`; the controller exposes `GET :deployment/configuration` (unversioned — `DeploymentsController` has no `version: '1'` decorator, so the route resolves to `/api/deployments/...`)
- `apps/chat/src/server-api/deployments.ts` exports `getDeploymentConfiguration`
- `ModelsContext` exposes `selectedModelConfiguration: DeploymentConfigurationSchema | null`; the previously present `selectedModel: DialModelDto | null` field has been removed
- `@epam/chat-api-client` `DeploymentsApi` includes `getDeploymentConfiguration`
- `StarterButtons` component renders conversation-starter buttons on the welcome screen

## Goals / Non-Goals

**Goals:**
- Proxy `GET /v1/deployments/{deployment_name}/configuration` through chat-api as `GET /api/deployments/:deployment/configuration`
- Expose the result as `selectedModelConfiguration: DeploymentConfigurationSchema | null` in `ModelsContext`
- Type the schema properly with named interfaces in `libs/chat-shared` (including `StarterOption` for the `oneOf` starters array)
- Update `@epam/chat-api-client` spec + regenerate the client so the frontend uses a typed generated method
- Cache the configuration response server-side (short TTL, keyed by user + deployment name)
- Render conversation-starter buttons on the welcome screen from the schema's `starter.oneOf` entries

**Non-Goals:**
- Rendering a full configuration UI panel — only starter buttons are implemented in this change
- Validating or applying configuration in completion requests — separate concern
- Gating the call on `features.configuration` — always fetch; let DIAL Core return 404 for unsupported deployments
- Handling `submit: false` starters differently (populate-only without auto-send) — starters always call `handleSend` for now

## Decisions

### 1. Route placement: `DeploymentsController`, not a new controller
The configuration schema belongs to the deployment domain. Adding `GET :deployment/configuration` to `DeploymentsController` keeps routing consistent with the existing `GET :deployment` pattern and avoids a new module. NestJS param matching makes `:deployment/configuration` unambiguous since `configuration` is a literal path segment.

Note: `DeploymentsController` has **no `version: '1'` decorator** (unlike `ModelsController`), so the route resolves to `/api/deployments/:deployment/configuration`, not `/api/v1/...`. All references in the openapi spec, generated client, and frontend server-api helper use the unversioned path.

*Alternative considered*: a standalone `ConfigurationController`. Rejected — overkill for one route, splits cohesive deployment concerns.

### 2. Return type: typed interfaces in `libs/chat-shared`, not `Record<string, unknown>`
DIAL Core returns a JSON Schema object with a consistent top-level shape: `type`, `title`, `additionalProperties`, and a `properties` map. The `starter` property's `oneOf` array contains entries with a concrete shape confirmed from the live API response: `{ const: number, title: string, "dial:widgetOptions": { populateText: string, submit: boolean, confirmationMessage: string | null } }`.

Four interfaces are defined in `libs/chat-shared/src/models/deployment-configuration.ts`:

```ts
export interface StarterWidgetOptions {
  populateText: string;
  submit: boolean;
  confirmationMessage: string | null;
}

export interface StarterOption {
  const: number;
  title: string;
  'dial:widgetOptions': StarterWidgetOptions;
}

export interface DeploymentConfigurationSchemaProperty {
  default?: unknown;
  description?: string;
  'dial:widget'?: string;
  oneOf?: StarterOption[] | unknown[];
  [key: string]: unknown;
}

export interface DeploymentConfigurationSchema {
  type?: string;
  title?: string;
  additionalProperties?: boolean | Record<string, unknown>;
  properties?: Record<string, DeploymentConfigurationSchemaProperty>;
  [key: string]: unknown;
}
```

The backend DTO and generated client keep `Record<string, unknown>` (DIAL Core's own type); the frontend server-api helper casts the result to `DeploymentConfigurationSchema`. `ModelsContext` stores `DeploymentConfigurationSchema | null` — `null` for deployments that don't support configuration.

*Alternative considered*: keep `Record<string, unknown>` everywhere. Rejected — callers would need casts at every use site and get no autocomplete on the standard fields.

### 3a. Starter button data flow: `title` as label, `populateText` as sent text
Each `StarterOption` has two distinct text fields: `title` (display label) and `dial:widgetOptions.populateText` (the actual prompt text to send). `StarterButtons` displays `starter.title` and calls `onSelect(starter['dial:widgetOptions'].populateText)` on click. This keeps the button label concise while sending the full prompt.

### 4. Cache strategy: in-memory, 60-second TTL, keyed by `userSub + deploymentName`
Configuration schemas change only on DIAL Core redeploy. A 60-second TTL (same as `getModel`) balances freshness with DIAL Core load. Cache is scoped per user because DIAL Core may serve different schemas to different users (access-controlled deployments).

*Alternative*: no cache. Rejected — each model selection fires the call; caching avoids redundant upstream hits.

### 5. Frontend: fetch configuration in `ModelsContext`, remove `selectedModel`
`ModelsContext` previously exposed both `selectedModel: DialModelDto | null` (full model DTO) and would have also exposed `selectedModelConfiguration`. Since the configuration schema supersedes the need for the raw model DTO in current consumers, `selectedModel` has been removed to keep the context lean. `selectedModelConfiguration` fires when `selectedModelId` changes via its own `useEffect` with a `cancelled` flag for cleanup.

*Alternative*: keep `selectedModel` alongside `selectedModelConfiguration`. Rejected — no current consumer needed `selectedModel` after the configuration schema became available; removing it avoids a redundant upstream call.

### 6. `@epam/chat-api-client` update: add operation to openapi.json, regenerate
The generated client is the contract between backend and frontend. Rather than calling `fetch` directly in the server-api helper, the existing generation pipeline (`openapi.json` → generator → `DeploymentsApi`) is extended so the new operation is typed and documented. Because `node_modules/@epam/chat-api-client` is a symlink to `libs/chat-api-client`, the source was edited directly and rebuilt with `npm exec nx build chat-api-client`.

## Risks / Trade-offs

- **DIAL Core returns 404 for non-configurable deployments** → Frontend catches and sets `selectedModelConfiguration = null`. No user-visible error; downstream UI simply sees `null` and `StarterButtons` renders nothing.
- **SDK `configurationDeployment` method availability** → Confirmed present at `this.client.configurationDeployment(name, ...)` in `@epam/ai-dial-typescript-sdk`. If the SDK is upgraded and the method signature changes, `DeploymentsService.getDeploymentConfiguration` is the single point to update.
- **`DeploymentConfigurationSchema` is partially typed** → The index signature `[key: string]: unknown` keeps it open for schema keywords not yet seen. If a deployment returns a top-level field not in the interface, it remains accessible; no runtime breakage.
- **`StarterOption` types are inferred from observed API responses** → The interface matches the confirmed live response shape `{ const, title, "dial:widgetOptions": { populateText, submit, confirmationMessage } }`. If DIAL Core adds or changes fields, `StarterWidgetOptions`/`StarterOption` will need updating; the index signature on `DeploymentConfigurationSchemaProperty` absorbs unknown top-level property fields.
- **`submit: false` starters not handled** → Starters with `submit: false` are intended to populate the input without auto-sending. Currently all starters call `handleSend` directly. This is a known non-goal for this change and should be addressed when conversation input population without submission is implemented.
