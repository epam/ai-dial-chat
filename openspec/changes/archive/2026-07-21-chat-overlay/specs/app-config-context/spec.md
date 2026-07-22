## ADDED Requirements

### Requirement: AppConfigContext exposes overlay eligibility fields

`AppConfigState.config` SHALL add `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`, populated from the corresponding `client-config-endpoint` response fields, with safe defaults (`overlayEnabled: false`, `overlayAllowedOrigins: []`) in both the initial (`loading`) and `error` states — no change to `AppConfigState.status`'s existing three-value shape or to any other existing field.

**RTL impact:** None. **i18n impact:** None. **Memoization:** Covered by the existing context-value `useMemo` — no additional memoization needed for these two fields.

#### Scenario: Defaults while loading

- **WHEN** `AppConfigProvider` mounts and the API call has not yet resolved
- **THEN** `useAppConfig().config.overlayEnabled` returns `false` and `useAppConfig().config.overlayAllowedOrigins` returns `[]`

#### Scenario: Populated on success

- **WHEN** the API call resolves with `config.overlayEnabled: true` and `config.overlayAllowedOrigins: ["https://partner.example.com"]`
- **THEN** `useAppConfig().config.overlayEnabled` returns `true` and `useAppConfig().config.overlayAllowedOrigins` returns `["https://partner.example.com"]`

#### Scenario: Defaults on error

- **WHEN** the API call rejects
- **THEN** `useAppConfig().config.overlayEnabled` returns `false` and `useAppConfig().config.overlayAllowedOrigins` returns `[]`, alongside the existing error-state defaults for the other config fields
