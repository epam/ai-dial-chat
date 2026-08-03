## Context

The chat application can display attachments only for the MIME types it understands natively — images, audio, PDF, Markdown, JSON, and plain text. Anything domain-specific (a Plotly figure, a Vega spec, a proprietary telemetry format) falls through to "preview not supported" and can only be downloaded, even when the producing application knows exactly how it should be rendered.

**Custom visualizers** close that gap: an operator registers a mapping from a MIME type to the URL of a small web application, and an attachment of that type is rendered by that application inside a sandboxed `<iframe>`. Host and iframe exchange the attachment payload over `postMessage`. The visualizer applications are written and deployed independently of this repository — third-party authors build against a published iframe-side connector package.

Two constraints shape the design and are the reason several decisions below are not free choices:

1. **Visualizer applications are already deployed.** A number of them exist and are in use against the current wire protocol. The message envelope, the naming convention that namespaces those messages, and the published iframe-side package surface therefore have to stay compatible — a protocol change means every one of those applications breaks, and we cannot redeploy them.
2. **Operator configurations are already in use.** The `CUSTOM_VISUALIZERS` environment variable, its JSON shape, and its per-entry field semantics are live operational config. Entry shapes that are accepted today must keep being accepted.

Within those constraints there is genuine freedom in two places, and this design uses it: the registry reaches the client through the `ConfigDefinition` registry and `/api/v1/config` (rather than any bespoke config path), and the visualizer renders inside the existing `AttachmentCanvas` side panel opened by clicking an attachment chip (rather than inline in the message body).

Stakeholders:

- **Frontend/UI:** owns `apps/chat` glue (hooks, context) and the canvas lib extension.
- **BFF:** owns `apps/chat-api` env registration and OpenAPI DTO update.
- **Ops/DevOps:** owns the `CUSTOM_VISUALIZERS` env var, whose name and entry semantics are fixed by existing deployments.
- **Third-party visualizer authors:** consume `@epam/ai-dial-chat-visualizer-connector` (iframe-side lib), not the host side.

## Goals / Non-Goals

**Goals**

- Render per-MIME custom visualizers with this UX: attachment chip in the message → click opens `AttachmentCanvas` → visualizer iframe renders inside the canvas.
- Keep the wire protocol compatible with already-deployed visualizer applications built against `@epam/ai-dial-chat-visualizer-connector`, so none of them need changing: `READY`, `READY_TO_INTERACT`, `SEND_VISUALIZE_DATA`, `SEND_VISUALIZE_DATA/RESPONSE`.
- Keep libs isolation-clean per `AGENTS.md`: no lib reads app-level config, feature flags, auth, i18n, or theme directly. The app resolves the registry and hands the lib a fully-resolved `VisualizerCanvasContent`.
- Fail-open: any config error yields an empty registry and a silent-feature state; the API never crashes on bad JSON.
- Backwards-compatible client contract: the `/api/v1/config` shape only grows.

**Non-Goals**

- Grouped/application-level visualizers (`GroupedVisualizerRenderer`, `SEND_GROUPED_VISUALIZE_DATA`, per-`applicationId` registry). Deferred.
- Iframe → chat `SEND_MESSAGE` protocol and its `ALLOW_VISUALIZER_SEND_MESSAGES` gate. Deferred.
- Auth-token forwarding (`passAuthInfo`, `passExplicitToken`, `providerId`, `logInHint`, `accessToken` in layout). Deferred.
- Locale, language, or `dir` propagation into the iframe URL. Deferred.
- Inline (in-message) iframe rendering. Deliberately excluded — canvas-only.
- Registering visualizer URLs per-deployment via DIAL Core config. Only global env-driven registry.
- Republishing `@epam/ai-dial-chat-visualizer-connector` from this monorepo. Third-party authors keep consuming the published package from the legacy Chat `development` line until that line is deprecated.

## Decisions

### D1. Where do host visualizer models live?

**Decision:** in `libs/chat-shared/src/models/custom-visualizer.ts`, re-exported from `@epam/ai-dial-chat-shared`. This file owns host config/canvas shapes only (`CustomVisualizer`, `CustomVisualizerData`, `CustomVisualizerDataLayout`). Wire protocol enums come from published `@epam/ai-dial-shared` at the runtime call site — they are not mirrored in `chat-shared`.

**Alternatives considered:**

- **In a new `libs/visualizer-shared` package.** Rejected — one more Nx project to maintain for < 100 lines of types.
- **Only use types from `@epam/ai-dial-shared`.** Rejected for config/API — `CustomVisualizer` and canvas payload shapes are owned by this monorepo and must not pull the legacy shared package into chat-api / client-config DTOs.
- **Duplicate connector wire enums in `chat-shared`.** Rejected — the published package is the source of truth for those members while consuming npm.

**Rationale:** keep host-owned models in `models/`; leave the connector wire surface to the npm packages.

### D2. How is the registry surfaced from server to client?

**Decision:** new `ConfigDefinition` entry `customVisualizers` (`type='config'`, `valueType='json'`, `visibility='client'`, `envVar='CUSTOM_VISUALIZERS'`, `defaultValue=[]`). The existing `client-config-endpoint` returns the parsed array under `customVisualizers`. `AppConfigContext` exposes it; a new `useCustomVisualizers()` hook returns a memoised array.

**Alternatives considered:**

- **New dedicated endpoint `GET /api/v1/config/custom-visualizers`.** Rejected — no independent lifecycle from the rest of app config; adds one round-trip for no benefit.
- **Add to `DeploymentItem` DTO (per-deployment).** Rejected — requires DIAL Core changes and moves scope beyond a port. Kept as a documented follow-up in Open Questions.
- **A `FeatureFlag` entry.** Rejected — the value is not boolean.

**Rationale:** matches the existing `dialCore.externalUrl`, `announcement.html`, and `asr.modelId` precedent in the registry. The env-var name and entry semantics are inherited unchanged from existing deployments, so no operator has to rewrite config.

### D3. Where does the iframe actually mount — canvas lib or app?

**Decision:** inside `libs/attachment-canvas` via a new `AttachmentContentType.Visualizer` variant, `VisualizerCanvasContent` payload, and `VisualizerCanvasRenderer` internal component. `attachment-canvas` peers on the published `@epam/ai-dial-visualizer-connector` / `@epam/ai-dial-shared` packages (provided by the workspace root).

**Alternatives considered:**

- **Render an app-side component into a slot exposed by the canvas.** Rejected — introduces a new "renderer registry" abstraction to the canvas lib for one variant. Overkill.
- **App renders a portal-like overlay separate from the canvas.** Rejected — user explicitly wants "open the canvas."
- **Keep the visualizer renderer app-side and have the canvas just hold a generic children slot for that content type.** Rejected — the canvas switch is the discriminator; a hybrid where one branch delegates to app is a leaky abstraction.

**Rationale:** the canvas lib already owns the switch over `AttachmentContentType`. Adding one more variant with a self-contained renderer is the minimum-surface-area extension.

### D3a. Where do the connector packages come from?

**Decision:** consume the published stable npm packages `@epam/ai-dial-visualizer-connector` and `@epam/ai-dial-shared` (currently `0.48.0`). Do not vendor workspace copies. Third-party visualizer authors continue to use published `@epam/ai-dial-chat-visualizer-connector`. A later follow-up may port the connectors into this monorepo when the legacy Chat line is retired (checklist on `VisualizerCanvasRenderer`).

**Alternatives considered:**

- **Vendor / port both connector libs into this workspace.** Rejected — protocol fixes would have to be maintained in two Chat lines at once; the published packages already own that surface.
- **Pin npm `development` / `-dev.*` tags.** Rejected for host stability — use the stable `latest` line.

**Rationale:** host wiring (config, canvas, routing) is unique to this monorepo; the iframe manager is shared protocol code with a single published source of truth. Trade-off: the host depends on `@epam/ai-dial-shared` alongside `@epam/ai-dial-chat-shared`, confined to `VisualizerCanvasRenderer` / its tests.

### D4. What determines "should this attachment open in a visualizer"?

**Decision:** case-insensitive match on `attachment.contentType` against `customVisualizers[i].contentType`. The match is performed inside `openFileCanvas`, the internal function of `useOpenAttachmentCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) — the FIRST case checked in its `switch (contentType)` block, before the existing `MIMEType.PDF` / `MIMEType.Markdown` / `MIMEType.JSON` cases. `openAttachmentCanvas` builds the `VisualizerCanvasContent` and calls `openCanvas`.

**Alternatives considered:**

- **Match inside `useAttachmentAction`.** Rejected once checked against the real click-routing: `openspec/specs/canvas/spec.md`'s "Open triggers" table shows every documented entry point (message bubbles via `ConversationView.tsx` → `handleMessageAttachmentClick`, the sources panel, both attachment trays) calls `useOpenAttachmentCanvas.openAttachmentCanvas` FIRST. `useAttachmentAction.handleAttachmentClick` is only ever consulted as a fallback when `openAttachmentCanvas` returns `false`. For any *unmatched* MIME, `openFileCanvas` already returns `true` via its `Unsupported` branch (a download-capable canvas state) — so a visualizer check placed in `useAttachmentAction` is unreachable for the primary chip-click path this change exists to support. It would still pass its own unit tests in isolation, which is why this needed explicit verification against the real hook wiring.
- **Match by file extension.** Rejected — MIME is the canonical discriminator, and it is what the registry is already keyed on in existing operator configurations.
- **Match by DIAL file custom metadata.** Rejected — no such metadata channel on 1.0 yet.

**Rationale:** cheapest possible check; placed at the one chokepoint every documented entry point already passes through, so the feature is reachable from message bubbles, the sources panel, and both attachment trays without duplicating the lookup at each call site. `useAttachmentAction` is left untouched by this change.

### D5. How does the host know the attachment payload to send?

**Decision:** the app-side hook (`useOpenAttachmentCanvas`, inside `openFileCanvas`) fetches the file bytes/JSON using the same helper the canvas already uses for text/JSON attachments (`resolveJsonCanvasContent`/`resolveTextCanvasContent` or equivalent under `apps/chat/src/utils/attachment-canvas.ts`). The parsed payload becomes `content.data`. This keeps all HTTP knowledge in the app.

**Alternatives considered:**

- **Have the visualizer renderer inside the lib fetch the payload itself.** Rejected — violates library isolation (the lib would need to know the DIAL file URL scheme and BFF endpoints).
- **Send only the DIAL file URL and have the visualizer fetch.** Rejected — third-party visualizers would need auth cookies, which we're deliberately not forwarding.

**Rationale:** keeps the lib pure — all HTTP and DIAL-file knowledge stays at the application edge, per `AGENTS.md §Library isolation`.

### D6. Sandbox attribute default?

**Decision:** grant the capability set that interactive visualizers actually need — `sandbox` tokens `allow-same-origin allow-scripts allow-modals allow-forms allow-downloads allow-popups allow-presentation`, plus an `allow` attribute of `clipboard-write, fullscreen, accelerometer, gyroscope, autoplay, web-share, encrypted-media`. `allow-top-navigation` is withheld. The sandbox value is fixed in the constructor and is not overridable via `VisualizerConnectorOptions`.

**Alternatives considered:**

- **Minimal `sandbox="allow-scripts allow-same-origin"`, withholding forms/popups/modals/downloads (an earlier draft of this decision).** Rejected. A visualizer is not untrusted third-party content in the drive-by sense: it only loads because an operator explicitly listed its URL in `CUSTOM_VISUALIZERS`, which is the actual trust boundary. Meanwhile the withheld tokens map directly onto ordinary visualizer features — exporting a chart needs `allow-downloads`, a print/detail view needs `allow-popups`, a confirm dialog needs `allow-modals`, copy-to-clipboard needs `clipboard-write`. A minimal set would silently disable those, and the failure would surface as "the export button does nothing" during integration rather than as a clear error.
- **No `allow-same-origin`.** Rejected — visualizers commonly make same-origin XHR to their own backend and break without it.
- **`sandbox=""` (fully sandboxed).** Rejected — scripts are required to render anything.
- **Granting `allow-top-navigation`.** Rejected and called out explicitly: nothing a visualizer legitimately does requires navigating the host page, and allowing it would turn a compromised visualizer into a redirect vector against the whole app.

**Rationale:** the trust decision belongs to the operator who registers the URL. Given that, the sandbox should enable the interactions visualizers are built to perform, while still withholding the one capability (top-level navigation) whose only real use is hostile.

### D7. Error handling posture for the connector

**Decision:** the handshake is unbounded; only individual requests are bounded.

- `ready()` waits **indefinitely** for `READY_TO_INTERACT`. It settles only on that event or on `destroy()`. There is no handshake timeout.
- `requestTimeout` (per registry entry) bounds each `send()` request — one outbound message awaiting its matching `/RESPONSE` acknowledgement, which in this scope means `SEND_VISUALIZE_DATA`. Default when unset is `10000` ms. This bounds a round-trip we initiated, not the visualizer's startup.

**Deferred-request / Task behaviour** comes from the published `@epam/ai-dial-visualizer-connector` / `@epam/ai-dial-shared` packages (same conventions as legacy Chat: timeout rejects with a **string**, handshake unbounded). This monorepo does not own that primitive while consuming npm (see D3a).
- While `ready()` is pending the renderer shows the loader. `send()` rejection (timeout) and `destroy()` surface the error state. The canvas header close button stays functional in every state.

**Alternatives considered:**

- **Bound the handshake too, e.g. reject `ready()` after 5s (an earlier draft of this decision).** Rejected. Boot time for a visualizer application is outside our control and varies with the visualizer's own bundle size, cold-start, and backend — a deliberately chosen timeout would be an arbitrary verdict on integrations that work fine today, and the failure mode it introduces (a working visualizer that intermittently refuses to load) is worse than the one it prevents. Retired together with what was Open Question 6.
- **Retry with backoff inside the connector.** Rejected — the connector is a low-level primitive; retry policy belongs at the app or renderer layer.
- **Drop `requestTimeout` and hard-code a single value.** Rejected — it is an existing per-entry configuration field that operators already set for slow visualizers; removing it would break live configuration for no benefit. This closes what was Open Question 4.

**Accepted consequence:** a visualizer that never posts `READY_TO_INTERACT` leaves the panel in its loading state indefinitely. The user can always close the panel, so nobody is trapped. Turning this into a bounded, diagnosable failure is a reasonable follow-up once there is evidence about real-world boot times; it is deliberately out of scope here.

**Rationale:** bound what we own (a request we sent, whose response is overdue) and leave unbounded what we do not (how long someone else's application takes to start).

### D9. `title` is the postMessage namespace, not a display label

**Decision:** `CustomVisualizer.title` is **required and non-empty**, and is the protocol namespace used as `visualizerName` on every message in both directions (`${title}/READY`, `${title}/SEND_VISUALIZE_DATA`, …). The app passes it into `VisualizerCanvasContent.visualizerName`. Entries without a usable `title` are dropped by the registry loader. It MUST NOT be translated.

**Alternatives considered:**

- **`title?: string` as an optional human-readable label, with the namespace derived from something else (the earlier draft of this design).** Rejected. The existing wire protocol already uses this field as the namespace on both ends: the host prefixes outbound messages with it, and the iframe-side connector takes the same string as its `appName` constructor argument — documented there as *"name of the Visualizer same as in config"*. They are one shared key, not two coincidentally-equal strings. Treating `title` as decorative would break every already-deployed visualizer: the iframe would load, then wait forever on a prefix the host never sends, with no error surfaced on either side. This failure is invisible to unit tests, since host and iframe each pass in isolation — which is why it is called out here and covered by an end-to-end test instead.
- **Introducing a separate `visualizerName` config field distinct from `title`.** Rejected — cleaner naming, but it changes the wire contract and would require every existing visualizer application and its configuration to be updated in lockstep.

**Rationale:** wire compatibility is an explicit goal of the port. `title` is the shared secret between host config and iframe app; making it required and documenting it as such is the only shape that preserves that.

### D10. `contentType` accepts a comma-separated MIME list

**Decision:** `contentType` is stored verbatim as a string and split on `,` (parts trimmed, empties skipped) at lookup time, so one entry can serve several MIME types. Comparison stays case-insensitive. When several entries match, the first in registry order wins.

**Alternatives considered:**

- **Treat `contentType` as a single MIME (the earlier draft).** Rejected — the comma-separated form is already valid in live configuration, and one entry serving several closely-related MIME types is the normal case (a visualizer for a format that ships under two media-type spellings). Reading it as a single literal MIME would leave such an entry matching nothing at all, silently, with no config error to point at.
- **Change the shape to `contentTypes: string[]`.** Rejected — cleaner in isolation, but it invalidates configuration that works today, which defeats keeping the variable name and shape stable.
- **Support a `\,` escape for literal commas in a MIME type.** Rejected — RFC 2045 does not allow an unquoted comma in a media type or subtype, so the escape would be unreachable. A comma in this field is always a separator.

**Rationale:** existing configuration keeps working, at the cost of one `split`/`trim` in the lookup helper.

### D8. Registry parsing failure posture (server-side)

**Decision:** fail-open with empty registry. Invalid JSON → `[]` + error log. Invalid entry → drop that entry + error log; keep other valid entries. Never crash the API on config error.

**Alternatives considered:**

- **Fail-closed (crash on invalid config).** Rejected — a typo in a customer env would take the whole chat down for a feature that's supposed to be dark by default.
- **Sanitize and correct (e.g. auto-add scheme).** Rejected — too much magic; makes ops debugging harder.

**Rationale:** other `ConfigDefinition` entries follow the same fail-open pattern.

## Risks / Trade-offs

- **[Legacy shared dual-stack]** Host depends on `@epam/ai-dial-shared` (via the published connector) alongside `@epam/ai-dial-chat-shared` → Accepted (D3a). Confine `@epam/ai-dial-shared` imports to `VisualizerCanvasRenderer` / its tests; config and API types stay on `chat-shared`.
- **[Published-package hygiene gaps]** The stable npm connector is not idempotent on `destroy()`, and the iframe-side package uses a prefix origin check → Documented as known published behaviour; address in a follow-up port if/when connectors move in-repo (see `VisualizerCanvasRenderer` TODO).
- **[Silently ignored config fields]** Entries may legitimately carry fields this version does not implement (`description`, `icon`, `passAuthInfo`, `passExplicitToken`, `expanded`, `borderless`, `withoutTitle`). An operator setting one and seeing no effect has no obvious way to tell whether it was ignored or mis-set → the registry loader logs a warning naming each ignored field, and ignoring a field never drops the entry, so the visualizer still works. The fields that carry behaviour are all supported: comma-separated `contentType` (D10), `title` as protocol namespace (D9), `requestTimeout` (D7).
- **[Silent handshake mismatch on `title`]** `title` is the postMessage namespace shared with the iframe app (D9). An operator who "cleans up" a `title` — translating it, changing capitalisation, or renaming it for readability — breaks the integration with no error on either side: the iframe loads, the host sends to a prefix nobody listens on, and the panel just shows the timeout error state → `title` is required and documented as a protocol identifier in both connector READMEs and in the env-var example; the timeout error state is the visible symptom, and the `.ready()` rejection message should name the expected prefix to make this diagnosable.
- **[Third-party iframe stability]** A broken visualizer application that never posts `READY_TO_INTERACT` leaves the canvas in its loading state indefinitely, with no error state and no diagnostic → **accepted and unmitigated** (D7). The close button remains functional so the user is never trapped. Bounding the handshake was considered and rejected; it is the natural follow-up if this proves to bite in practice.
- **[Broad iframe capability grant]** The sandbox permits downloads, popups, modals, forms, presentation, clipboard writes, and fullscreen (D6), so a malicious or compromised visualizer can do considerably more than render a chart → the mitigating control is the registry itself: a visualizer only loads if an operator explicitly listed its URL, so this is a vetted-integration surface rather than open user content. `allow-top-navigation` is withheld so a visualizer can never redirect the host page, and the `postMessage` origin/source checks below still apply regardless of sandbox tokens. Operators should treat adding a `CUSTOM_VISUALIZERS` entry as granting that origin in-app privileges, and the `.env.template` comment should say so.
- **[postMessage spoofing]** Any origin can post to `window` → host connector enforces `event.source === iframe.contentWindow`; messages failing this check are silently dropped. Origin-based filtering is not applied — trust derives from the source-window reference, which is unforgeable.
- **[Visualizers must tolerate the canvas viewport]** Visualizers render inside the side panel rather than inline in the message, so the width and height they get differ from an in-message embed. A visualizer with a hard-coded layout may look cramped → the panel is resizable and visualizers should use responsive layouts. `width`/`height`/`mobileHeight` from the registry entry are forwarded in the layout payload so the visualizer can adapt its initial render.
- **[Published-package surface]** `@epam/ai-dial-chat-visualizer-connector` (iframe-side) remains owned and published by the legacy Chat `development` line. This change does not republish it. Authors keep using the existing stable npm package; wire values for the base flow are unchanged.

## Migration Plan

**No data migration required.** The change is additive on both API and client contracts.

**Rollout steps:**

1. Merge the change with `CUSTOM_VISUALIZERS` unset in all environments → feature dark, no visible change.
2. Rebuild `@epam/chat-api-client` (`npm run openapi && npm run openapi:check`) and commit the regenerated files as part of the PR.
3. Ensure workspace root pins stable `@epam/ai-dial-visualizer-connector` / `@epam/ai-dial-shared` and `npm install` has refreshed the lockfile.
4. Ship the frontend + backend together (single artifact — the API is a BFF for this app).
5. Per-environment enablement: set `CUSTOM_VISUALIZERS` env to the desired JSON on `chat-api`. Restart `chat-api`. No client cache invalidation required — client reads config on load.

**Follow-up (optional, after the legacy Chat line is retired):** port the connector libs into this monorepo per the checklist on `VisualizerCanvasRenderer`, drop the npm deps on `@epam/ai-dial-visualizer-connector` / `@epam/ai-dial-shared`, and publish `@epam/ai-dial-chat-visualizer-connector` from this repo if needed.

**Rollback:**

- **Full rollback:** unset `CUSTOM_VISUALIZERS` and restart `chat-api`. Feature immediately dark.
- **Partial rollback (revert code):** all changes are additive. Reverting the merge commit removes the entry from the registry, empties `AppConfigContext.customVisualizers`, removes the `AttachmentContentType.Visualizer` variant. No forward-incompatibility with data at rest.

## Open Questions

1. ~~**Per-deployment visualizer config from DIAL Core.**~~ **Closed** — stays env-only (`CUSTOM_VISUALIZERS`). Adding `customVisualizers` to `DeploymentItem` remains a possible future change but is explicitly not planned here.
2. ~~**`SEND_MESSAGE` demand.**~~ **Closed** — stays out of scope, per the "base rendering flow only" decision. Low-risk because the capability is opt-in: it is gated behind its own `ALLOW_VISUALIZER_SEND_MESSAGES` operator flag, off by default, and it is not part of the connector contract — the host application, not the connector, is what turns an inbound message into a chat message. Every visualizer needs `SEND_VISUALIZE_DATA` to render; only a deployment that had explicitly enabled the flag would notice the absence.
3. ~~**Locale/`dir` forwarding.**~~ **Closed** — nothing to do. The iframe `src` is the configured URL verbatim, with no locale, `dir`, or token query parameters appended, and that is the intended contract (see the "iframe URL is unmodified" scenario). A visualizer that needs to localise reads its own locale; the host does not inject one.
4. ~~**Timeout tuning — should `requestTimeout` be per-entry?**~~ **Closed** — resolved in D7: per-entry, default `10000` ms, bounding `send()` only.
5. ~~**Naming of the iframe-side published package.**~~ **Closed** — keep `@epam/ai-dial-chat-visualizer-connector`. This change does not republish it; authors use the existing stable npm package (D3a).
6. ~~**What default should bound `ready()`?**~~ **Retired** — moot: D7 leaves the handshake unbounded.
7. ~~**Where do the connector packages live?**~~ **Closed** — consume stable npm (D3a); optional later in-repo port tracked on `VisualizerCanvasRenderer`.

_No open questions remain. The iframe capability grant is settled in D6, with its trade-off recorded in the risk list._
