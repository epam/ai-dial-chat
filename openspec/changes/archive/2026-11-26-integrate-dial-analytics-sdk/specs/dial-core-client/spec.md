## MODIFIED Requirements

### Requirement: Raw DIAL Core escape hatches use the shared transport
Any `chat-api` integration that calls a DIAL Core URL without an SDK operation MUST use the fetch-compatible transport exposed by `DialClientService` (`dialClient.fetchCore`) rather than `globalThis.fetch`, so the common User-Agent and future Core-only transport behavior remain consistent. Non-Core upstreams MUST continue using their own transport and MUST NOT receive the DIAL Chat-to-Core User-Agent automatically. DIAL Analytics (ADAS) is the one non-Core upstream that deliberately sends the same `ai-dial-chat/<normalized-version>` value, built by the same normalization, through its own transport; it SHALL NOT use the Core transport or Core request timing.

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

#### Scenario: DIAL Analytics carries the product identity through its own transport
- **GIVEN** `CHAT_VERSION` is `2026.08.25-a1b2c3d` and `ANALYTICS_URL` is set
- **WHEN** chat-api sends any request to DIAL Analytics
- **THEN** the request carries exactly one `User-Agent: ai-dial-chat/2026.08.25-a1b2c3d`, the same value DIAL Core requests carry, and it is not sent through `DialClientService.fetchCore` and is not counted as a DIAL Core call by request timing
