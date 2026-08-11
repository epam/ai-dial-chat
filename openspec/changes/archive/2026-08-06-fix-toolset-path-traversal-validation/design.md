## Context

`GET /api/v1/toolsets/:toolsetName` (`apps/chat-api/src/toolsets/toolsets.controller.ts`) validates `toolsetName` via `GetToolsetDto` (`apps/chat-api/src/toolsets/dto/get-toolset.dto.ts`), which applies `@Matches(DEPLOYMENT_ID_PATTERN)`. `DEPLOYMENT_ID_PATTERN` (`apps/chat-api/src/common/validators/deployment-id.pattern.ts`) is:

```ts
export const DEPLOYMENT_ID_PATTERN = /^(?:[\w.\-:@/()]|%[\dA-Fa-f]{2})+$/;
```

Its character class includes both `.` and `/`, so `../etc/passwd` matches. Since NestJS/Express percent-decodes route params before the `ValidationPipe` runs, a request to `..%2Fetc%2Fpasswd` is validated as the literal string `../etc/passwd`, passes this regex, and reaches the `@epam/ai-dial-typescript-sdk` `getToolset` call — DIAL Core then 404s the bogus path instead of the BFF rejecting it with 400 pre-upstream. This is [GitHub #7925](https://github.com/epam/ai-dial-chat/issues/7925).

The existing spec (`openspec/specs/toolset-lookup/spec.md`, "Toolset name path parameter validation") already requires the tighter allowlist `[a-zA-Z0-9_\-.:@]` (no `/`) and 400-before-upstream. The models route (`apps/chat-api/src/models/dto/get-model.dto.ts`) already implements exactly this regex and is unaffected by the bug — it is the reference implementation.

The sibling route from the same issue report, `GET /api/v1/deployments/:deployment/limits`, was investigated and found already correct: `GetDeploymentDto` uses `@IsSafeDeploymentId()` (added in PR #8140), which rejects `.`/`..`/empty/control-char path segments post-decode and has a passing integration test (`deployments.controller.integration.spec.ts:270-287`) confirming `400` is returned without an upstream call. No design decision is needed for that route — it's already conformant, out of scope here.

## Goals / Non-Goals

**Goals:**

- Make `toolsetName` validation reject `.`/`..`/empty path segments (traversal) before the DIAL Core call, while still accepting legitimate `/`-containing custom-toolset paths (`toolsets/{bucket}/{path}`).
- Keep valid namespaced/tagged toolset names (`my-toolset`, `folder.toolset-v1`, `@org/toolset:tag`, `toolsets/bucket/folder/toolset-name`) passing.
- Add a regression test proving `..%2Fetc%2Fpasswd` returns `400` and the toolsets service is never invoked.

**Non-Goals:**

- Changing `DEPLOYMENT_ID_PATTERN` itself, or fixing its other consumers (`applications`, `external-services`, `conversations`) that carry the same latent traversal exposure — flagged as a follow-up, not addressed here (explicit scope decision).
- Any change to `GetDeploymentDto` / `IsSafeDeploymentId` — already correct for its own route.
- Adopting `IsSafeDeploymentId` wholesale for toolsets — it is looser than toolsets' current character allowlist and would relax existing injection protections (see Decisions).

## Decisions

**Decision (revised after implementation spike): keep `/` in the allowlist, and add a segment-level check that rejects `.` / `..` / empty path segments, instead of dropping `/` entirely.**

An initial attempt reused the models route's slash-free regex (`/^[a-zA-Z0-9_\-.:@]+$/`). That is wrong for toolsets: `ToolsetsService.parseDialToolsetResource` shows toolset names legitimately use a `toolsets/{bucket}/{path}` structure (`/`-separated), so a slash-free allowlist would 400 every legitimate custom-toolset lookup — a regression, not a fix. Toolsets differ from `models` in this respect, so the models pattern isn't a valid reference here.

- Alternative considered: reuse `IsSafeDeploymentId` as-is (already segment-aware and already used by the deployments-limits route). Rejected — it is deliberately looser than toolsets' current character allowlist (its own example, `applications/bucket/My App`, contains a space), so swapping it in would silently relax toolsets' existing injection protections (e.g. the already-passing `bad;toolset` → 400 test relies on the character class, which `IsSafeDeploymentId` does not enforce).
- Alternative considered: fix `DEPLOYMENT_ID_PATTERN` itself (add segment-level dot-rejection to the shared pattern). Rejected for this change's scope — `DEPLOYMENT_ID_PATTERN` is also used, with the same latent traversal exposure, by `applications/dto/get-application.dto.ts` and `external-services/dto/get-external-service.dto.ts` (path params) and `conversations/dto/create-conversation.dto.ts` (body field). Fixing the shared pattern would close those too, but expands this change beyond the reported issue (#7925 only covers toolsets and deployment-limits) and adds test surface across four DTOs. Explicitly deferred as a follow-up; not fixed in this change.
- Chosen approach: new `IsSafeToolsetName` decorator (`apps/chat-api/src/common/validators/safe-toolset-name.validator.ts`) that composes the existing `DEPLOYMENT_ID_PATTERN` character-class check (unchanged, still blocks `;`, `,`, `{`, `}`, `&`, whitespace, etc.) with a segment check rejecting any `/`-delimited segment that is empty, `.`, or `..`. Replaces `@Matches(DEPLOYMENT_ID_PATTERN)` with `@IsSafeToolsetName()` on `GetToolsetDto.toolsetName` only.

## Risks / Trade-offs

- [Risk] The character-class + segment-check combination could diverge in behavior from both `models` and `IsSafeDeploymentId`, adding a third validation shape to the codebase. → Mitigation: it is documented here and in the validator's own comment as intentionally distinct — toolsets need slash support (unlike `models`) and the stricter character set (unlike deployments).
- [Risk] `applications`, `external-services`, and `conversations` DTOs still carry the same traversal-permitting `DEPLOYMENT_ID_PATTERN` unfixed. → Mitigation: explicitly out of scope per user decision; flag as a candidate follow-up change, not silently left undocumented.
- [Risk] Narrow test coverage could let a future refactor reintroduce a slash-free or unguarded pattern. → Mitigation: regression tests cover both the traversal-rejection case and a slash-containing legitimate-name case.

## Migration Plan

Not applicable — this is a backend validation tightening with no data migration, deployed as a normal BFF release. No client-facing contract changes for any presently-valid toolset name.
