## MODIFIED Requirements

---

### Requirement: Frontend respects backend throttle via rate-limited dispatch

The frontend SHALL NOT fire unbounded parallel upload requests. The backend `POST /api/v1/files` endpoint is rate-limited to 100 requests per 60 seconds (`@Throttle({ default: { limit: 100, ttl: 60000 } })`). To stay within this limit, the `Input` component dispatches uploads through `runAtRate` at `MAX_UPLOADS_PER_MINUTE = 100`, firing one upload every 600 ms. This ensures at most 100 upload starts occur within any 60-second window, matching the backend throttle exactly.

A 429 response from the backend SHALL be surfaced as `RequestStatus.Error` on the affected attachment card, consistent with other upload failures.

#### Scenario: No 429 when uploading many files

- **WHEN** a user attaches any number of files simultaneously
- **THEN** the rate-limited dispatcher keeps starts within 100 per minute and no 429 errors occur under normal backend load

#### Scenario: 429 from backend sets attachment to error state

- **WHEN** the backend returns `429 Too Many Requests` for an upload request
- **THEN** the corresponding `AttachmentCard` transitions to `RequestStatus.Error` and the user can retry
