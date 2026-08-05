## Context

`intro` is a duplicate-of-`description` field threaded through five layers: NestJS DTOs/services (`apps/chat-api`), the OpenAPI contract + generated client (`libs/chat-api-client`), a shared authoring form component (`libs/deployment-creation-form`), catalog display models (`libs/catalog`), and app-level editors/mappers (`apps/chat`). Removal touches all five layers but each layer's change is a straightforward deletion (field, validation rule, form input, display fallback) rather than new logic — the main risk is sequencing (contract before generated client before consumers) and ensuring no dangling references cause a type error or a runtime `undefined` read.

## Goals / Non-Goals

**Goals:**

- Remove `intro` as a distinct field from every DTO, model, form, and display surface listed in the proposal.
- Keep `description` as the single source of truth for catalog card/details text and General-step authoring — no new fallback logic, no renamed field standing in for `intro`.
- Regenerate `@epam/chat-api-client` from the updated OpenAPI contract so no hand-edited generated file drifts from the source spec.
- Leave `introText`/`intro_text` (Quick Apps starter intro text, `raw-deployment.dto.ts` upstream mapping) untouched — verified as a separate, unrelated field.

**Non-Goals:**

- No backfill or migration of existing `intro` values already stored in DIAL Core — the field is simply no longer read or written; DIAL Core may retain stale `intro` data indefinitely, which is harmless since nothing will read it back.
- No backend endpoint versioning bump — this is a request/response body field removal, not a route or method change, and existing `v1` routes stay as-is per repo convention (breaking DTO changes ship as a normal PATCH/POST body change, not a new API version).
- No change to `CatalogItem.description`'s required-ness or validation.

## Decisions

- **Order of removal: contract → generated client → backend → frontend.** Edit `libs/chat-api-client/openapi.json` first, run `npm run openapi` to confirm the generator would produce the same output by hand-removing the mirrored `intro` properties in `src/generated/src/models/index.ts` (per AGENTS.md, generated files are edited by regenerating from source, not by hand — the actual sequence is: update backend DTOs/Swagger decorators first since Swagger is generated *from* the NestJS decorators, then run `npm run openapi` to regenerate `openapi.json` and the client, then run `npm run openapi:check`). This keeps the OpenAPI spec authoritative and avoids hand-edited generated-file drift.
- **Treat `intro` and `introText`/`intro_text` as fully independent fields.** Confirmed via codebase research (Explore agent inventory) that `introText` (Quick Apps `conversationStarters.introText`, `deployment-item.dto.ts`'s `introText`, `deployments.service.ts`'s `intro_text` mapping) is a distinct upstream concept from `intro` (the 90-char catalog-friendly short field). No shared code path exists between them, so removing `intro` requires zero changes to `introText` handling.
- **Catalog details/card render `item.description` directly, not a fallback expression.** Currently `Summary.tsx` and `Card.tsx` compute `item.intro ?? item.description`. Once `intro` is removed from `CatalogItem`, these become direct `item.description` reads — no `??` fallback remains, since there is only one field left.
- **Drop `introLabel`/`introCaptionClassName` from `item-details-props.ts` rather than repurposing them for `description`.** These were presentation knobs specific to the "Intro" caption; the Summary section's caption becomes a fixed/existing label (reuse whatever caption pattern the About tab already uses) rather than carrying forward an unused customization point.
- **Delete `IntroTooLong` validation and the `intro` case from `validate-deployment-creation-fields.ts`** (shared `libs/deployment-creation-form`) instead of leaving dead validation branches — the function's field-error union type shrinks accordingly.

## Risks / Trade-offs

- **[Risk] Removing a DTO field is a breaking API change for any external client still sending `intro`.** → Mitigation: `class-validator`'s `whitelist: true` / `forbidNonWhitelisted: true` global pipe (per `apps/chat-api/AGENTS.md`) means a client that still sends `intro` gets a 400 on `forbidNonWhitelisted`, not a silent drop — this is the existing repo-wide contract-change behavior, not new risk introduced by this change. Document the removal in the API changelog/release notes.
- **[Risk] Stale `intro` values already persisted in DIAL Core for existing applications/toolsets/quick apps remain but become unreachable.** → Mitigation: acceptable per Non-Goals; nothing reads the field back, so it is inert, not corrupting.
- **[Risk] Missing a reference during removal causes a TypeScript build break or an unused-i18n-key lint warning.** → Mitigation: after edits, run `npm exec nx affected --target=lint,typecheck,test --base=origin/development-1.0` and grep for `\bintro\b` (word-boundary, case-insensitive) across `apps/` and `libs/` to confirm zero remaining true-positive hits before finalizing (excluding `introText`/`intro_text`/`starter-option.ts`'s unrelated comment).

## Migration Plan

1. Backend: remove `intro` from DTOs (`create-application.dto.ts`, `update-application.dto.ts`, `application.dto.ts`, `toolset-body.dto.ts`, `raw-deployment.dto.ts`) and the forwarding/mapping code in `applications.service.ts`, `toolsets.service.ts`, `deployments.service.ts`; update the Swagger description text in `applications.controller.ts`.
2. Run `npm run openapi` then `npm run openapi:check` to regenerate `openapi.json` and `@epam/chat-api-client`; verify no other schema unexpectedly changed.
3. Frontend models/mappers: remove `intro` from `apps/chat/src/models/toolsets.ts`, `apps/chat/src/types/apps-editor.ts`, `apps/chat/src/utils/toolsets.ts`, `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, `apps/chat/src/constants/custom-apps.ts`, `libs/catalog/src/models/catalog-item.ts`, `libs/catalog/src/models/item-details-props.ts`, `libs/catalog/src/types/detail-tab.ts` doc comment.
4. Frontend UI: remove the Intro input and its error branch from `ToolsetEditor/EditorForm/GeneralForm.tsx`, `ToolsetEditor.tsx`, `CustomAppEditor.tsx`, `AppsEditor/GeneralForm.tsx`, `AppsEditor.tsx`, `libs/deployment-creation-form/src/components/DeploymentCreationForm/DeploymentCreationForm.tsx`, and its validator (`validate-deployment-creation-fields.ts`); update `Summary.tsx`/`Card.tsx` to read `item.description` directly.
5. Remove unused `Intro*` i18n keys from `en.json` and translation-key constants.
6. Update all listed test files to drop `intro` fixtures/assertions.
7. Run affected lint/typecheck/test/build for `chat-api`, `chat`, `catalog`, `deployment-creation-form`, `chat-api-client`.

Rollback: revert the commit(s); since no data migration occurred, rollback is a pure code revert with no backward-compatibility shim needed.

## Open Questions

None — scope was confirmed with the user as full-stack removal (backend, contract, frontend), and `introText`/`intro_text` were confirmed out of scope via codebase research.
