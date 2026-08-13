# dial-resource-path-encoding Specification

## Purpose

One DIAL resource-path encoder shared by every chat-api domain.

## ADDED Requirements

### Requirement: Single DIAL resource-path encoder for all chat-api domains
The system SHALL expose one function, `encodeDialResourcePath(path: string): string` in `apps/chat-api/src/common/utils/encode-dial-path.ts`, used by conversations, files, and toolsets to build DIAL Core resource URLs, replacing the three previously separate per-domain encoders and the inline duplicate in `conversation.service.ts`.

#### Scenario: Path is encoded segment-by-segment
- **WHEN** `encodeDialResourcePath` is called with a `/`-delimited path containing one or more segments
- **THEN** it safely decodes each segment, re-encodes it with `encodeURIComponent`, and rejoins the segments with `/`

#### Scenario: Equivalent output to the pre-consolidation encoders
- **WHEN** `encodeDialResourcePath` is called with any path previously handled by `encodeDialResourcePath` (conversations), `encodeDialFileResourcePath` (files), or `encodeDialToolsetPath` (toolsets)
- **THEN** it returns byte-for-byte the same encoded string those functions previously returned, for empty paths, single segments, nested paths, already-encoded segments, and unicode segments

#### Scenario: Conversation service uses the shared encoder
- **WHEN** `conversation.service.ts` builds a DIAL resource URL
- **THEN** it calls the shared `encodeDialResourcePath` helper instead of encoding the path inline
