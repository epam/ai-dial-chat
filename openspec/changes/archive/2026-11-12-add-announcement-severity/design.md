## Context

`ANNOUNCEMENTS` is a JSON array admitted fail-open by `apps/chat-api/src/app-config/env-admission/announcements.admission.ts`, resolved under the `announcement.items` registry key, and normalized per entry by `normalizeAnnouncements` in `apps/chat-api/src/app-config/announcements.normalizer.ts`, which `client-config.mapper.ts` calls with a `warn` callback. The result is `AnnouncementItemDto[]` on `GET /api/v1/client-config` → `config.announcements`.

On the frontend, `apps/chat/src/context/AppConfigContext.tsx` currently assigns `response.config.announcements` directly to `AnnouncementListItem[]` (structurally identical today). `AnnouncementListItem` lives in `libs/chat-hooks/src/conversation/announcement-message.ts` together with `buildAnnouncementSignature`, which `useAnnouncementDismissal` persists to `localStorage`.

Consumers: Chat (popover, ignores severity) and Launchpad (wants a warning icon). Both read `config.announcements` via the generated client.

## Goals / Non-Goals

**Goals:**

- A server-normalized, always-present `severity` (`info` | `warning`) on every returned announcement entry.
- Typo-tolerant: an unknown value never hides an entry; it is logged once and becomes `info`.
- A typed contract in the generated client and a string enum in `@epam/ai-dial-chat-hooks`.
- Zero change for existing deployments, including stored dismissal signatures.

**Non-Goals:**

- Rendering severity in Chat; an `error` level; severity for the single-banner env vars (see proposal).

## Decisions

### D1 — Normalize in `normalizeAnnouncements`, keep the entry on an unknown value

Add a `parseAnnouncementSeverity(raw): AnnouncementSeverity | { reason }` helper next to `parseAnnouncementLink`, returning the same "value or rejection" shape. The loop calls it **after** the title and link checks pass, so a dropped entry is never evaluated (no double warning). On a rejection it calls `warn(\`Announcement "${title}": unknown severity ${JSON.stringify(raw)}; using "info"\`)` once and pushes the entry with `info`.

Matching: `typeof raw === 'string'` → `raw.trim().toLowerCase()` checked against `Object.values(AnnouncementSeverity)`. `undefined`/`null` → `info` silently. Anything else → rejection.

- *Why case/whitespace-insensitive*: operators hand-write this in Helm values; `"Warning"` is clearly intent, not a typo. The output is always canonical lower case, so clients compare exact values.
- *Alternative — drop like an invalid link*: rejected; the issue's acceptance criteria require keeping it.
- *Alternative — validate in env admission*: rejected; admission only parses the JSON root, and entry rules already live in the normalizer (its JSDoc says so). Keeping them together keeps the warning under `AppConfigService`'s `Logger` context.

"Logged once per entry" means once per normalization pass. The normalizer runs when the client-config response is built; per-application response caching is unchanged, so in practice the warning appears once per cache fill, as every other entry warning does today.

### D2 — Backend enum + DTO

New `apps/chat-api/src/app-config/dto/announcement-severity.enum.ts`:

```ts
export enum AnnouncementSeverity {
  Info = 'info',
  Warning = 'warning',
}
```

`AnnouncementItemDto.severity!: AnnouncementSeverity` with `@ApiProperty({ enum: AnnouncementSeverity, enumName: 'AnnouncementSeverity', example: AnnouncementSeverity.Warning, description: … })` — the `ProjectSource` pattern in `apps/chat-api/src/projects/dto/project.dto.ts`. Required (not `@ApiPropertyOptional`) because the server always fills it. No `class-validator` decorators are needed: this is a response DTO built in code, matching the existing fields of this class. Follow `.claude/rules/nestjs-best-practices.md` for the rest; the endpoint, its auth (public, as today) and its controller are untouched.

The generated client then emits `export const AnnouncementSeverity = { Info: 'info', Warning: 'warning' } as const` plus the union type, as it does for `ProjectSource`. Regenerate with `npm run openapi`; never hand-edit `libs/chat-api-client`.

### D3 — Lib enum + pure mapper in `@epam/ai-dial-chat-hooks`

In `libs/chat-hooks/src/conversation/announcement-message.ts`:

```ts
export enum AnnouncementSeverity {
  Info = 'info',
  Warning = 'warning',
}

export interface AnnouncementListItem {
  // …existing fields
  /** How urgent the entry is. Absent means `AnnouncementSeverity.Info`. */
  severity?: AnnouncementSeverity;
}

export const mapAnnouncementSeverity = (
  severity: AnnouncementSeverityDto | null | undefined,
): AnnouncementSeverity =>
  (severity && ANNOUNCEMENT_SEVERITIES[severity]) || AnnouncementSeverity.Info;
```

`ANNOUNCEMENT_SEVERITIES: Record<AnnouncementSeverityDto, AnnouncementSeverity>` mirrors `PROJECT_SOURCES` in `libs/chat-hooks/src/project/project-mapping.ts`; the exhaustive `Record` makes a future backend `error` member a compile error here until the lib enum gains it. The `?? Info` fallback covers an older backend (field absent at runtime) and an unexpected string.

- *Why optional on the lib type*: other hosts and tests construct `AnnouncementListItem` by hand; a required field would be a breaking change to a published type for no rendering benefit.
- *Why a lib enum rather than re-exporting the generated const*: the project rule is string enums over literal unions, and feature-facing lib types never expose generated-client types (`AnnouncementListItem` is already a hand-authored mirror).
- *Isolation*: the lib imports only the generated `AnnouncementSeverity` const (aliased `AnnouncementSeverityDto`, used for the `Record` keys exactly as `ProjectSourceDto` is) — allowed by the `libs/chat-hooks` exception. It knows nothing about the env var, endpoint, client instance or app context. `@epam/ai-dial-chat-api-client` is already a `chat-hooks` dependency (`libs/chat-hooks/package.json`), and `announcement-message.ts` is in the root `.` entry, which already pulls that client in through `project-mapping`, so no entry point's peer set changes.

### D4 — App adapter in `AppConfigContext`

Replace the direct assignment with a map inside the existing response-to-state step:

```ts
announcements: Array.isArray(response.config?.announcements)
  ? response.config.announcements.map((item) => ({
      ...item,
      severity: mapAnnouncementSeverity(item.severity),
    }))
  : [],
```

This runs once per config load, inside the same state update, so the array reference stays stable across renders as the spec requires; no extra `useMemo` is needed. The context still does not re-validate, re-sanitize or re-order entries.

### D5 — Signature excludes severity

`buildItemsSignature` keeps its explicit `title` / `description` / `link` projection; no code change, only a JSDoc line and a test pinning it. Including severity would change every stored signature on deploy (each entry would gain `severity: 'info'`) and re-show dismissed banners for a field Chat does not render. If Chat ever renders severity, it can be added then with an "omit when `info`" rule to keep old signatures valid.

### Cross-cutting checks

- **i18n**: no new user-visible strings.
- **RTL / a11y**: no new UI; none.
- **Feature gating**: not gated behind `ENABLED_FEATURES` — it is additive data on an existing ungated field.
- **Caching**: no new cache; the existing per-application client-config cache key and invalidation are unchanged.
- **Observability**: only the new per-entry `warn` log line; no metrics.
- **Authorization**: unchanged — `GET /api/v1/client-config` keeps its current access rules.

## Risks / Trade-offs

- [Launchpad or another client compares `severity` without handling future values] → Document in `apps/chat-api/README.md` that clients must treat unknown values as `info`; the lib mapper already does.
- [Operator escalates an entry to `warning` but users who dismissed the banner do not see it again] → Accepted (D5); documented next to `ANNOUNCEMENTS`. Editing the title or description still re-shows it.
- [Case-insensitive matching hides an operator mistake like `"WARNING"`] → It is accepted silently by design; output is canonical, so nothing downstream sees the variant.
- [Generated client drift] → `npm run openapi:check` in the task list and the PR gate.

## Migration Plan

Deploy the backend first or together with the frontend; order does not matter because the frontend mapper defaults to `info` when the field is missing and an older frontend ignores it. No env changes are required. Rollback: revert the commit and regenerate the client; no storage or data migration either way.

## Open Questions

None blocking. Whether Launchpad also wants `error` is left to a follow-up issue; the enum shape reserves it.
