# celebration-delivery-policy Specification

## Purpose

The app-owned policy that decides whether DIAL Chat plays only bundled celebration scenes or takes allowlisted scenes and events from published packs: the `UI_EVENT_DELIVERY_*` and `UI_EVENT_EXTERNAL_*` environment variables, their validation, and how the policy reaches the client config. Implemented in S2 (#9221).

## Requirements

### Requirement: Delivery policy is app configuration

The delivery policy SHALL be four central registry entries in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, each backed by an optional env var validated on `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`:

| Registry key | Env var | Value | Default |
| --- | --- | --- | --- |
| `ui.celebrationDelivery.mode` | `UI_EVENT_DELIVERY_MODE` | `bundled` or `prefer-external` | `bundled` |
| `ui.celebrationDelivery.revision` | `UI_EVENT_DELIVERY_REVISION` | 1–64 characters of `[A-Za-z0-9._-]` | `0` |
| `ui.celebrationDelivery.externalScenes` | `UI_EVENT_EXTERNAL_SCENES` | comma-separated `eventId/sceneId` pairs, each part kebab-case | empty |
| `ui.celebrationDelivery.externalEvents` | `UI_EVENT_EXTERNAL_EVENTS` | comma-separated kebab-case event IDs | empty |

An invalid value SHALL fail boot. Each list SHALL hold at most 64 entries, after trimming and de-duplication.

From managed schema 1.1.0 the four keys SHALL also be managed config keys. In `active` mode with the four keys listed in `MANAGED_CONFIG_ACTIVE_KEYS`, each SHALL resolve as explicit ENV → published value → default, and the four parts SHALL still form one `celebrationDelivery` object. The ID patterns and limits SHALL have one definition, shared by environment validation and the managed value schemas.

The policy SHALL NOT be gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, and it SHALL NOT be a theme field.

#### Scenario: Default deployment
- **WHEN** none of the four variables is set and nothing is published
- **THEN** the client receives `mode: bundled`, `revision: "0"` and empty lists, and every scene stays bundled

#### Scenario: Invalid pair
- **WHEN** `UI_EVENT_EXTERNAL_SCENES=new-year/Snowman`
- **THEN** `apps/chat-api` fails validation at boot

#### Scenario: Published policy
- **WHEN** the four keys are active, none of their variables is set, and the fresh snapshot sets `prefer-external` with `externalScenes` `["new-year/snowman-delivery"]`
- **THEN** `GET /api/v1/client-config?appId=ai-dial-chat` includes `celebrationDelivery.mode` `prefer-external` and that pair

#### Scenario: Environment value overrides one published part
- **WHEN** the four keys are active, `UI_EVENT_EXTERNAL_EVENTS=company-anniversary` is set, and the snapshot sets `externalEvents` `["product-launch"]`
- **THEN** `celebrationDelivery.externalEvents` is `["company-anniversary"]`, and shadow mode reports `env_shadowed` for `ui.celebrationDelivery.externalEvents`

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

### Requirement: Documented variables

`apps/chat-api/README.md` and `apps/chat-api/.env.template` SHALL document the four variables, their defaults, and how to roll back with them. They SHALL also state that each variable is a fallback once its key is managed and active: an explicit value wins over the published one, so it SHALL be removed to let the published policy apply, and `UI_EVENT_DELIVERY_MODE=bundled` set explicitly keeps every scene bundled whatever is published.

#### Scenario: Docs check
- **WHEN** `npm run validate:docs` runs after the change
- **THEN** it passes, and the README lists `UI_EVENT_DELIVERY_MODE`, `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES` and `UI_EVENT_EXTERNAL_EVENTS`

#### Scenario: Fallback note
- **WHEN** the README rows of the four variables, `UI_EVENT`, `UI_EVENT_ENABLED_BY_DEFAULT`, `ANNOUNCEMENT_TITLE`, `ANNOUNCEMENT_DESCRIPTION` and `ANNOUNCEMENTS` are read
- **THEN** each names its managed key and says that an explicit value wins over the published one

### Requirement: Pack source stays deployment-owned

Whatever source supplies the delivery policy, packs SHALL come only from `<THEMES_CONFIG_URL>/celebrations/` through `/api/v1/celebrations`, and `THEMES_CONFIG_URL` SHALL stay a deployment variable that Config Studio cannot set. A published policy SHALL only select among packs that host serves and the BFF admits; it SHALL NOT add a host, a path, or an import.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Published external policy without a themes host

- **WHEN** a published policy sets `prefer-external` with an allowlisted scene and `THEMES_CONFIG_URL` is unset
- **THEN** `/api/v1/celebrations` answers 503, the browser keeps the compiled event, and no other host is contacted

#### Scenario: Published policy cannot name a source

- **WHEN** an editor tries to publish a delivery value that contains a URL, such as an `externalEvents` entry `https://evil.example.com/pack`
- **THEN** Config Studio rejects it with a `pattern` error, because every entry is a kebab-case ID

### Requirement: Unknown or unadmitted events show nothing

The frontend SHALL ignore an `activeEventId` that is neither a compiled event nor listed in `externalEvents`. It SHALL request no pack, render no scene, and log no error, whichever source supplied the ID.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Unknown event ID

- **WHEN** the client config carries `activeEventId` `easter`, `easter` is not compiled, and `externalEvents` is empty
- **THEN** `CelebrationHost` requests no celebration resource and no scene is shown

#### Scenario: External event not admitted

- **WHEN** `activeEventId` is `company-anniversary`, the mode is `prefer-external`, and `externalEvents` does not list it
- **THEN** no pack is requested and no scene is shown

### Requirement: A changed event or policy applies in the open browser

When a background client-config refresh delivers a different `activeEventId` or `celebrationDelivery`, the open page SHALL use the new values without a reload: it SHALL cancel a playing scene and activate the new event under the new policy. A refresh that changes neither SHALL NOT restart a scene.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Season switch at runtime

- **WHEN** the start page shows the `halloween` event and a background refresh returns `activeEventId` `new-year`
- **THEN** `CelebrationProvider` receives `new-year` and a different `resetKey`, so the next activation plays the New Year event

#### Scenario: Unrelated refresh keeps the scene

- **WHEN** a background refresh returns a new announcement but the same `activeEventId` and `celebrationDelivery`
- **THEN** the `resetKey` passed to `CelebrationProvider` is unchanged
