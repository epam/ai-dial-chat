## Why

Legacy Chat 0.x let an operator bind a whole application (deployment) to a single
**grouped** visualizer through `APPLICATION_VISUALIZERS`: every attachment a message
produced was handed to one iframe at once, and the iframe rendered them as a single
composed view. DIAL Chat 1.0 ported only the sibling variable `CUSTOM_VISUALIZERS`,
which is keyed by MIME type and delivers **one attachment per iframe**. Deployments
that relied on a grouped, application-scoped visualizer have no equivalent in 1.0 and
today see their attachments as ordinary tiles.

The grouped wire protocol is already present in the packages the host consumes
(`VisualizerConnectorRequests.sendGroupedVisualizeData`, `GroupedAttachmentsData`,
`AttachmentItem` in `@epam/ai-dial-shared`), and the MIME-keyed registry already
supplies the parser, CSP gate, config plumbing, and iframe host. What is missing is the
deployment-id-keyed registry, the grouped delivery path, and a place to render it.

## What Changes

- New operator variable **`APPLICATION_VISUALIZERS`** — a JSON **object** mapping an
  application id (the message's effective deployment id) to one visualizer entry:
  `title`, `url`, optional `contentType`, `description`, `icon`, `requestTimeout`,
  `width`, `height`, `mobileHeight`. Parsed fail-open, exactly like
  `CUSTOM_VISUALIZERS`: malformed JSON yields an empty registry, one bad entry never
  drops the others.
- `contentType` is **optional** here (it is required for `CUSTOM_VISUALIZERS`). When
  set, it is a comma-separated MIME list and only matching attachments go to the
  iframe; the rest keep rendering as ordinary attachment tiles. When omitted, every
  attachment carrying a URL goes to the iframe.
- The registry reaches the browser on the existing `GET /api/v1/client-config`
  payload and is exposed through a new `useApplicationVisualizers()` hook.
- **Two rendering surfaces**, both driven by the same registry entry and the same
  grouped payload:
  1. **Inline (default, legacy parity)** — when a message's effective deployment id
     matches an entry, the assistant bubble renders one grouped visualizer iframe in
     place of the matched attachments. Attachments that do not match the entry's
     `contentType` still render as the normal attachment group. This follows the
     existing MCP App inline-preview pattern: a framed lib component placed in the
     bubble's existing `afterContent` slot, so `libs/conversation-messages` is not
     touched.
  2. **Canvas** — the inline surface carries an expand control that opens the same
     grouped payload in `AttachmentCanvas`, reusing the existing panel chrome. While
     the canvas holds it, the inline frame is replaced by the existing "opened in
     canvas" placeholder, exactly as an expanded MCP App already behaves.
- `VisualizerCanvasRenderer` gains a grouped delivery mode: it sends
  `SEND_GROUPED_VISUALIZE_DATA` with a `GroupedAttachmentsData` payload instead of
  the single-attachment `SEND_VISUALIZE_DATA`, selected by the canvas content it is
  given. The existing single-attachment path is unchanged.
- Documentation: the new variable is added to `apps/chat-api/README.md`,
  `apps/chat-api/.env.template`, and the "Dropped with no replacement" row in
  `docs/legacy-chat-migration-guide.md` is corrected to record the port.

Not breaking: the registry is empty by default, so the feature stays dark until an
operator populates it, and no existing behaviour changes when it is unset.

### Deliberately not ported

These three legacy capabilities cannot be carried over as-is and are recorded as
dropped, with the reasoning in `design.md`:

- `passAuthInfo` / `passExplicitToken` and the `layout.accessToken` they fed. 1.0 auth
  is server-side (BFF); the browser never holds an access token and legacy's
  `ALLOW_TOKEN_IN_SESSION` was itself dropped. The fields are accepted for schema
  parity and ignored, as they already are on `CustomVisualizerDto`.
- `expanded` / `borderless` / `withoutTitle`. These are legacy inline-attachment
  display flags whose paired `ATTACHMENT_TYPES_*` variables were dropped in 1.0 with
  no successor; `custom-visualizers` already specifies them as ignored.
- `ALLOW_VISUALIZER_SEND_MESSAGES` and the iframe → chat `SEND_MESSAGE` channel — a
  standing deferred item from the original custom-visualizers change, unchanged here.

## Capabilities

### New Capabilities

- `application-visualizers`: the deployment-id-keyed grouped visualizer registry — its
  entry shape, the `APPLICATION_VISUALIZERS` variable and its fail-open parsing, the
  deployment-id + optional-MIME lookup, the grouped payload the host builds, and the
  inline bubble surface with its expand-to-canvas control.

### Modified Capabilities

- `custom-visualizers`: `VisualizerCanvasRenderer` gains a grouped delivery mode
  (`SEND_GROUPED_VISUALIZE_DATA`) alongside its existing single-attachment send.
- `config-registry-and-env-provider`: a new `applicationVisualizers` registry
  definition and its fail-open object parser in `EnvConfigProvider`.
- `client-config-endpoint`: a new `applicationVisualizers` field on the response DTO.
- `app-config-context`: the context carries `applicationVisualizers` and exposes it
  through `useApplicationVisualizers()`.
- `canvas`: a new grouped-visualizer canvas content variant and the path that opens it
  from the inline surface's expand control.
- `attachment-response-display`: attachments claimed by an application visualizer are
  excluded from the plain attachment tray, alongside the existing reference-only
  exclusion.

## Impact

- **Backend** — `apps/chat-api/src/config/environment.config.ts`,
  `apps/chat-api/src/app-config/config-registry/{config-registry.constants.ts,env-config.provider.ts}`,
  new `dto/application-visualizer.dto.ts`, `dto/client-config-response.dto.ts`,
  `app-config.service.ts`. Regenerating the OpenAPI client (`npm run openapi`) updates
  `libs/chat-api-client`.
- **Libs** — `libs/chat-shared` (new `ApplicationVisualizer` model + lookup helper),
  `libs/attachment-canvas` (grouped canvas content, grouped send path, and the new
  `InlineGroupedVisualizer` frame). `libs/conversation-messages` is unchanged — the
  bubble's existing `afterContent` slot carries the inline surface. The registry
  reaches every lib as data through props; no lib reads config or env.
- **App** — `apps/chat/src/context/AppConfigContext.tsx`,
  `apps/chat/src/hooks/attachment/` (new `useApplicationVisualizers`),
  `ConversationView.tsx` / `ConversationMessageItem.tsx` (the per-message
  `effectiveDeploymentId` already computed there becomes the registry key), plus new
  i18n keys for the expand control.
- **Operations** — each entry's origin must also appear in `ALLOWED_IFRAME_ORIGINS`,
  which remains the sole source of the CSP `frame-src` directive; otherwise the
  browser blocks the iframe.
- **Docs** — `apps/chat-api/README.md`, `apps/chat-api/.env.template`,
  `docs/legacy-chat-migration-guide.md`.
