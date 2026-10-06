# dial-resource-path-encoding Specification

## Purpose

One DIAL resource-path encoder shared by every chat-api domain.

## Requirements

### Requirement: Single DIAL resource-path encoder for all chat-api domains
The system SHALL expose one shared decode-then-encode function, `encodeDialResourcePath(path: string): string` in `apps/chat-api/src/common/utils/encode-dial-path.ts`, used across chat-api domains (conversations, toolsets, prompts, skills, share, applications, publish, scheduled tasks, external services, deployments and files) to build DIAL Core resource URLs from paths that may already be percent-encoded, replacing the previously separate per-domain encoders and the inline duplicate that used to live in `conversation.service.ts`.

The same module SHALL also export `encodePlainDialResourcePath(path: string): string`, which percent-encodes each segment without decoding it first. It is used where the input is known to be plain text — the files domain (through `encodeDialFilePath` in `apps/chat-api/src/files/dial-resource-path.util.ts`) and `apps/chat-api/src/publish/publish-target.util.ts` — because the pre-decode in `encodeDialResourcePath` would rewrite a plain name that legitimately contains a percent escape (e.g. `test%20folder`) into a different resource.

#### Scenario: Path is encoded segment-by-segment
- **WHEN** `encodeDialResourcePath` is called with a `/`-delimited path containing one or more segments
- **THEN** it safely decodes each segment with `safeDecodeURIComponent`, re-encodes it with `encodeURIComponent`, and rejoins the segments with `/`

#### Scenario: Already-encoded input is idempotent
- **WHEN** `encodeDialResourcePath` is called with a path whose segments are already percent-encoded (e.g. `my%20chat`), or with an empty path, a single segment, a nested path, or unicode segments
- **THEN** it returns the same encoded string as for the equivalent decoded input, without double-encoding (`%20` never becomes `%2520`)

#### Scenario: Plain paths keep literal percent escapes
- **WHEN** `encodePlainDialResourcePath` is called with a plain path whose segment literally contains `%20`
- **THEN** it encodes the `%` itself (yielding `%2520`), so the resource name reaches DIAL Core unchanged

#### Scenario: Conversation services use the shared encoder
- **WHEN** a conversations-domain service (`conversation-lifecycle`, `conversation-listing`, `conversation-persistence`, `conversation-streaming` or `conversation-publish`) builds a DIAL resource URL
- **THEN** it calls the shared `encodeDialResourcePath` helper instead of encoding the path inline
