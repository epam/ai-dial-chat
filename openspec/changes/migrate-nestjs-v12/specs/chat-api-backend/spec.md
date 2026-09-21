## ADDED Requirements

### Requirement: Supported NestJS framework version

The application SHALL run on a NestJS major version that is on the `latest` (non-`legacy`)
dist-tag for `@nestjs/core` at the time of release. `apps/chat-api`'s and
`apps/mcp-app-sandbox`'s `@nestjs/common`, `@nestjs/core`, and `@nestjs/platform-express`
dependency ranges SHALL resolve to the same NestJS major version as each other within an
application.

#### Scenario: Framework and platform-adapter majors match

- **WHEN** `apps/chat-api/package.json` is inspected
- **THEN** `@nestjs/common`, `@nestjs/core`, and `@nestjs/platform-express` all resolve to the
  same major version (`^12.0.0` or higher)

#### Scenario: Companion packages resolve to a compatible major

- **WHEN** `apps/chat-api/package.json` is inspected
- **THEN** `@nestjs/config`, `@nestjs/swagger`, `@nestjs/cache-manager`, and
  `@nestjs/serve-static` each resolve to a version documented as compatible with the installed
  `@nestjs/core` major in that package's own release notes
