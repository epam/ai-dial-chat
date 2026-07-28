# Design: add-chat-api-spec

## Overview

The chat-api is a NestJS application that serves as the backend for the chat application. It provides REST API endpoints for theme configuration, serves the compiled frontend application as static files, and integrates with the EPAM AI DIAL SDK for AI-powered chat functionality.

## Architecture

### Application Structure

```
apps/chat-api/src/
├── main.ts                      # Application bootstrap and configuration
├── app/
│   ├── app.module.ts           # Root module with global configuration
│   ├── app.controller.ts       # Base controller (currently empty)
│   └── app.service.ts          # Base service with AI DIAL SDK integration
└── themes/
    ├── theme.controller.ts     # Theme endpoints controller
    └── theme.service.ts        # Theme fetching service
```

### Module Dependencies

- `@nestjs/common` - Core NestJS functionality
- `@nestjs/core` - NestJS application factory
- `@nestjs/config` - Environment configuration
- `@nestjs/serve-static` - Static file serving
- `@nestjs/swagger` - OpenAPI documentation
- `@epam/ai-dial-typescript-sdk` - AI DIAL integration
- `@epam/ai-dial-chat-shared` - Shared types and models

## API Endpoints

### Base Configuration

- **Global Prefix**: `/api` (configurable via `API_PREFIX` env var)
- **Port**: `5000` (configurable via `PORT` env var)
- **CORS Origin**: `http://localhost:4207` (configurable via `CORS_ORIGIN` env var)
- **CORS Credentials**: Enabled

### Theme Endpoints

#### GET /api/themes

Returns the theme configuration from an external themes service.

**Response**: `ThemeConfiguration | null`

**Behavior**:

- Fetches `config.json` from `THEMES_CONFIG_URL` environment variable
- Returns parsed JSON on success
- Returns `null` on fetch error or invalid JSON
- No error status codes returned; errors are silently converted to `null`

**OpenAPI Tags**: `themes`

**Swagger Annotations**:

- Operation: "Get themes configuration"
- 200 Response: "Success"

#### GET /api/themes/icon

Returns a theme icon as SVG content.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|--------|----------|-----------------------|
| iconName | string | Yes | Icon filename to fetch|

**Response**: SVG text content or `null`

**Headers**:

- `Content-Type: image/svg+xml; charset=utf-8`

**Behavior**:

- Fetches icon from `${THEMES_CONFIG_URL}/${iconName}`
- Returns SVG text content on success
- Returns `null` if:
  - `THEMES_CONFIG_URL` is not set
  - Fetch fails
  - Response is not OK (status >= 400)
- Logs fetch attempts and results to console

**OpenAPI Tags**: `themes`

**Swagger Annotations**:

- Operation: "Get theme icon"
- 200 Response: "Success"
- 404 Response: "Not Found"

**Note**: The service returns `null` instead of throwing 404 errors, which may cause the endpoint to return 200 with null body instead of proper 404 status.

### App Endpoints

#### AppController

Currently empty. The controller exists as a placeholder under the `/api/apps` path but defines no endpoints.

**OpenAPI Tags**: `apps`

## Services

### AppService

**Responsibilities**:

- Initialize AI DIAL SDK client
- Provide SDK client to other services (if extended)

**Configuration**:
| Property | Source | Required | Description |
|----------|--------|----------|-------------|
| baseUrl | `DIAL_CORE_URL` | Yes | AI DIAL core service URL |
| apiKey | `DIAL_API_KEY` | Yes | AI DIAL authentication key |

**Methods**:

- `getData()`: Returns user info from AI DIAL SDK (cast to `{ message: string }`)

**Note**: `getData` method exists but is not used by any controller endpoint.

### ThemeService

**Responsibilities**:

- Fetch theme configuration from external service
- Fetch theme icon files

**Dependencies**:

- `THEMES_CONFIG_URL` environment variable

**Methods**:

| Method                           | Return Type                           | Description                             |
| -------------------------------- | ------------------------------------- | --------------------------------------- |
| `getThemes()`                    | `Promise<ThemeConfiguration \| null>` | Fetches config.json from themes service |
| `getThemeIcon(iconName: string)` | `Promise<Response \| null>`           | Fetches icon SVG from themes service    |

**Error Handling**:

- All fetch errors are caught and converted to `null`
- No errors are logged except console logs in `getThemeIcon`
- No retry logic or timeout configuration

## Configuration

### Environment Variables

| Variable            | Required | Default                 | Description                                |
| ------------------- | -------- | ----------------------- | ------------------------------------------ |
| `PORT`              | No       | `5000`                  | HTTP server port                           |
| `API_PREFIX`        | No       | `api`                   | Global route prefix                        |
| `CORS_ORIGIN`       | No       | `http://localhost:4207` | Allowed CORS origin                        |
| `DIAL_CORE_URL`     | Yes      | -                       | AI DIAL core service URL                   |
| `DIAL_API_KEY`      | Yes      | -                       | AI DIAL authentication key                 |
| `THEMES_CONFIG_URL` | Yes      | `''`                    | Base URL for theme configuration and icons |

**Configuration Loading**:

- Uses `@nestjs/config` with `ConfigModule.forRoot()`
- Global configuration (available in all modules)
- Loads from `.env.local` first, then `.env`
- No validation schema defined

### Static File Serving

**Configuration**:

- **Root Path**: `dist/apps/chat` (built frontend)
- **Exclude Pattern**: `/api*` (prevents serving static files for API routes)
- Module: `ServeStaticModule.forRoot()`

**Behavior**:

- All non-API requests serve static files from the compiled frontend
- Frontend SPA routing handled by serving `index.html` for unmatched routes

## Swagger/OpenAPI Documentation

**Configuration**:

- **Title**: "Chat API"
- **Description**: "Chat application API documentation"
- **Version**: "1.0"
- **Authentication**: Bearer token (configured but not enforced)

**Access**:

- URL: `http://localhost:{PORT}/api/docs`
- Auto-generated from controller decorators
- Tags: `apps`, `themes`

**Annotations Used**:

- `@ApiTags()` - Group endpoints
- `@ApiOperation()` - Describe operations
- `@ApiResponse()` - Document response codes
- `@ApiQuery()` - Document query parameters (not currently used)

## Known Gaps

### 1. No Error Handling in Theme Endpoints

**Issue**: Theme service catches all errors and returns `null`, but the controller returns 200 OK with `null` body instead of proper HTTP error codes.

**Impact**:

- Clients cannot distinguish between "themes not configured" and "service unavailable"
- 404 annotation on `/themes/icon` is misleading (endpoint never returns 404)

**Recommendations**:

- Throw proper HTTP exceptions in service layer
- Return 404 when icon is not found
- Return 503 when external service is unavailable
- Return 500 for unexpected errors

### 2. No Environment Variable Validation

**Issue**: Required environment variables (`DIAL_CORE_URL`, `DIAL_API_KEY`, `THEMES_CONFIG_URL`) are accessed directly without validation at startup.

**Impact**:

- Application may start with missing configuration
- Errors only surface when endpoints are called
- `as string` cast can result in `undefined` values

**Recommendations**:

- Add `@nestjs/config` validation schema with class-validator
- Validate required variables at application bootstrap
- Fail fast with clear error messages if configuration is incomplete

### 3. Unused AppService.getData() Method

**Issue**: `getData()` method exists but is not exposed via any controller endpoint.

**Impact**:

- Dead code that may confuse developers
- Unclear whether this was intended to be an endpoint

**Recommendations**:

- Remove the method if not needed
- Add a controller endpoint if user info should be exposed

### 4. Console.log Instead of Logger

**Issue**: `ThemeService.getThemeIcon()` uses `console.log` for debugging instead of NestJS Logger.

**Impact**:

- Inconsistent logging
- Logs not integrated with application logger
- Debugging logs visible in production

**Recommendations**:

- Inject `Logger` service
- Use structured logging with log levels
- Remove or move to debug level for production

### 5. No Request Validation

**Issue**: Query parameters like `iconName` are not validated.

**Impact**:

- Path traversal vulnerability risk (e.g., `../../../etc/passwd`)
- No validation of icon name format

**Recommendations**:

- Add `class-validator` DTOs for query parameters
- Validate icon name format (e.g., only alphanumeric, dash, underscore)
- Use `@nestjs/common` ValidationPipe globally

### 6. No Test Coverage

**Issue**: No unit tests or integration tests exist for controllers or services.

**Impact**:

- Difficult to validate behavior
- Risk of regressions
- Unclear API contracts

**Recommendations**:

- Add unit tests for `ThemeService` (mock fetch)
- Add integration tests for theme endpoints
- Add tests for environment variable handling

### 7. Bearer Auth Configured But Not Used

**Issue**: Swagger includes `addBearerAuth()` but no authentication guards are implemented.

**Impact**:

- Misleading API documentation
- False sense of security
- Unclear whether authentication is planned

**Recommendations**:

- Remove bearer auth from Swagger if not used
- Add note in spec about future authentication plans
- Implement auth guards if needed

## Testing Strategy

**Current State**: No tests exist

**Recommended Coverage**:

| Scenario                                        | Test Type   | Priority |
| ----------------------------------------------- | ----------- | -------- |
| Theme configuration fetch success               | Unit        | High     |
| Theme configuration fetch failure               | Unit        | High     |
| Theme icon fetch with valid name                | Unit        | High     |
| Theme icon fetch with missing THEMES_CONFIG_URL | Unit        | High     |
| Theme icon fetch with 404 response              | Unit        | High     |
| CORS configuration enforcement                  | Integration | Medium   |
| Static file serving for frontend routes         | Integration | Medium   |
| API prefix applied to all endpoints             | Integration | Medium   |
| Environment variable validation at startup      | Integration | High     |
| Icon name path traversal prevention             | Integration | High     |

**Framework**: Jest (NestJS default)

**Tools**:

- `@nestjs/testing` for module testing
- `supertest` for HTTP endpoint testing
- Mock `fetch` for external service calls

## Deployment Considerations

### Prerequisites

- Node.js runtime
- Environment variables configured
- Frontend application built to `dist/apps/chat`
- Access to AI DIAL core service
- Access to themes configuration service

### Build Process

```bash
nx build chat-api          # Build API
nx build chat              # Build frontend
```

### Runtime Requirements

- All required environment variables set
- Network access to external services
- Port 5000 (or configured PORT) available

### Health Check

- No dedicated health check endpoint
- Swagger docs at `/api/docs` can serve as liveness indicator

## Security Considerations

### Current State

- No authentication or authorization
- CORS configured for specific origin
- No rate limiting
- No input validation
- Potential path traversal in icon endpoint

### Recommendations

1. Add input validation for all parameters
2. Implement authentication guards
3. Add rate limiting for public endpoints
4. Sanitize icon name parameter
5. Add security headers (helmet middleware)
6. Implement proper error handling (no information leakage)

## Future Enhancements

1. Add conversation/message endpoints
2. Implement authentication/authorization
3. Add WebSocket support for real-time chat
4. Add database integration for message persistence
5. Add caching for theme configuration
6. Add health check endpoint
7. Add metrics/monitoring integration
