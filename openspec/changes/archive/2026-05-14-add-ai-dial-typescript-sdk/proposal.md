# Proposal: add-ai-dial-typescript-sdk

## What

Enable the `@epam/ai-dial-typescript-sdk` integration in the `chat-api` NestJS application. The SDK is already installed as a dependency (`0.1.0-dev.21`) but is currently commented out with TODO markers. This change activates the SDK client in `AppService`, makes the required environment variables mandatory, and exposes an initial set of SDK-backed API endpoints for the chat frontend to consume.

## Why

The `app.service.ts` was written with the SDK integration stubbed out pending the SDK package becoming available. The package was published and the project already carries it as a dependency. Keeping the commented-out code in place leaves `DIAL_CORE_URL` and `DIAL_API_KEY` as optional environment variables, which means misconfigured deployments will silently fail at runtime rather than at startup validation. Enabling the SDK unblocks building AI-powered features such as listing models/deployments and sending chat completion requests through the DIAL Core API.

## Goals

1. Activate the `createSDK` client in `AppService` and remove all TODO stubs
2. Make `DIAL_CORE_URL` and `DIAL_API_KEY` required in `EnvironmentVariables` so misconfiguration fails fast at startup
3. Expose a `DeploymentsModule` with at least `GET /api/deployments` so the frontend can list available AI models
4. Forward chat completion requests through a `ChatModule` (`POST /api/chat/completions/:deployment`) proxying to DIAL Core
5. Ensure the SDK client is injectable and mockable in unit tests

## Non-Goals

- Building the full chat UI or frontend integration with the new endpoints
- Adding authentication/authorization to the new endpoints (tracked separately)
- Streaming support for chat completions (future iteration)
- Exposing every SDK method as an endpoint

## Success Criteria

- `AppService` initialises the SDK client at startup with no commented-out code
- Application startup fails with a clear error when `DIAL_CORE_URL` or `DIAL_API_KEY` is missing
- `GET /api/deployments` returns the list of available deployments from DIAL Core
- `POST /api/chat/completions/:deployment` proxies a chat completion request and returns the response
- All new services have unit tests with a mocked SDK client
- Swagger documents the new endpoints
