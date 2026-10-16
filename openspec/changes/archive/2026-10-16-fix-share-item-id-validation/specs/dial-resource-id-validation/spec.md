# Spec Delta

## Purpose

Defines which DIAL Core resource ids (`{type}/{bucket}/{path}`) the chat-api accepts as an `itemId` on the share endpoints, so that every id DIAL Core itself produces is accepted while path traversal and injection payloads are rejected before any DIAL Core call.

## ADDED Requirements

### Requirement: `itemId` of the share endpoints is validated as a DIAL Core resource id

`CreateShareLinkDto`, `DiscardSharedCatalogItemDto`, `RevokeSharedAccessDto` and `GetShareRecipientsDto` (all under `apps/chat-api/src/share/dto/`) SHALL validate `itemId` with a resource-id validator that follows DIAL Core's own path rules, not the file-path rules of the files API. Validation SHALL run in the request `ValidationPipe`, before any DIAL Core call, and a rejected `itemId` SHALL produce `400 Bad Request`.

An `itemId` SHALL be rejected when it:
- starts with `/`, or contains an empty path segment;
- contains a `.` or `..` path segment, whether written literally or percent-encoded (including `%2e%2e` and an encoded slash such as `..%2F`);
- contains a literal `?` or `#` (DIAL Core rejects a query or fragment in a resource path; the encoded `%3F` and `%23` remain valid name characters);
- contains `\`, `{`, `}`, `"` or any control character (U+0000-U+001F), whether written literally or reached by decoding a percent-encoded byte;
- contains a `%` that is not followed by two hexadecimal digits.

An `itemId` SHALL be accepted, subject to the checks above and to the per-endpoint resource-type allowlist and length limit, when it contains any other character — in particular the sub-delimiters DIAL Core's own URL encoder leaves literal (`:`, `;`, `,`, `=`, `&`, `@`, `+`, `$`, `!`, `'`, `(`, `)`, `*`), spaces, non-ASCII characters, valid percent-encoded bytes (including `%2F`), and a `..` that is only part of a segment name (for example `Wait.. what`).

The file-path validator used by the files API is unchanged and is not applied to `itemId` of the share endpoints.

#### Scenario: Conversation with a Bedrock model id is accepted

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "conversations/{bucket}/anthropic.claude-haiku-4-5-20251001-v1:0__hi__{uuid}", "access": ["view"] }`
- **THEN** `itemId` validation passes and the request reaches the share service, instead of failing with `400` "path must not start with /, contain .., or include forbidden characters"

#### Scenario: Other share endpoints accept the same id

- **WHEN** `POST /api/v1/share/discard`, `POST /api/v1/share/revoke` or `GET /api/v1/share/recipients?itemId=...` is called with that same conversation id
- **THEN** `itemId` validation passes on each of them

#### Scenario: Decoded prompt id with spaces and a comma is accepted

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "prompts/{bucket}/My folder/My prompt, v2", "access": ["view"] }`
- **THEN** `itemId` validation passes

#### Scenario: Encoded segment is accepted

- **WHEN** `itemId` is `conversations/{bucket}/applications/catalog/Team%2FApp%20One__0.0.1__hello`
- **THEN** `itemId` validation passes

#### Scenario: Dots inside a name are not traversal

- **WHEN** `itemId` is `conversations/{bucket}/gpt-4o__Wait.. what__x`
- **THEN** `itemId` validation passes

#### Scenario: Traversal segments are rejected

- **WHEN** `itemId` is `applications/{bucket}/../other/app`, `applications/{bucket}/%2e%2e/other`, or `applications/{bucket}/..%2Fother`
- **THEN** the endpoint responds `400 Bad Request` and DIAL Core is not called

#### Scenario: Leading slash and empty segments are rejected

- **WHEN** `itemId` is `/applications/{bucket}/app` or `applications/{bucket}//app`
- **THEN** the endpoint responds `400 Bad Request` and DIAL Core is not called

#### Scenario: Characters DIAL Core rejects in a name are rejected

- **WHEN** `itemId` contains a literal `\`, `{`, `}`, `"`, `?`, `#`, a newline or another control character, or the encoded form `%7B`, `%5C` or `%0A`
- **THEN** the endpoint responds `400 Bad Request` and DIAL Core is not called

#### Scenario: Forbidden characters next to a non-UTF-8 byte are still rejected

- **WHEN** `itemId` is `applications/{bucket}/%FF%7Bx`, `applications/{bucket}/%FF%0Ax` or `applications/{bucket}/..%2F%FF`
- **THEN** the endpoint responds `400 Bad Request`: a percent-encoded byte that is not valid UTF-8 does not prevent the ASCII escapes in the same segment from being checked

#### Scenario: Double-encoded dots are not decoded twice

- **WHEN** `itemId` is `conversations/{bucket}/%252e%252e__x`
- **THEN** `itemId` validation passes, because a segment is decoded once, exactly as DIAL Core decodes it

#### Scenario: Malformed percent-encoding is rejected

- **WHEN** `itemId` is `conversations/{bucket}/chat%zz`
- **THEN** the endpoint responds `400 Bad Request` and DIAL Core is not called

#### Scenario: Resource-type allowlist is unaffected

- **WHEN** `POST /api/v1/share/revoke` is called with an `itemId` whose prefix is not one of `applications/`, `toolsets/`, `conversations/`, `skills/` or `prompts/`
- **THEN** the endpoint responds `400 Bad Request`, exactly as before this capability
