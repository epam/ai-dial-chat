## 1. Host visualizer models (`libs/chat-shared`)

- [x] 1.1 Add `libs/chat-shared/src/models/custom-visualizer.ts` with `CustomVisualizer` (`contentType: string` — comma-separated MIME list, `url: string`, **`title: string` required — the postMessage namespace, see design D9**, `requestTimeout?`, `width?`, `height?`, `mobileHeight?`, plus `description?`/`icon?`/`passAuthInfo?`/`passExplicitToken?` kept for schema parity with `development` and documented as not consumed by host logic; no `expanded`/`borderless`/`withoutTitle`), `CustomVisualizerData`, `CustomVisualizerDataLayout` (fields: `themeId`, `width?`, `height?`, `mobileHeight?` — no `logInHint`/`providerId`/`accessToken`). Add a doc comment on `title` stating that the iframe app must be constructed with the identical string. Do **not** duplicate connector wire enums/options from `@epam/ai-dial-shared` / `@epam/ai-dial-visualizer-connector`
- [x] 1.2 Re-export the new models from `libs/chat-shared/src/index.ts`
- [x] 1.3 Unit tests for the type shape (compile-only guards) if `chat-shared` has a test target; otherwise skip

## 2. Host-side connector (published npm package)

- [x] 2.1 Pin stable `@epam/ai-dial-visualizer-connector` and `@epam/ai-dial-shared` in the workspace root `package.json` (design D3a); do not add workspace libs for these packages
- [x] 2.2 Add both packages as `peerDependencies` on `libs/attachment-canvas` and list them in that lib's Vite `rollupOptions.external`
- [x] 2.3 Rely on the published package for iframe sandbox / `allow` capability grant (design D6): `allow-same-origin allow-scripts allow-modals allow-forms allow-downloads allow-popups allow-presentation`, plus `clipboard-write; fullscreen; accelerometer; gyroscope; autoplay; web-share; encrypted-media`. `allow-top-navigation` is not granted
- [x] 2.4 Rely on the published package for inbound `message` filtering: drop when `event.source !== iframe.contentWindow`; host side does not filter on `event.origin`
- [x] 2.5 Rely on the published package for handshake / send timeouts (design D7): `.ready()` unbounded; `options.requestTimeout` (default 10000 ms) bounds each `send()` only
- [x] 2.6 Run `npm install` so the lockfile resolves both packages from the npm registry (not workspace links)

## 3. Iframe-side connector (published npm package)

- [x] 3.1 Document that third-party visualizer authors consume published `@epam/ai-dial-chat-visualizer-connector` from npm; this monorepo does not vendor or republish that package
- [x] 3.2 Confirm wire-format parity for the base flow (`READY`, `READY_TO_INTERACT`, `SEND_VISUALIZE_DATA` / `/RESPONSE`) against already-deployed visualizers; host does not implement `SEND_MESSAGE` or `SEND_GROUPED_VISUALIZE_DATA` counterparts

## 4. Canvas lib extension (`libs/attachment-canvas`)

- [x] 4.1 Add `AttachmentContentType.Visualizer` enum member in `libs/attachment-canvas/src/types/attachment-canvas.ts`
- [x] 4.2 Add `VisualizerCanvasContent` interface to the `AttachmentCanvasContent` union in `libs/attachment-canvas/src/models/attachment-canvas.ts`
- [x] 4.3 Update `isDownloadable(content)` so `AttachmentContentType.Visualizer` returns `false`
- [x] 4.4 Create `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx`: instantiates published `VisualizerConnector` in `useEffect` (with cleanup) passing `domain`, `hostDomain: window.location.origin`, `visualizerName`, `requestTimeout`; awaits `.ready()`; sends via `@epam/ai-dial-shared`'s `VisualizerConnectorRequests.sendVisualizeData`; keeps the connector stable across unrelated parent re-renders
- [x] 4.5 Add loading + error states inside `VisualizerCanvasRenderer`: spinner while `.ready()` is pending (indefinitely if the handshake never completes — intended, see design D7); error message when the `SEND_VISUALIZE_DATA` `send()` rejects or the connector is destroyed. "Retry" is close-and-re-click (design D7) via the panel's own close button, not a button inside the renderer — matches the canvas spec's error-state scenarios, which only require the header close button to stay functional. No i18n strings inside the lib — accept optional label props from the app
- [x] 4.6 Extend the `switch (content.type)` in `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` with a `case AttachmentContentType.Visualizer` that renders `<VisualizerCanvasRenderer />`
- [x] 4.7 Add unit tests in `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/tests/VisualizerCanvasRenderer.spec.tsx`: mounts iframe, calls `send` after `ready`, destroys on unmount, shows error when `send` rejects, stays in the loading state (no error) when `ready` never settles
- [x] 4.8 Add integration test in `libs/attachment-canvas/src/components/AttachmentCanvas/tests/AttachmentCanvas.spec.tsx` for the new switch branch
- [x] 4.9 `npm exec nx test attachment-canvas` and `npm exec nx lint attachment-canvas` green

## 5. Backend env + config registry (`apps/chat-api`)

- [x] 5.1 Add `CUSTOM_VISUALIZERS?: string` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` with `@IsOptional() @IsString()`
- [x] 5.2 Create `apps/chat-api/src/app-config/dto/custom-visualizer.dto.ts` — `CustomVisualizerDto` class with `class-validator` decorators (`@IsString() @IsNotEmpty()` on `contentType`, `@IsUrl({ protocols: ['http','https'], require_protocol: true })` on `url`, **`@IsString() @IsNotEmpty()` on `title` — required, it is the postMessage namespace (design D9), not an optional label**, `@IsOptional() @IsInt() @Min(1)` on `requestTimeout`/`width`/`height`/`mobileHeight`) and `@ApiProperty` on every field. The `contentType` `@ApiProperty` description MUST state that a comma-separated MIME list is accepted; the `title` description MUST state it is the protocol identifier shared with the visualizer app
- [x] 5.3 Add `customVisualizers?: CustomVisualizerDto[]` to `AppConfigResponseDto` with `@ApiProperty({ type: [CustomVisualizerDto], required: false })`
- [x] 5.4 Add `customVisualizers` entry to `CONFIG_DEFINITIONS` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` (`type='config'`, `valueType='json'`, `visibility='client'`, `defaultValue=[]`, `critical=false`, `envVar='CUSTOM_VISUALIZERS'`)
- [x] 5.5 Implement the JSON parse + per-entry validation in the config-registry loader: full parse error → `[]` + error log; non-array JSON → `[]` + error log; per-entry validation error (incl. missing or empty-string `title`, caught by `@IsNotEmpty()`) → drop that entry + error log; unknown fields on entries (`expanded`, `borderless`, `withoutTitle`) → keep entry, log warning listing ignored field names and never drop. `title` MUST NOT be trimmed — a whitespace-only value is a legitimate `appName` for some deployed visualizers
- [x] 5.6 Unit tests for the loader: env unset → `[]`; invalid JSON → `[]`; non-array JSON → `[]`; mixed valid/invalid entries → only valid ones; entry missing `title` → dropped with error; entry with a whitespace-only `title` → **accepted**, value preserved verbatim; comma-separated `contentType` → accepted and stored verbatim; unknown fields → entry kept with warning
- [x] 5.7 Unit test that `CONFIG_DEFINITIONS` contains the `customVisualizers` entry with the expected shape
- [x] 5.8 `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` green
- [x] 5.9 `npm run openapi && npm run openapi:check`; rebuild `@epam/chat-api-client`; commit regenerated files (also fixed pre-existing `packageJson.version` SWC interop crash in `app-config.service.ts`)

## 6. Client wiring (`apps/chat`)

- [x] 6.1 Extend `AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) to surface `customVisualizers: CustomVisualizer[]` from the fetched config; default to `[]` while loading / on error
- [x] 6.2 Add `apps/chat/src/hooks/attachment/useCustomVisualizers.ts` returning a stable-reference `CustomVisualizer[]` — the ready branch returns the array from `AppConfigContext` (already memoised by the provider) and the not-ready branch returns a module-level constant, so no `useMemo` is needed
- [x] 6.3 Add a MIME→registry helper (e.g. `findVisualizerForMime`) in `apps/chat/src/utils/attachment-visualizer.ts`: splits each entry's `contentType` on `,`, trims parts, skips empty parts (no wildcard), compares case-insensitively, returns the FIRST matching entry or `undefined`. Unit-test the comma-list, first-match-wins, trailing-comma, and case-insensitive cases
- [x] 6.4 Extend `openFileCanvas` inside `useOpenAttachmentCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) with a FIRST-priority case in its `switch (contentType)` block (before `MIMEType.PDF`/`Markdown`/`JSON`): if MIME matches a `customVisualizers` entry, fetch the attachment payload via the existing file-content helper, build a `VisualizerCanvasContent` (`mimeType` from the attachment's own `contentType`, `visualizerName` from the entry's `title`, `requestTimeout` from the entry, `layout` from the entry's `width`/`height`/`mobileHeight` plus `themeId` from theme context), and return it for `openCanvas`. On payload-fetch failure, fall through to the existing switch/extension/`Unsupported` handling. Do NOT modify `useAttachmentAction` — it is a download-only fallback only reached when `openAttachmentCanvas` returns `false`, which never happens for a matched visualizer MIME (see `design.md` D4)
- [x] 6.5 Thread `customVisualizers` (from `useCustomVisualizers()`) and the current `themeId` (from theme context) into `useOpenAttachmentCanvas`, and add both to the `useCallback` dependency array of `openAttachmentCanvas`
- [x] 6.6 Add unit tests to `apps/chat/src/hooks/attachment/tests/useOpenAttachmentCanvas.spec.ts`: MIME match → canvas opens with visualizer content; resulting content carries `visualizerName` equal to the entry's `title` and `mimeType` equal to the attachment's MIME (not the entry's raw comma-separated `contentType`); MIME match but fetch fails → falls through to existing PDF/Markdown/JSON/Unsupported handling; empty registry → prior behaviour unchanged; case-insensitive match; comma-separated entry matches a MIME from the middle of the list
- [x] 6.7 Add unit tests to `apps/chat/src/hooks/attachment/tests/useCustomVisualizers.spec.ts`: returns `[]` on loading; returns array on ready; reference stable across re-renders on both the ready and the not-ready branch
- [x] 6.8 Add unit tests to `apps/chat/src/context/tests/AppConfigContext.spec.tsx` for the new `customVisualizers` field
- [x] 6.9 `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat` green

## 7. Docs, verification loop, and release prep

- [x] 7.1 Document npm package consumption and the follow-up port checklist on `VisualizerCanvasRenderer` (connector packages are external — no in-repo connector READMEs)
- [x] 7.2 Update `docs/` if any doc references custom visualizers (search `docs/` for prior mentions). Per `AGENTS.md §Docs`, use the `dial-docs` skill to find the authoritative doc and update it plus any affected diagram in this same commit — **verified no-op**: `grep -rn -i visualizer docs/` returns no matches, so there is no existing doc or diagram to update
- [x] 7.3 Update `apps/chat-api/.env.template` with a commented `CUSTOM_VISUALIZERS=` example that includes a `title`, notes that `title` must match the visualizer app's `appName`, shows a comma-separated `contentType`, and warns that registering a URL grants that origin in-app iframe privileges (downloads, popups, clipboard, fullscreen — see design D6), so only vetted visualizers should be listed — done at `.env.template` lines 151–158 (this repo uses `.env.template`, not `.env.example`)
- [x] 7.4 Run affected build/lint/typecheck/test: `npm exec nx affected --target=build --base=origin/development-1.0`; same for `lint`, `test`
- [x] 7.5 Prepare PR description referencing this OpenSpec change; verify all `applyRequires` artifacts complete via `openspec status --change add-custom-visualizers`
