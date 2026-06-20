## MODIFIED Requirements

---

### Requirement: Rate-limited upload dispatching

When `addAttachments` is called with multiple files, the `Input` component SHALL dispatch uploads at a steady rate of `MAX_UPLOADS_PER_MINUTE` (100) starts per minute rather than firing all requests simultaneously. Uploads run concurrently — the rate limit controls when each upload **starts**, not how many are in flight at once.

The dispatcher fires one upload every `60000 / MAX_UPLOADS_PER_MINUTE` ms (600 ms). All started uploads run in parallel; the next dispatch slot opens after each interval regardless of whether prior uploads have completed.

The rate limiter is implemented via `runAtRate` from `libs/conversation-input/src/utils/concurrency.ts`. The constant `MAX_UPLOADS_PER_MINUTE` is defined in `libs/conversation-input/src/constants/upload.ts`.

Attachments that fail `validateAttachment` are marked `RequestStatus.Error` synchronously before the dispatcher starts.

#### Scenario: Uploads are dispatched at a steady rate

- **WHEN** more than 100 files are added at once
- **THEN** uploads start one every 600 ms; at most 100 upload requests are started within any 60-second window

#### Scenario: Small batches are unaffected

- **WHEN** 100 or fewer files are added at once
- **THEN** all uploads start within 60 seconds with 600 ms spacing between each dispatch

#### Scenario: Uploads run concurrently

- **WHEN** multiple uploads are in flight
- **THEN** each upload proceeds independently without waiting for others to complete

#### Scenario: Invalid attachments are marked immediately

- **WHEN** a batch contains files that fail `validateAttachment` alongside valid files
- **THEN** invalid ones are immediately set to `RequestStatus.Error` and valid ones enter the rate-limited dispatch queue

#### Scenario: All uploads complete after the last dispatch

- **WHEN** the dispatcher has started all items
- **THEN** the process waits for all in-flight uploads to settle before resolving
