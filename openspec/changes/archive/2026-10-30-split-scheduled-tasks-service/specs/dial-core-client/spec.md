## MODIFIED Requirements

### Requirement: Raw DIAL Core escape hatches use the shared transport
Any `chat-api` integration that calls a DIAL Core URL without an SDK operation MUST use the fetch-compatible transport exposed by `DialClientService` (`dialClient.fetchCore`) rather than `globalThis.fetch`, so the common User-Agent and future Core-only transport behavior remain consistent. Non-Core upstreams MUST continue using their own transport and MUST NOT receive the DIAL Chat-to-Core User-Agent automatically.

#### Scenario: Rating request uses the shared transport
- **WHEN** `RateService` proxies a rating to DIAL Core
- **THEN** it uses the `DialClientService` transport and includes both the operation's existing headers and the canonical User-Agent

#### Scenario: Scheduler request uses the shared transport
- **WHEN** `SchedulerUpstreamClient` calls the DIAL Core Scheduler route not exposed by the SDK
- **THEN** it uses the `DialClientService` transport and includes both the operation's existing headers and the canonical User-Agent

#### Scenario: Streaming file upload uses the shared transport
- **WHEN** `FilesUploadService` uploads file content to a DIAL Core route not exposed by the SDK
- **THEN** it uses the `DialClientService` transport and includes both the operation's existing headers and the canonical User-Agent

#### Scenario: Non-Core upstream remains unaffected
- **WHEN** `ThemeService` fetches theme configuration or an icon from the configured theme service
- **THEN** it does not use the DIAL Core transport and does not receive `User-Agent: ai-dial-chat/<normalized-version>` from this capability
