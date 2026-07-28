Slicing strategy: **vertical**, in the order below — protocol types land first (nothing depends on runtime behavior yet), then the backend config path, then the app-side state owner (mountable but inert), then overlay wire-up, then each UI surface is gated one at a time (each independently revertable), then sandbox/docs, then a final affected-wide verification pass.

## 1. Protocol and shared types (`libs/chat-shared`)

- [x] 1.1 Expand `OverlayFeature` in `libs/chat-shared/src/types/overlay/overlay-protocol.ts` from one member to the 32 transferable keys listed in `specs/chat-overlay-protocol/spec.md`, each with a one-line JSDoc description (per `.claude/rules/libs.md`).
- [x] 1.2 Add `enabledFeatures?: string[]` to `SetOverlayOptionsPayload` in the same file, with JSDoc noting array-only (no comma-separated-string form).
- [x] 1.3 Update `libs/chat-overlay/src/index.ts` — no export list change is required (it already re-exports `OverlayFeature` and `ChatOverlayOptions` by reference), but confirm the expanded enum and payload type flow through by rebuilding.
- [x] 1.4 Add/extend unit tests in `libs/chat-shared` (or wherever `overlay-protocol.ts`'s existing type-guard tests live) asserting `Object.values(OverlayFeature)` has exactly 32 members and none of the 19 missing-status keys are present (per `chat-overlay-protocol` spec scenarios).
- [x] 1.5 Verify: `npm exec nx test chat-shared`, `npm exec nx lint chat-shared`, `npm exec nx build chat-shared`.

## 2. Backend server-baseline config (`apps/chat-api`)

- [x] 2.1 Add `ENABLED_UI_FEATURES?: string[] | null = null` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, using a comma-separated `@Transform` that returns `null` for empty/absent values and `string[]` otherwise.
- [x] 2.2 Add the `uiFeatures.enabledUiFeatures` entry (defaultValue `null`, envVar `ENABLED_UI_FEATURES`) to `CONFIG_DEFINITIONS` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` per `specs/config-registry-and-env-provider/spec.md`.
- [x] 2.3 In `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`), resolve `uiFeatures.enabledUiFeatures`, filter to recognized `OverlayFeature` values (log a `warn` per dropped entry), include the filtered array as `config.enabledUiFeatures` (or `null` when env var is absent or all-invalid). **Deviation:** filters against a local `KNOWN_UI_FEATURES` constant rather than importing from `@epam/ai-dial-chat-shared` — that package pulls in browser-only DOM code that crashes a Node NestJS service at import time. Documented in the constants file.
- [x] 2.4 Add `enabledUiFeatures: string[] | null` to `ClientConfigDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` with `@ApiProperty({ nullable: true })`.
- [x] 2.5 Update `apps/chat-api/src/app-config/app-config.service.spec.ts` with tests for: unset env → `null`; valid entries → filtered array; unrecognized entry filtered + warning log; all-invalid → `null` (falls back to defaults).
- [x] 2.6 Run `npm run openapi` and `npm run openapi:check`; build and lint `chat-api-client`; confirm the generated `ClientConfigResponse.config.enabledUiFeatures: string[] | null` type.
- [x] 2.7 Update `apps/chat/src/server-api/app-config.api.ts` (or the existing wrapper) only if the generated singleton needs regeneration — no new wrapper method is needed since this rides the existing `getClientConfig` call. Confirmed no change needed.
- [x] 2.8 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`.

## 3. Frontend UI-feature state owner (`apps/chat`)

- [x] 3.1 Create `apps/chat/src/constants/ui-features.ts` exporting `DEFAULT_ENABLED_UI_FEATURES: ReadonlySet<OverlayFeature>` per the design.md classification table (19 default-on keys).
- [x] 3.2 Extend `AppConfigContext`'s `AppConfigState.config` (`apps/chat/src/context/AppConfigContext.tsx`) with `enabledUiFeatures: string[] | null`, defaulted to `null`, populated from `getClientConfig`'s new field.
- [x] 3.3 Create `apps/chat/src/context/UiFeaturesContext.tsx`: `UiFeaturesProvider`, `useUiFeatures()`, following the `ThemeContext` pattern (`createContext<T | undefined>`, `useMemo` value, throwing guard hook). Compute the effective set per `design.md` D3 (overlay override → server `enabledUiFeatures` replace → compiled-in `DEFAULT_ENABLED_UI_FEATURES`) and expose `isEnabled`, `enabledFeatures`, `applyOverlayOverride`.
- [x] 3.4 Create `apps/chat/src/hooks/useUiFeature.ts` — `useUiFeature(feature: OverlayFeature): boolean`, one hook per file with JSDoc explaining why it exists (thin wrapper over `useUiFeatures().isEnabled`).
- [x] 3.5 Mount `UiFeaturesProvider` in `apps/chat/src/main.tsx` between `AppConfigProvider` and `OverlayModeGate`.
- [x] 3.6 Unit tests (`apps/chat/src/context/tests/UiFeaturesContext.spec.tsx` or co-located): default baseline membership (all 19 on / 13 off), server override replaces defaults, server override can enable `Hide*` flags, null falls back to defaults, overlay override drops unknown values, `useUiFeature` outside provider throws, memoization (value reference stability across unrelated re-renders).
- [x] 3.7 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 4. Overlay wire-up

- [x] 4.1 Update `ChatOverlay.setOverlayOptions` in `libs/chat-overlay/src/lib/ChatOverlay.ts` to accept `Partial<Pick<ChatOverlayOptions, 'theme' | 'modelId' | 'overlayConversationId' | 'enabledFeatures'>>`, storing `enabledFeatures` as a full replace (not merge) on `this.options`.
- [x] 4.2 Update `sendCurrentOverlayOptions` (same file) to include `payload.enabledFeatures` when `this.options.enabledFeatures` is defined, mirroring the existing conditional-include pattern for `theme`/`modelId`/`overlayConversationId`.
- [x] 4.3 Update `ChatOverlayManager.setOverlayOptions` in `libs/chat-overlay/src/lib/ChatOverlayManager.ts` to forward the expanded parameter shape unchanged.
- [x] 4.4 Update `libs/chat-overlay/README.md` with a `setOverlayOptions({ enabledFeatures })` example and the replace-not-merge note.
- [x] 4.5 Add/extend `ChatOverlay`/`ChatOverlayManager` unit tests for: `setOverlayOptions` with `enabledFeatures` updates stored state and resends; omitting `enabledFeatures` on a later call preserves the previous value; initial handshake send includes constructor-supplied `enabledFeatures`; `ChatOverlayManager` forwards the call; iframe `allow` permissions are not retroactively mutated.
- [x] 4.6 Update `hasSetOverlayOptionsPayload` (or its equivalent validator) in `apps/chat/src/context/overlay/OverlayContext.tsx` to accept an optional `enabledFeatures: string[]` field, rejecting non-array values as malformed (same pattern as the existing optional-string-field checks).
- [x] 4.7 Update `handleSetOverlayOptions` in the same file: when `payload.enabledFeatures` is present, call `UiFeaturesContext`'s `applyOverlayOverride` (via `useUiFeatures()` inside `OverlayProvider`) before sending `SET_OVERLAY_OPTIONS/RESPONSE`; when absent, do not call it.
- [x] 4.8 Add tests in `apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx` (or equivalent) covering: `enabledFeatures` present → override applied and set replaces baseline; absent → no call, prior state retained; unrecognized entries filtered with a warning and `applied: true` still returned; combined `theme`+`modelId`+`enabledFeatures` in one payload all apply before a single response.
- [x] 4.9 Verify: `npm exec nx test chat-overlay`, `npm exec nx lint chat-overlay`, `npm exec nx build chat-overlay`, `npm exec nx test chat`, `npm exec nx lint chat`.

## 5. Gate transferable UI surfaces — layout & header

- [x] 5.1 Gate `header` in `apps/chat/src/components/Header/Header.tsx` (conditional mount, not CSS-hide).
- [x] 5.2 Gate `conversations-section` in `libs/sidebar`'s consuming container and `conversations-panel-toggle` in `Header.tsx`/`ChatLayout.tsx` — pass resolved booleans as props into `libs/sidebar` per library isolation (the lib itself gains no `useUiFeature` import). **Note:** implemented by conditionally rendering the app-level `<ConversationPanel>` element in `ConversationPanelView.tsx`, not by adding a prop into `libs/sidebar`/`libs/conversation-panel` — no lib change was needed since the container already owns the mount.
- [x] 5.3 Gate `showConversationsSectionByDefault` as the sidebar's initial open/closed state (`apps/chat/src/app/app.tsx`). Layout dividers (`--sb-border`/`border-s`/`border-e` treatment in `ConversationPanelView.tsx`) are unconditional; `show-layout-dividers` is excluded from the enum — see design.md known-gaps table.
- [x] 5.4 Gate `attachments-manager` — **deviation:** gates the visible `AttachmentCanvasContainer` render in `apps/chat/src/app/app.tsx` instead of the `AttachmentCanvasProvider` mount in `main.tsx`, because `apps/chat` has unconditional `useAttachmentCanvas()` callers that would throw if the provider were ever absent.
- [x] 5.5 Gate `hide-new-conversation` (conditional unmount of the new-conversation controls) in `Header.tsx`/`ChatLayout.tsx`. The header border (`border-b`) is unconditional; `chat-header-border` is excluded from the enum — see design.md known-gaps table.
- [x] 5.6 `md-sidebar-overlay-breakpoint` — **removed from enum.** No "overlay" (fixed/backdrop) sidebar mode exists anywhere in the current code — the sidebar only ever pushes content at a single 769px breakpoint. Wiring this key would mean building new overlay/backdrop UI, which the proposal explicitly excludes. Removed from `OverlayFeature` and `KNOWN_UI_FEATURES`; documented in design.md known-gaps table.
- [x] 5.7 Component/hook tests for each gate above asserting observable rendering behavior (present/absent), using role/label/text queries. Added `Header.spec.tsx`, `ChatLayout/tests/ChatLayout.spec.tsx` (new file), `ConversationPanelView.spec.tsx` cases.
- [x] 5.8 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 6. Gate transferable UI surfaces — conversation header, empty chat, chat input

- [x] 6.1 Gate `disallow-change-agent` in `ConversationView.tsx`. **Deviation:** the design's "conversation top-bar settings panel" doesn't exist as a distinct element in this codebase — implemented instead at the existing `chatSettings`/`deployments`/`isModelSelectorDisabled` props passed to `ConversationInput` (omitting `deployments` hides the model selector entirely per the lib's existing "undefined → not rendered" contract; no lib change needed). `top-settings` and `top-chat-model-settings` are excluded from the enum — see design.md known-gaps table.
- [x] 6.2 Gate `empty-chat-settings`/`hide-empty-chat-change-agent` in `NewConversationComposer.tsx` via the same `chatSettings`/`deployments` props.
- [x] 6.3 Gate `disabled-send` and `skip-focus-chat-input-onload` at both `ConversationInput` call sites (`ConversationView.tsx`, `NewConversationComposer.tsx`). Required one small additive prop on `libs/conversation-input` (`isSendDisabled`). The accent border is applied unconditionally via the existing `inputClassName` prop; `chat-input-border` is excluded from the enum — see design.md known-gaps table.
- [x] 6.4 Component tests for each gate (rendering/disabled-state assertions via Testing Library role/label queries). Added to `NewConversationComposer.spec.tsx`, `ConversationInput.spec.tsx`, `Input.spec.tsx`.
- [x] 6.5 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 7. Gate transferable UI surfaces — message actions, sharing, publishing

- [x] 7.1 Gate `likes`, `hide-edit-user-message`, `hide-regenerate-assistant-message`, `hide-delete-user-message` — implemented at the `buildMessageActions` call site in `ConversationMessageItem.tsx` (the handlers passed in are conditioned on `useUiFeature`), not inside the pure `build-message-actions.ts` util itself.
- [x] 7.2 Gate `dislike-comment` in `apps/chat/src/components/ConversationView/Rate/NegativeFeedbackModal.tsx` (comment field only, not the whole modal).
- [x] 7.3 Gate `input-files` via the existing `hideAttachFile` prop (OR'd with the pre-existing `!isAttachmentsAllowed` condition) at both `ConversationInput` call sites — no lib change needed, the prop already existed.
- [x] 7.4 `user-message-align-end` — **removed from enum.** Both existing user-message render paths in `ConversationMessageItem.tsx` already hardcode `justify-end` unconditionally; there is no alternate start-aligned state to toggle, and inventing one risks changing default rendering. Removed from `OverlayFeature` and `KNOWN_UI_FEATURES`; documented in design.md known-gaps table.
- [x] 7.5 Gate `conversations-sharing`/`conversations-publishing` in `ConversationPanelView.tsx` (menu-action filtering + popup gating). Gate `applications-sharing`/`toolsets-sharing` — required a small additive `isShareVisible` prop threaded through `libs/catalog` (`ShareButton` → `Header` → `DetailsPanel` → `Catalog`), mirroring the existing `isPublishVisible`/`isConnectVisible` pattern, since Share had no per-type visibility hook before this change; resolved in `apps/chat/src/components/CatalogView/CatalogView.tsx` by `CatalogEntityType`.
- [x] 7.6 Component tests for each gate above. Added to `ConversationPanelView.spec.tsx`, `ConversationMessageItem.spec.tsx` (new describe block), `NegativeFeedbackModal.spec.tsx`, `CatalogView.spec.tsx`, `ShareButton.spec.tsx`.
- [x] 7.7 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 8. Gate transferable UI surfaces — applications, catalog, toolsets, user settings, voice input

- [x] 8.1 Gate `custom-applications` and `hide-custom-app-creation` at the "Create Quick App" option in `CatalogView.tsx`'s `createOptions`. **`code-apps` skipped (judgment call):** no menu entry, route, or UI exists anywhere in this codebase for "Code Apps" — the enum member and default-on baseline classification are in place, but there is nothing to gate.
- [x] 8.2 Gate `catalog` at the `/catalog` route's entry points (`Navigation.tsx`'s desktop sidebar nav, `NavPageContent.tsx`'s mobile bottom-sheet nav, and `CatalogView.tsx` itself returns `null` in non-selector mode as defense-in-depth). Gate `catalog-table-view` via a new `initialViewMode` prop added to `libs/catalog`'s `Catalog` component (no existing way to control the initial grid/list default). Gate `catalog-hide-my-apps` by filtering `item.isMyApp` items out of `visibleCatalogItems`.
- [x] 8.3 Gate `toolsets` — filters `CatalogEntityType.Toolset` items out of `catalogItems` and removes the "Create Toolset" option from `createOptions` in `CatalogView.tsx`; the Toolsets tab disappears automatically since `buildCatalogTabs` derives tabs from item types present, not from `tabLabels` keys.
- [x] 8.4 Gate `hide-user-menu` (`Navigation.tsx`'s `<UserMenu />` mount) and `hide-user-settings` (`UserMenu.tsx` — gates both the "language" and "keyboard-shortcuts" dropdown entries, the closest analog to a distinct "settings" entry). The theme logo/favicon is always rendered when available; `custom-logo` is excluded from the enum — see design.md known-gaps table.
- [x] 8.5 Gate `voice-input` in `useAudioTranscription.ts`'s `isTranscriptionSupported`. **Deviation:** composes only with the UI toggle (`useUiFeature('voice-input')`), not `useFeatureFlag('asrEnabled')` as originally planned — `features.asrEnabled` defaults `false` in most deployments (no `ASR_MODEL` configured) while the mic button's *current* default visibility also depends on the selected model's `inputAttachmentTypes` capability, independent of ASR. ANDing in `asrEnabled` would have hidden the mic button by default for any deployment relying on that capability-based path — a real default-behavior regression the proposal explicitly forbids. Documented here rather than silently guessed.
- [x] 8.6 Gate `live-chat-interaction`'s UI affordance in `ToolsetSigninDialog.tsx` as `useUiFeature('live-chat-interaction') && useFeatureFlag('liveChatInteraction')` — safe to compose here (unlike 8.5) because the dialog's own `pendingEvents` can only be non-empty when `ClientChannelProvider`'s independent `useFeatureFlag('liveChatInteraction')` gate (`ClientChannelContext.tsx:68`, unchanged) already let the subscription through, so the added check is redundant-but-harmless, not behavior-changing.
- [x] 8.7 Component tests for each gate above, including the two-condition combination scenarios for `voice-input` and `live-chat-interaction`. Added to `CatalogView.spec.tsx`, `Navigation.spec.tsx`, `UserMenu.spec.tsx`, `Logo.spec.tsx`, `useAudioTranscription.spec.ts`, `ToolsetSigninDialog.spec.tsx`, `Catalog.spec.tsx` (lib), `ShareButton.spec.tsx` (lib). **Not covered:** `NavPageContent.tsx` (mobile bottom-sheet catalog filter) has no existing test file; the change mirrors the already-tested `Navigation.tsx` logic.
- [x] 8.8 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 9. Library isolation guard

- [x] 9.1 Confirmed `libs/sidebar`, `libs/conversation-input`, `libs/conversation-panel`, and `libs/catalog` (also touched this change, for `isShareVisible`/`initialViewMode`) gain no new imports of `apps/chat` contexts, `useUiFeature`, `@epam/chat-api-client`, or any app-owned feature-flag knowledge — grepped all four for `apps/chat|useUiFeature|chat-api-client|AppConfigContext|useFeatureFlag`; the only hits are pre-existing, unrelated to this change (a comment in `Input.module.scss` referencing `apps/chat/src/styles.scss`, a comment in `PublishFooter.module.scss`, and a pre-existing `@epam/chat-api-client` type-only import in `useModelSelector.spec.tsx` — none touched this session). `libs/sidebar` was never touched (`conversations-section` was resolved entirely in the app-level `ConversationPanelView.tsx`; `show-layout-dividers` is excluded from the enum and the divider rendering remains unconditional).
- [x] 9.2 Confirmed `libs/chat-shared`'s `overlay-protocol.ts` still has zero imports after the enum expansion.
- [x] 9.3 Confirmed `libs/chat-overlay`'s `ChatOverlay.ts`/`ChatOverlayManager.ts` still import only `@epam/ai-dial-chat-shared` types and internal `./internal/*` helpers — no React/UI-kit dependency, no app-owned code.

## 10. Sandbox and docs

- [x] 10.1 Added `apps/chat-overlay-sandbox/src/cases/EnabledFeaturesCase/EnabledFeaturesCase.tsx` — Direct and Manager sections, each with preset buttons ("All defaults (sample)", "Header + sharing only", "Empty set", "Header + invalid value (demo)"), a custom comma-separated input, and a shared `EventLog` response log. Wired into `app.tsx`'s case index.
- [x] 10.2 Added `EnabledFeaturesCase.spec.tsx` (5 tests) asserting each preset/custom-input path calls the mocked `setOverlayOptions` with the expected array, for both the direct instance and the manager-forwarded call.
- [x] 10.3 Confirmed via grep: no documentation under `docs/` references `enabledFeatures`/`ENABLED_FEATURES`/overlay UI toggles — no `docs/` update required.
- [x] 10.4 Verified: `npm exec nx test chat-overlay-sandbox`, `npm exec nx lint chat-overlay-sandbox`, `npm exec nx build chat-overlay-sandbox` all green. (Also fixed a pre-existing typecheck error surfaced by this build in `libs/chat-overlay/src/lib/tests/ChatOverlayManager.spec.ts` from section 4 — a raw string literal `'header'` needed to become `OverlayFeature.Header` to satisfy `ChatOverlayOptions.enabledFeatures: OverlayFeature[]`.)

## 11. Final verification

- [x] 11.1 Ran `npm exec nx -- affected --targets=lint --base=origin/development-1.0` — 19 projects + 17 dependent tasks, all green, only pre-existing warnings.
- [x] 11.2 Ran `npm exec nx -- affected --targets=test --base=origin/development-1.0` — 18 projects, 151 test files / 1756 tests passed / 2 skipped, no failures.
- [x] 11.3 Ran `npm exec nx -- affected --targets=build --base=origin/development-1.0` — 19 projects + 17 dependent tasks, all green (35/36 tasks served from cache).
- [x] 11.4 Re-ran `node tools/openapi/check-client.mjs` (the `openapi:check` script) from the repo root — no output, confirming the committed OpenAPI spec still matches the generated client after all subsequent changes.
- [x] 11.5 Confirmed the automated test suites from sections 3, 6-8, and 10.2 collectively cover: omitting `enabledFeatures` preserves default behavior, and a preset excluding a surface hides it — no additional manual test task needed beyond the automated coverage already required above.
