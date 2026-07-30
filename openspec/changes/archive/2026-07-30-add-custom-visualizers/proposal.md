## Why

The app can only preview attachments whose MIME types it handles natively (image, audio, PDF, Markdown, JSON, text). A domain-specific attachment — a Plotly figure, a Vega spec, a proprietary telemetry format — falls through to "preview not supported" and can only be downloaded, even when the application that produced it knows exactly how it should be rendered.

This change adds **custom visualizers**: an operator maps a MIME type to the URL of a small web application, and an attachment of that type is rendered by that application inside a sandboxed `<iframe>`, with the attachment payload delivered over `postMessage`. Visualizer applications are built and deployed independently of this repository, against a published iframe-side connector package.

The wire protocol and the `CUSTOM_VISUALIZERS` configuration shape are treated as fixed inputs rather than open design space: visualizer applications and operator configurations already exist against them, and neither can be redeployed by this change. The design freedom is exercised where it is available — the registry reaches the client through the `ConfigDefinition` registry and `/api/v1/config`, and the visualizer renders in the existing `AttachmentCanvas` side panel opened by clicking an attachment chip.

## What Changes

- Add a new `CUSTOM_VISUALIZERS` environment variable (JSON string of `CustomVisualizer[]`) to `apps/chat-api` and expose it as a client-visible entry in the `ConfigDefinition` registry (`customVisualizers` key). Each entry's `contentType` accepts a comma-separated MIME list, and its `title` is the postMessage protocol namespace shared with the visualizer application — both semantics are fixed by existing configurations and visualizers (see `design.md` D9, D10).
- Extend `AppConfigContext` so the client can read the resolved `CustomVisualizer[]` registry.
- Introduce a new `libs/visualizer-connector` (host-side iframe manager class) and `libs/chat-visualizer-connector` (iframe-side receiver, published for third-party visualizer authors). Add the protocol types/enums to `libs/chat-shared`.
- Extend `libs/attachment-canvas` with a new `AttachmentContentType.Visualizer` variant, a `VisualizerCanvasContent` model, and a `VisualizerCanvasRenderer` internal component that instantiates `VisualizerConnector`, performs the `READY`/`READY_TO_INTERACT` handshake, and sends `SEND_VISUALIZE_DATA` with a `CustomVisualizerDataLayout` payload (`themeId` plus the registry entry's optional size hints).
- Update `useOpenAttachmentCanvas` (`openFileCanvas`) in `apps/chat` so that an attachment whose MIME type matches a registry entry opens the canvas with a `VisualizerCanvasContent`. `useAttachmentAction` is unaffected: it is a download-only fallback consulted only when `openAttachmentCanvas` returns `false`, which never happens for a matched visualizer MIME (see `design.md` D4 for why the original draft's target hook was wrong).
- The protocol surface is deliberately minimal on the host side: `SEND_MESSAGE` and `SEND_GROUPED_VISUALIZE_DATA` enum members are present in `libs/chat-shared`, and their iframe-side counterparts (`sendMessage`, the grouped-data handler) are kept in `ChatVisualizerConnector`, for operator-config and wire-format parity with `development` — already-deployed visualizers emit them. Host-side handling of both is intentionally not implemented: the host ignores these envelopes. Auth-token forwarding (`passExplicitToken`/`passAuthInfo`), locale/`dir` in iframe URL, and grouped/application-level visualizers are deferred. Fields belonging to deferred features (`description`, `icon`, `passAuthInfo`, `passExplicitToken`) are kept on the `CustomVisualizer` type for schema parity and accepted by the registry loader, but ignored by host logic.
- Feature is dark by default. No client-side feature flag; empty registry short-circuits every code path.

## Capabilities

### New Capabilities

- `custom-visualizers`: registry of MIME → visualizer URL entries, the host-side iframe manager and postMessage protocol used to send attachment data to sandboxed visualizer iframes, and the wiring that opens the canvas with a visualizer renderer when an attachment's MIME matches the registry.

### Modified Capabilities

- `canvas`: adds `AttachmentContentType.Visualizer` variant, `VisualizerCanvasContent` payload, the `VisualizerCanvasRenderer` branch in the `AttachmentCanvas` switch, and a first-priority "MIME ∈ visualizer registry" case inside `useOpenAttachmentCanvas`'s `openFileCanvas` (evaluated before the existing PDF/Markdown/JSON cases), so a click on a visualizer-mapped attachment from any of the canvas's documented entry points (message bubbles, sources panel, input trays) opens the canvas with the visualizer instead of the default content-type handling. Panel chrome behaviour is unchanged.
- `config-registry-and-env-provider`: adds `customVisualizers` registry entry (`type='config'`, `valueType='json'`, `visibility='client'`, `envVar='CUSTOM_VISUALIZERS'`, `defaultValue=[]`).
- `app-config-context`: surfaces the parsed `customVisualizers` array to client consumers.

## Impact

- **Code (new):** `libs/visualizer-connector/`, `libs/chat-visualizer-connector/`, `libs/chat-shared/src/{types,constants}/visualizer-connector.ts`, `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/`.
- **Code (modified):** `libs/attachment-canvas` (`types/attachment-canvas.ts`, `models/attachment-canvas.ts`, `components/AttachmentCanvas/AttachmentCanvas.tsx`, `package.json`); `apps/chat-api/src/config/environment.config.ts`; `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`; `apps/chat-api/src/app-config/dto/` (new `CustomVisualizerDto`, extended `AppConfigResponseDto`); `apps/chat/src/context/AppConfigContext.tsx`; `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`. `apps/chat/src/hooks/attachment/useAttachmentAction.ts` is NOT modified (see `design.md` D4).
- **APIs:** `GET /api/v1/config` gains an optional `customVisualizers: CustomVisualizerDto[]` field. No other endpoint changes.
- **OpenAPI:** `chat-api-client` regenerated. Run `npm run openapi && npm run openapi:check` after backend changes.
- **Dependencies:** no new npm packages. New internal lib-to-lib dep (`libs/attachment-canvas` → `@epam/ai-dial-visualizer-connector`); both libs are isolation-clean per `AGENTS.md §Library isolation`.
- **Config / ops:** new `CUSTOM_VISUALIZERS` env var (JSON string). Every field that carries behaviour is supported — comma-separated `contentType`, `title` as protocol namespace, `requestTimeout`. Fields belonging to deferred features (`description`, `icon`, `passAuthInfo`, `passExplicitToken`, `expanded`, `borderless`, `withoutTitle`) are ignored with a warning log and never cause an entry to be dropped, so an existing configuration keeps working as long as it does not depend on a deferred capability. Registering a URL grants that origin in-app iframe privileges (see `design.md` D6) — only vetted visualizers should be listed.
- **Backward compatibility:** additive only. `/api/v1/config` consumers ignore unknown fields; empty registry disables the feature entirely.
- **Testing:** unit tests for the connector, the canvas renderer, `useOpenAttachmentCanvas` and `useCustomVisualizers`, and the config-registry entry. Integration tests for canvas switch and context propagation. E2E scenario with a local echo-iframe fixture.
