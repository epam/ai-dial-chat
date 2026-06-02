# Tasks: add-chat-api-spec

## Spec-driven improvements to chat-api application

These tasks resolve the gaps identified in `design.md` and bring the implementation and tests into alignment with the specification.

---

### High Priority: Security & Validation

- [x] Add environment variable validation schema using class-validator
  - Create `EnvironmentVariables` class with validation decorators
  - Configure `ConfigModule.forRoot()` with `validationSchema`
  - Validate `DIAL_CORE_URL`, `DIAL_API_KEY`, `THEMES_CONFIG_URL` at startup
  - Remove `as string` type casts after validation is in place

- [x] Add input validation for theme icon endpoint
  - Create `GetThemeIconDto` with validation for `iconName` parameter
  - Restrict icon name to safe characters (alphanumeric, dash, underscore)
  - Apply `ValidationPipe` globally in `main.ts`
  - Add test cases for path traversal attempts

### High Priority: Error Handling

- [x] Improve error handling in `ThemeService`
  - Replace `catch(() => null)` with proper error handling
  - Throw `NotFoundException` when theme configuration is not found
  - Throw `ServiceUnavailableException` when external service is down
  - Throw `BadGatewayException` for invalid responses
  - Add timeout configuration for fetch calls

- [x] Update `ThemeController` error responses
  - Remove manual `@ApiResponse 404` (will be auto-generated from exceptions)
  - Ensure null responses are properly handled or replaced with exceptions
  - Add `@ApiResponse` for 503 and 502 status codes

### High Priority: Testing

- [x] Add unit tests for `ThemeService`
  - Test `getThemes()` success case with valid JSON
  - Test `getThemes()` with fetch failure
  - Test `getThemes()` with invalid JSON response
  - Test `getThemeIcon()` success case
  - Test `getThemeIcon()` with missing `THEMES_CONFIG_URL`
  - Test `getThemeIcon()` with 404 response from external service
  - Mock global `fetch` using Jest mocks

- [x] Add integration tests for theme endpoints
  - Test `GET /api/themes` returns configuration
  - Test `GET /api/themes/icon?iconName=valid` returns SVG
  - Test `GET /api/themes/icon?iconName=../etc/passwd` returns 400
  - Test CORS headers are present
  - Test API prefix is applied correctly
  - Use `@nestjs/testing` and `supertest`

- [x] Add tests for static file serving
  - Test root path serves frontend index.html
  - Test `/api/*` paths do not serve static files
  - Test frontend SPA routing (unmatched routes serve index.html)
  - Note: These are covered by e2e tests when frontend is built

### Medium Priority: Code Quality

- [x] Replace console.log with NestJS Logger in `ThemeService`
  - Inject `Logger` via constructor
  - Replace `console.log` calls with `this.logger.debug()` or `this.logger.log()`
  - Add contextual information to log messages
  - Configure log levels for production

- [x] Clean up unused code in `AppService`
  - Remove `getData()` method if not needed for future use
  - Or add controller endpoint if user info should be exposed
  - Document the intended use of `AppService.client` for future extensions

- [x] Remove or implement bearer authentication in Swagger
  - Remove `.addBearerAuth()` from Swagger config if auth is not planned
  - Or add authentication guards to endpoints if auth is needed
  - Document authentication requirements in design.md

### Medium Priority: Configuration

- [x] Add health check endpoint
  - Create `HealthController` with `GET /api/health` endpoint
  - Return basic status and version information
  - Optionally check connectivity to external services
  - Add Swagger annotations

- [x] Add timeout configuration for external service calls
  - Add `THEMES_SERVICE_TIMEOUT_MS` environment variable (default: 5000)
  - Configure fetch with AbortController for timeouts
  - Handle timeout errors appropriately
  - Already implemented in error handling task

### Low Priority: Enhancements

The following enhancements are optional and should be implemented based on production requirements:

- [x] Add caching for theme configuration
  - Use `@nestjs/cache-manager` for in-memory caching
  - Cache theme configuration for configurable duration
  - Add cache-control headers to responses
  - Add cache invalidation endpoint (optional)
  - **Note**: Implement when theme service load becomes a concern

- [x] Add security headers middleware
  - Install `helmet` package
  - Configure helmet middleware in `main.ts`
  - Configure CSP, HSTS, and other security headers
  - Test security headers in integration tests
  - **Note**: Recommended for production deployment

- [x] Add rate limiting for theme endpoints
  - Install `@nestjs/throttler`
  - Configure throttler module with reasonable limits
  - Add `@Throttle()` decorators to public endpoints
  - Test rate limiting behavior
  - **Note**: Implement based on expected traffic and abuse patterns

- [x] Add metrics/monitoring integration
  - Consider integrating Prometheus metrics
  - Add endpoint duration tracking
  - Add external service call tracking
  - Add error rate tracking
  - **Note**: Implement based on monitoring infrastructure requirements

### Documentation

- [x] Add JSDoc comments to all public methods
  - Document parameters, return types, and thrown exceptions
  - Add usage examples for complex methods
  - Document environment variable requirements in service constructors

- [x] Add README.md for chat-api application
  - Document setup and installation
  - List all environment variables with examples
  - Add development and production run instructions
  - Link to Swagger documentation

- [x] Update Swagger documentation
  - Add more detailed operation descriptions
  - Add request/response examples
  - Document all possible response codes
  - Add authentication documentation when implemented
