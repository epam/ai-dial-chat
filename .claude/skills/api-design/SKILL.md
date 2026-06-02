---
name: api-design
description: Design, review, or change HTTP API contracts for AI DIAL Chat. Use when adding or modifying REST endpoints, request/response DTOs, status codes, pagination, filtering, API versioning, auth requirements, rate limits, cache behavior, OpenAPI/Swagger docs, or frontend server-api clients.
---

# API Design

Claude-facing shortcut for the shared API design skill. Keep API/server-api/generated-client
details and all other host/external integration concerns in apps; if behavior is surfaced through
`libs/*`, pass resolved data, resolved values, or callbacks into the lib instead of embedding
endpoint paths, transport details, storage keys, navigation, analytics, SDK setup, or platform
knowledge there. Exception: `libs/chat-api-client` is the generated OpenAPI-client package and
may contain generated endpoint paths, DTOs, runtime transport code, and OpenAPI artifacts when
updated through the repository OpenAPI generation scripts.

@.agents/skills/api-design/SKILL.md
