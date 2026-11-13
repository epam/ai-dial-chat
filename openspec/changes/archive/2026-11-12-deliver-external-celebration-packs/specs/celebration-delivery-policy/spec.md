## ADDED Requirements

### Requirement: Delivery policy is app configuration

The delivery policy SHALL be four central registry entries in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, each backed by an optional env var validated on `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`:

| Registry key | Env var | Value | Default |
| --- | --- | --- | --- |
| `ui.celebrationDelivery.mode` | `UI_EVENT_DELIVERY_MODE` | `bundled` or `prefer-external` | `bundled` |
| `ui.celebrationDelivery.revision` | `UI_EVENT_DELIVERY_REVISION` | 1–64 characters of `[A-Za-z0-9._-]` | `0` |
| `ui.celebrationDelivery.externalScenes` | `UI_EVENT_EXTERNAL_SCENES` | comma-separated `eventId/sceneId` pairs, each part kebab-case | empty |
| `ui.celebrationDelivery.externalEvents` | `UI_EVENT_EXTERNAL_EVENTS` | comma-separated kebab-case event IDs | empty |

An invalid value SHALL fail boot. Each list SHALL hold at most 64 entries, after trimming and de-duplication.

The policy SHALL NOT be gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, and it SHALL NOT be a theme field.

#### Scenario: Default deployment
- **WHEN** none of the four variables is set
- **THEN** the client receives `mode: bundled`, `revision: "0"` and empty lists, and every scene stays bundled

#### Scenario: Invalid pair
- **WHEN** `UI_EVENT_EXTERNAL_SCENES=new-year/Snowman`
- **THEN** `apps/chat-api` fails validation at boot

### Requirement: Policy in the client config

`ClientConfigResponseDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL gain a required `celebrationDelivery` field typed by a class `CelebrationDeliveryDto`, which uses a string enum `CelebrationDeliveryMode`. `client-config.mapper.ts` SHALL map it from the registry keys:

```json
{
  "activeEventId": "new-year",
  "celebrationDelivery": {
    "mode": "prefer-external",
    "revision": "2026-11-15.1",
    "externalScenes": [{ "eventId": "new-year", "sceneId": "snowman-delivery" }],
    "externalEvents": ["company-anniversary"]
  }
}
```

The generated client SHALL be regenerated, and `apps/chat` SHALL read the field through `useAppConfig()` (`apps/chat/src/context/AppConfigContext.tsx`). No new context is added.

#### Scenario: Allowlisted scene reaches the client
- **WHEN** `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=new-year/snowman-delivery`
- **THEN** `GET /api/v1/client-config?appId=chat-ui` includes `celebrationDelivery.externalScenes` with that pair

### Requirement: Documented variables

`apps/chat-api/README.md` and `apps/chat-api/.env.template` SHALL document the four variables, their defaults, and how to roll back with them.

#### Scenario: Docs check
- **WHEN** `npm run validate:docs` runs after the change
- **THEN** it passes, and the README lists `UI_EVENT_DELIVERY_MODE`, `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES` and `UI_EVENT_EXTERNAL_EVENTS`
