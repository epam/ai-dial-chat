## 1. Shared model and lookup (`libs/chat-shared`)

- [ ] 1.1 Add `libs/chat-shared/src/models/application-visualizer.ts` with the `ApplicationVisualizer` interface (JSDoc on every field; `contentType` optional; parity fields `description`/`icon`/`passAuthInfo`/`passExplicitToken` documented as accepted-but-inert) and export it from `src/index.ts`
- [ ] 1.2 Add the deployment-id lookup and attachment-partition helpers next to `findVisualizerForMime` — exact-match key lookup, case-insensitive comma-split MIME matching, URL-presence fallback when `contentType` is absent — and export them
- [ ] 1.3 Add unit tests covering: explicit `contentType` match, comma-separated list, no-`contentType` claiming only URL attachments, unknown deployment id, and a partition that claims nothing
- [ ] 1.4 Update `libs/chat-shared/README.md` for the new exports and run `npm run validate:docs`

## 2. Backend config plumbing (`apps/chat-api`)

- [ ] 2.1 Add optional `APPLICATION_VISUALIZERS?: string` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` with `@IsOptional()` + `@IsString()`
- [ ] 2.2 Add `apps/chat-api/src/app-config/dto/application-visualizer.dto.ts` — `CustomVisualizerDto`'s shape with `contentType` optional, full `@ApiProperty` metadata on every field, and `@IsUrl({ require_protocol: true, protocols: ['http','https'] })` on `url`
- [ ] 2.3 Add the `applicationVisualizers` entry to `CONFIG_DEFINITIONS` (`valueType: 'json'`, `visibility: 'client'`, `defaultValue: {}`, `envVar: 'APPLICATION_VISUALIZERS'`, description covering the `ALLOWED_IFRAME_ORIGINS` requirement and the precedence rule)
- [ ] 2.4 Implement `parseApplicationVisualizers` in `env-config.provider.ts` mirroring `parseCustomVisualizers`: fail-open on bad JSON and on non-objects (arrays included), per-entry validation, `contentType` check only when present, `title` never trimmed, unknown keys warned and ignored
- [ ] 2.5 Add the `ALLOWED_IFRAME_ORIGINS` cross-check warning for surviving entries whose URL origin is not allowlisted
- [ ] 2.6 Surface `applicationVisualizers` through `app-config.service.ts` and add the field to `ClientConfigResponseDto` with `additionalProperties: { $ref: ApplicationVisualizerDto }`
- [ ] 2.7 Add specs for the new parser branches and the registry entry (`env-config.provider.spec.ts`, `config-registry.constants.spec.ts`, `app-config.service.spec.ts`)
- [ ] 2.8 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`; commit the regenerated client
- [ ] 2.9 Verify: `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 3. Grouped canvas content and renderer (`libs/attachment-canvas`)

- [ ] 3.1 Add `AttachmentContentType.GroupedVisualizer` and the `GroupedVisualizerCanvasContent` interface to the canvas content union, with JSDoc on every field, and export the type from `src/index.ts`
- [ ] 3.2 Extend `VisualizerCanvasRenderer` to dispatch by content variant — `sendGroupedVisualizeData` with `{ attachments, layout }` for the grouped variant, existing `sendVisualizeData` otherwise — leaving the handshake, remount guard, loading, and error paths untouched
- [ ] 3.3 Add the `case AttachmentContentType.GroupedVisualizer` branch to `AttachmentCanvasBody`
- [ ] 3.4 Add renderer tests: grouped payload shape and request name, exactly-one-send after `READY_TO_INTERACT`, no remount when the content object's identity changes, error state on send rejection
- [ ] 3.5 Verify: `npm run test:file -- libs/attachment-canvas/src/components/VisualizerCanvasRenderer/tests/VisualizerCanvasRenderer.spec.tsx`

## 4. Inline surface (`libs/attachment-canvas`)

- [ ] 4.1 Add `InlineGroupedVisualizer` (component folder + `tests/`), modelled on `McpAppInlinePreview`: framed container, header strip with the entry title and an expand icon button, `onExpand` + `expandAriaLabel` props, English-default loading/error labels, no app context and no i18n
- [ ] 4.2 Style with logical properties (`ps-*`/`pe-*`, `border-s-*`, `text-start`); pass `stroke={DIAL_KIT_ICON_STROKE}` on the Tabler icon, mark it `aria-hidden`, and do not mirror it in RTL
- [ ] 4.3 Give the iframe host a `title` naming the visualizer and keep the renderer's `role="alert"` error text
- [ ] 4.4 Export the component and its props type from `src/index.ts`, document both in `libs/attachment-canvas/README.md`, and run `npm run validate:docs`
- [ ] 4.5 Add component tests: renders the frame at the supplied height, expand button is keyboard reachable with its accessible name, error label surfaces

## 5. App wiring (`apps/chat`)

- [ ] 5.1 Add `applicationVisualizers` to `AppConfigContext` state and its response mapping, defaulting to an empty registry while loading and on error
- [ ] 5.2 Add `apps/chat/src/hooks/attachment/useApplicationVisualizers.ts` returning a module-level constant in the not-ready branch, with JSDoc explaining why
- [ ] 5.3 Add the two new i18n keys (`attachmentCanvas.visualizerLoadingLabel`, `attachmentCanvas.visualizerLoadErrorLabel`) to `en.json` and `AttachmentCanvasI18nKeys`; reuse the existing `ExpandAppLabel` and `OpenedInCanvasLabel` rather than adding duplicates
- [ ] 5.4 In `ConversationMessageItem`, resolve the matched entry from `effectiveDeploymentId`, partition the attachments, and memoise the match, the partition, and the grouped content object
- [ ] 5.5 Build the grouped content: resolve each claimed attachment's absolute URL through `attachmentCanvasUrlResolvers` / `resolveDialUrl`, map to `AttachmentItem[]` in message order, and fill `layout` with the entry's sizing plus the active `themeId`
- [ ] 5.6 Exclude claimed attachments from `nonReferenceDisplayAttachments` before it reaches the bubble's `attachments` prop
- [ ] 5.7 Render `InlineGroupedVisualizer` in the bubble's existing `afterContent` slot, resolving the frame height from `mobileHeight`/`height` via `useIsMobile`
- [ ] 5.8 Wire `onExpand` to open the canvas with the same content object, and render the existing `role="status"` opened-in-canvas placeholder in place of the inline frame while it is open there
- [ ] 5.9 Add tests: inline surface renders only on a match, claimed attachments leave the tray, unclaimed ones keep their order, expand opens the canvas with the same content, placeholder replaces the frame while open

## 6. Documentation and final verification

- [ ] 6.1 Add the `APPLICATION_VISUALIZERS` row to `apps/chat-api/README.md` (including the `ALLOWED_IFRAME_ORIGINS` requirement, the precedence rule, and the inert parity fields) and an example to `apps/chat-api/.env.template`
- [ ] 6.2 Move `APPLICATION_VISUALIZERS` out of the "Dropped with no replacement" table in `docs/legacy-chat-migration-guide.md` and record what was and was not ported; leave `ALLOW_VISUALIZER_SEND_MESSAGES` in the dropped table
- [ ] 6.3 Update `docs/architecture.md` if the new context field or lib export changes anything it describes
- [ ] 6.4 Run `npm run validate:docs`
- [ ] 6.5 Run `npm run verify:full` and fix anything it reports
- [ ] 6.6 Run the five-axis quality review from `.claude/skills/code-review-and-quality/SKILL.md`, including the responsive and mobile-parity pass on the inline surface
