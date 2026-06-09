# Chat API

NestJS backend application for the chat platform. Provides REST API endpoints for theme configuration, serves the frontend application, and integrates with the EPAM AI DIAL SDK.

## Features

- 🚀 NestJS framework with TypeScript
- 📚 Swagger/OpenAPI documentation
- 🌐 CORS configuration
- 📦 Static file serving for React frontend
- ⚙️ Environment validation at startup
- 🔌 AI DIAL SDK integration (placeholder for future implementation)
- 🎨 Theme management endpoints
- 🏥 Health check endpoint
- ✅ Input validation with class-validator
- 🛡️ Path traversal protection
- ⏱️ Configurable request timeouts
- 📝 Comprehensive error handling
- 🗄️ In-memory caching (5-minute TTL)
- 🔒 Security headers (helmet middleware)
- 🚦 Rate limiting (100 req/min default)
- 📊 Request metrics logging

## Prerequisites

- Node.js 18+
- npm
- Access to AI DIAL core service
- Access to themes configuration service

## Getting Started

### 1. Install Dependencies

From the root of the monorepo:

```bash
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# Required
AUTH_SESSION_SECRET=<64-character-hex-secret>
AUTH_CALLBACK_BASE_URL=http://localhost:3005
AUTH_PROVIDERS=[{"id":"your-provider","issuer":"https://your-issuer.example.com","clientId":"your-client-id","clientSecret":"<client-secret>","scope":"openid email profile offline_access","rolesClaim":"roles","adminRoles":["admin"],"postLogoutRedirectUri":"http://localhost:4207"}]

# Optional
PORT=3005
API_PREFIX=api
CORS_ORIGIN=http://localhost:4207
DIAL_CORE_URL=https://your-dial-service.com
DIAL_API_VERSION=2024-10-21
DIAL_API_KEY=your-secret-api-key
THEMES_CONFIG_URL=https://your-themes-service.com
THEMES_SERVICE_TIMEOUT_MS=5000
# Local HTTP smoke only. Keep true/default for HTTPS and production-like runs.
AUTH_COOKIE_SECURE=false
```

**Note**: `.env.local` takes precedence over `.env` and is not committed to version control.

#### Environment Variables

**Required:**

| Variable                 | Description                                            | Example                        |
| ------------------------ | ------------------------------------------------------ | ------------------------------ |
| `AUTH_SESSION_SECRET`    | 32-byte session encryption key encoded as 64 hex chars | `<64-character-hex-secret>`    |
| `AUTH_CALLBACK_BASE_URL` | Public API base URL used for OIDC redirect URIs        | `http://localhost:3005`        |
| `AUTH_PROVIDERS`         | JSON array of OIDC provider configs                    | `[{"id":"your-provider",...}]` |

**Optional:**

| Variable                       | Default                 | Description                                                                                               |
| ------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `PORT`                         | `3005`                  | HTTP server port                                                                                          |
| `API_PREFIX`                   | `api`                   | Global route prefix for all API endpoints                                                                 |
| `CORS_ORIGIN`                  | `http://localhost:4207` | Allowed CORS origin for frontend                                                                          |
| `AUTH_SESSION_COOKIE_NAME`     | `__Host-chat.sess`      | Session cookie name                                                                                       |
| `AUTH_TRANSACTION_COOKIE_NAME` | `__Host-chat.tx`        | Login transaction cookie name                                                                             |
| `AUTH_COOKIE_SECURE`           | `true`                  | Set to `false` only for local HTTP smoke testing; runtime drops `__Host-` from cookie names when disabled |
| `DIAL_CORE_URL`                | —                       | AI DIAL core service URL                                                                                  |
| `DIAL_API_VERSION`             | `2024-10-21`            | API version query parameter sent to DIAL Core chat completion requests                                    |
| `DIAL_API_KEY`                 | —                       | AI DIAL authentication key                                                                                |
| `THEMES_CONFIG_URL`            | —                       | Base URL for theme configuration and icons                                                                |
| `THEMES_SERVICE_TIMEOUT_MS`    | `5000`                  | Timeout for theme service requests (milliseconds)                                                         |
| `FILE_UPLOAD_MAX_BYTES`        | `536870912`             | Maximum file upload size in bytes (default 512 MB); multer rejects larger payloads with 413               |
| `FILE_TRANSFER_TIMEOUT_MS`     | `30000`                 | Timeout for DIAL Core file upload/download fetch requests (milliseconds)                                  |
| `ASR_MODEL`                    | —                       | Deployment ID of a dedicated speech-to-text model. When set (together with the `voice-input` feature), the mic button is always shown and recorded audio is transcribed by this model via `POST /api/v1/transcription`. When absent, the mic button is shown only for deployments whose `inputAttachmentTypes` include an audio MIME type, and transcription is handled by the selected chat deployment. |
| `TRANSCRIBE_SIZE_LIMIT_BYTES`  | `5242880`               | Maximum audio file size (in bytes) accepted for transcription. The frontend rejects recordings larger than this before upload. Default is 5 MB.                                                           |

### 3. Run the Application

**Development mode:**

```bash
npm run start:api
```

**Development mode (watch mode):**

```bash
npx nx serve chat-api
```

**Production build:**

```bash
npm run build && npm run build:api
```

**Build and start both frontend and API:**

```bash
npm run start:all
```

The API will be available at:

- **API**: `http://localhost:3005/api`
- **Swagger Docs**: `http://localhost:3005/api/docs`
- **Health Check**: `http://localhost:3005/api/health`

## API Documentation

Interactive API documentation is available at `/api/docs` when the application is running. The documentation is auto-generated from TypeScript decorators and includes:

- All available endpoints
- Request/response schemas
- Error responses
- Query parameter validation rules

## API Endpoints

### Health

- **GET** `/api/health` - Application health status
  - Returns: `{ status: "ok", timestamp: "...", version: "1.0.0" }`

### Themes

- **GET** `/api/themes` - Get themes configuration
  - Returns: Theme configuration object
  - Errors: 404, 502, 503

- **GET** `/api/themes/icon?iconName={name}` - Get theme icon SVG
  - Query params: `iconName` (validated, alphanumeric + dash/underscore/dot only)
  - Returns: SVG content with `image/svg+xml` content type
  - Errors: 400 (invalid name), 404, 502, 503

## Project Structure

```
apps/chat-api/src/
├── app/                    # Application module and core service
│   ├── app.module.ts      # Root module with global configuration
│   ├── app.controller.ts  # Base controller
│   └── app.service.ts     # AI DIAL SDK initialization
├── common/                 # Shared utilities and interceptors
│   └── interceptors/
│       └── metrics.interceptor.ts  # Request metrics logging
├── config/                 # Configuration and validation
│   ├── environment.config.ts  # Environment variables schema
│   └── validation.ts      # Validation function
├── health/                 # Health check endpoint
│   └── health.controller.ts
├── themes/                 # Theme management
│   ├── dto/               # Data transfer objects
│   │   └── get-theme-icon.dto.ts
│   ├── theme.controller.ts
│   ├── theme.service.ts
│   ├── theme.controller.spec.ts  # Integration tests
│   └── theme.service.spec.ts     # Unit tests
└── main.ts                 # Application bootstrap
```

## Error Handling

The API returns appropriate HTTP status codes:

| Status | Description                                  |
| ------ | -------------------------------------------- |
| `200`  | Success                                      |
| `400`  | Bad Request (validation error)               |
| `404`  | Resource Not Found                           |
| `502`  | Bad Gateway (external service error)         |
| `503`  | Service Unavailable (timeout or unreachable) |

All errors include descriptive messages to help with debugging.

## Security & Performance Features

### Security

- **Environment Variable Validation**: Required variables are validated at startup using class-validator
- **Input Validation**: All endpoints use DTOs with validation decorators
- **Path Traversal Protection**: Icon names are validated with regex to prevent directory traversal
- **Security Headers**: Helmet middleware with CSP, HSTS, and other security headers
- **CORS Configuration**: Restricted to configured origin with credentials support
- **Rate Limiting**: Throttling to prevent abuse (100 req/min default, customizable per endpoint)

### Performance

- **Caching**: In-memory caching for theme configuration and icons (5-minute TTL)
- **Cache-Control Headers**: HTTP caching directives for browser/CDN caching
- **Request Timeouts**: Configurable timeouts for external service calls with AbortController
- **Metrics Logging**: Request duration and status tracking for monitoring

## Testing

```bash
# Run all tests
npm test

# Run tests for chat-api only
npx nx test chat-api

# Run tests with coverage
npx nx test chat-api --coverage
```

## CORS Configuration

The API is configured to accept requests from the React application. The allowed origin is configured via the `CORS_ORIGIN` environment variable.

Default CORS settings:

- Origin: `http://localhost:4207` (React app)
- Credentials: `true`

## Static File Serving

The API also serves the built React application. Static files are served from:

```
apps/chat/dist
```

All routes except those prefixed with `/api/*` serve the React application's `index.html`. This enables SPA routing for frontend routes such as `/catalog` and `/conversations/:id` while API endpoints continue to be handled by NestJS.

## Logging

The application uses NestJS Logger with contextual logging:

- **Debug**: Development logging (fetch operations, flow tracking)
- **Log**: General information
- **Warn**: Non-critical issues (external service errors)
- **Error**: Critical errors with stack traces

## Troubleshooting

### Application won't start

- **Check environment variables**: Ensure all required variables are set
- **Validation errors**: The application validates environment variables at startup and will fail with clear error messages if configuration is invalid

### Theme endpoints returning errors

- **404 Not Found**: Theme configuration or icon doesn't exist on the external service
- **503 Service Unavailable**: Theme service is down or request timed out
- **502 Bad Gateway**: Theme service returned an error response

Check the logs for detailed error messages including the external service URL and response status.

### Timeout errors

Adjust the `THEMES_SERVICE_TIMEOUT_MS` environment variable if the external theme service is slow to respond.

## Related Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [AI DIAL SDK](https://github.com/epam/ai-dial-sdk)
- [Swagger/OpenAPI](https://swagger.io/specification/)
