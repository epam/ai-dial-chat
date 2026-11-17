## MODIFIED Requirements

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
- **THEN** `GET /api/v1/client-config?appId=ai-dial-chat` includes `celebrationDelivery.externalScenes` with that pair
