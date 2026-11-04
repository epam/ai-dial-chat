## Context

The exception in `chat-api-code-conventions` was planned to go once #9703 moved archive upload. #9703 merged with that follow-up already applied: `getArchiveEntryUploadError` replaced the ternary, and `throwIfUploadAborted` replaced `throwIfArchiveUploadAborted`. Only the main spec's wording lags behind the code.

## Goals / Non-Goals

**Goals:**

- Make the requirement describe the code as it is.

**Non-Goals:**

- Any code change.

## Decisions

### D1 — Replace the exception sentence with a no-disable rule and a scenario

A plain "no exceptions" rule keeps the lint guarantee testable by search. The replacement helper is named so a reader can find where the old exception went.

## Risks / Trade-offs

None. The change is spec-only and reverts cleanly.
