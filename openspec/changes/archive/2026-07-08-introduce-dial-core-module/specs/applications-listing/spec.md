## MODIFIED Requirements

### Requirement: Applications domain structure
The backend SHALL implement the applications feature in `apps/chat-api/src/applications/` following the established domain pattern:

- `applications.controller.ts` — thin controller with `@Get() listApplications(@Req() req)`
- `applications.service.ts` — `ApplicationsService` injects `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) for the shared DIAL SDK client and `baseUrl`; raw fetch with `AbortController`; pagination loop; cache management
- `applications.module.ts` — `ApplicationsModule` that imports `CacheModule`
- `dto/application.dto.ts` — `ApplicationDto` and `ApplicationsResponseDto` with `@ApiProperty` decorators
- `tests/applications.controller.spec.ts`
- `tests/applications.service.spec.ts`

`ApplicationsModule` SHALL be imported into `AppModule`.

#### Scenario: Controller delegates to service
- **WHEN** `listApplications` is called on the controller
- **THEN** the controller extracts `sub` and `at` from `req.user` and calls `applicationsService.listApplications(sub, at)`
