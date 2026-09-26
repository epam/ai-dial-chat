## Context

`CUSTOM_VISUALIZERS` shipped in 1.0 (change `2026-07-30-add-custom-visualizers`) and
established everything a visualizer needs except the grouping and the key: a fail-open
JSON registry parser in `EnvConfigProvider`, a client-config field, an
`AttachmentCanvas` content variant, and `VisualizerCanvasRenderer` — a component that
mounts a sandboxed iframe, drives the `READY_TO_INTERACT` handshake through the
published `@epam/ai-dial-visualizer-connector`, and sends one attachment's payload.

Legacy `APPLICATION_VISUALIZERS` differs on three axes:

| | `CUSTOM_VISUALIZERS` (shipped) | `APPLICATION_VISUALIZERS` (this change) |
|---|---|---|
| Registry shape | JSON array | JSON object keyed by application id |
| Match key | attachment MIME type | the message's effective deployment id |
| Delivery | `SEND_VISUALIZE_DATA`, one attachment | `SEND_GROUPED_VISUALIZE_DATA`, all claimed attachments at once |
| `contentType` | required | optional; omitted means "every attachment with a URL" |

Three facts found during discovery shape the design and remove most of the expected work:

1. The grouped wire contract already exists in the consumed npm packages —
   `VisualizerConnectorRequests.sendGroupedVisualizeData` plus `GroupedAttachmentsData`
   and `AttachmentItem` in `@epam/ai-dial-shared`. Nothing new has to be invented on
   the protocol side, and `VisualizerConnector.send()` accepts any request type.
2. `ConversationView` already computes a per-message effective deployment id
   (`effectiveDeploymentIds[index]`, resolved by scanning `StatusEvent.ModelChanged`
   messages) and passes it to `ConversationMessageItem` as `effectiveDeploymentId`.
   That value *is* legacy's "application id (the chat message model id)", so the
   registry key needs no new plumbing.
3. **MCP Apps already solved the same UI problem in this codebase.** A matched MCP App
   renders as `McpAppInlinePreview` (a `libs/mcp-apps` component: framed, header strip
   with ghost icon buttons, `onExpand` + `expandAriaLabel` props, no host knowledge)
   placed in the assistant bubble's existing `afterContent` slot by
   `ConversationMessageItem`; while that app is open in the canvas, the inline frame is
   replaced by a `role="status"` / `aria-live="polite"` "opened in canvas" placeholder.
   The bubble already receives an app-filtered attachment list
   (`nonReferenceDisplayAttachments`). This change follows that pattern rather than
   inventing a parallel one, which means **no change to `libs/conversation-messages`**.

Constraint that drives most of the boundary decisions: `libs/*` may not read
configuration, env, or app context (AGENTS.md §Library isolation). The registry is
operator configuration, so every lookup, URL resolution, and match decision happens at
the app edge and reaches the libs as plain data.

## Goals / Non-Goals

**Goals:**

- Operator parity with 0.x for the fields that still have meaning in 1.0: an existing
  `APPLICATION_VISUALIZERS` value can be copied over verbatim and keep working.
- One grouped payload, two rendering surfaces (inline bubble + canvas), one iframe
  host component — no second implementation of the handshake.
- Fail-open configuration: a malformed registry degrades to "no application
  visualizers", never a boot failure and never a broken conversation view.
- Dark by default: unset variable means byte-for-byte current behaviour.

**Non-Goals:**

- Auth forwarding to the iframe (`passAuthInfo`, `passExplicitToken`,
  `layout.accessToken`) — see D8.
- Legacy display flags `expanded` / `borderless` / `withoutTitle` — see D8.
- The iframe to chat `SEND_MESSAGE` channel and `ALLOW_VISUALIZER_SEND_MESSAGES` — a
  standing deferred item from the custom-visualizers change, untouched here.
- Porting the connector packages into this monorepo. The migration checklist on
  `VisualizerCanvasRenderer` still stands and still belongs to a separate change.
- An admin UI for editing the registry. It stays an environment variable.

## Decisions

### D1 — Keep the legacy JSON-object shape, keyed by application id

The registry is parsed as a JSON **object** (`{ "<app-id>": { …entry } }`), not
normalised into an array with an `applicationIds` field.

*Why:* the whole point of the change is that an operator can lift their 0.x value
across unchanged. An array shape would be marginally more uniform with
`customVisualizers` but would force every existing deployment to rewrite its
configuration, which is the cost this change exists to avoid. A one-application to
one-visualizer relation is also exactly what an object expresses; the array form would
permit two entries claiming the same application with no defined winner.

*Alternative considered:* array of `{ applicationId, …entry }`. Rejected for the
migration cost above.

### D2 — Matching: deployment id first, then the entry's optional `contentType`

Lookup is a two-step host-side decision, implemented as a pure helper next to
`findVisualizerForMime` — which lives in `libs/attachment-canvas/src/utils/visualizer.ts`,
not in `libs/chat-shared`, so the logic goes there and only the
`ApplicationVisualizer` type sits beside `CustomVisualizer` in `chat-shared`:

1. `applicationVisualizers[effectiveDeploymentId]` — exact string match, no
   normalisation. Deployment ids are opaque identifiers.
2. Given a matched entry, partition the message's attachments:
   - entry has `contentType` — split on `,`, trim, compare case-insensitively against
     each attachment's own `contentType`; matches are *claimed*, the rest are not.
   - entry omits `contentType` — every attachment that has a resolvable URL is
     claimed. Attachments carrying only inline `data` are not, matching legacy's
     wording ("all URL attachments are sent to the iframe").

Claimed attachments become the grouped payload; unclaimed ones keep rendering as the
ordinary `AttachmentGroup` below the visualizer, which is legacy's stated behaviour
("other types, e.g. images, render as normal attachments").

When the partition claims nothing, no inline surface renders at all — the bubble looks
exactly as it does today. This is the empty state; there is no "empty visualizer" box.

### D3 — Application visualizers win over custom visualizers for claimed attachments

If a deployment has an application visualizer *and* an attachment's MIME also matches a
`CUSTOM_VISUALIZERS` entry, the application visualizer claims it: the attachment is
folded into the grouped payload and never renders as a clickable tile, so the
MIME-keyed per-attachment path never sees it. Unclaimed attachments fall through to
today's behaviour unchanged, including opening a custom visualizer on click.

*Why:* the application-scoped binding is the more specific statement of operator
intent — it is chosen per deployment, while the MIME registry is global. The
alternative (MIME wins) would let a global default silently pull an attachment out of a
grouped view the application author designed.

### D4 — One content object, one renderer, two mount points

A new `GroupedVisualizerCanvasContent` variant (`AttachmentContentType.GroupedVisualizer`)
joins the canvas content union, carrying `url`, `visualizerName`, `requestTimeout`,
`layout`, and the `attachments: AttachmentItem[]` array. `VisualizerCanvasRenderer`
selects its request type from the content variant it is handed —
`sendGroupedVisualizeData` with a `GroupedAttachmentsData` body for the grouped
variant, the existing `sendVisualizeData` for the single one — and is otherwise
untouched: same iframe host, same handshake, same loading and error states, same
teardown keyed on `url`/`visualizerName`/`requestTimeout`.

The inline surface therefore mounts the *same* renderer with the *same* content object
the canvas would receive. Expanding to the canvas is "open the panel with this object",
not "rebuild the payload for a different component".

*Alternative considered:* a separate `GroupedVisualizerRenderer`. Rejected — it would
duplicate the handshake, the error UI, and the remount-guard ref for a difference of
one request name and one payload shape.

### D5 — The inline surface mirrors `McpAppInlinePreview` and reuses the existing `afterContent` slot

`libs/attachment-canvas` gains `InlineGroupedVisualizer`, shaped deliberately like
`McpAppInlinePreview`: a framed container that renders `VisualizerCanvasRenderer` at a
caller-supplied height, with a header strip carrying the entry title and an
expand-to-canvas button exposed as `onExpand` + `expandAriaLabel`, plus English default
labels for its loading and error text. It knows nothing about registries, deployments,
config, or the canvas context — it receives content, a height, a callback, and labels.

No change is needed in `libs/conversation-messages`. `AssistantMessageBubble` already
exposes an `afterContent` slot, which is where `ConversationMessageItem` renders
citation groups, stages, and the MCP App preview today. The inline visualizer joins
that composition.

The app wires it in `ConversationMessageItem`: it reads the registry via
`useApplicationVisualizers()`, partitions the message's attachments (D2), resolves each
claimed attachment's absolute URL through the existing
`attachmentCanvasUrlResolvers` / `resolveDialUrl` adapter, builds the content object,
removes the claimed attachments from the `nonReferenceDisplayAttachments` list it
already computes for the bubble's `attachments` prop, and renders
`<InlineGroupedVisualizer …/>` inside `afterContent` with `onExpand` opening the canvas.

*Why this split:* the URL construction and the registry lookup are exactly the
host-owned knowledge AGENTS.md keeps out of libs, while the iframe frame and its
expand affordance are reusable UI with no host knowledge in them. Putting the frame in
the app would duplicate canvas chrome in `apps/chat`; putting the lookup in the lib
would break the boundary. Following the MCP App precedent also means the two inline
surfaces stay visually and behaviourally consistent instead of drifting apart.

*Alternative considered:* a new `attachmentsStartSlot` on `AssistantMessageBubble` so
the visualizer could sit directly above the attachment tray. Rejected — it widens a
lib's public API for a placement difference, while `afterContent` already carries every
other inline surface in the bubble.

### D5a — The inline frame unmounts while the same visualizer is open in the canvas

When the user expands, the inline frame is replaced by a `role="status"` /
`aria-live="polite"` "opened in canvas" placeholder — the same treatment
`ConversationMessageItem` already applies to an MCP App open in the canvas, reusing the
existing `attachmentCanvas.openedInCanvasLabel` string.

*Why:* it keeps exactly one live iframe per visualizer, so the payload is delivered
once and there is no ambiguity about which frame the user is interacting with. It is
not required for correctness — `VisualizerConnector.process` discards any message whose
`event.source` is not its own `iframe.contentWindow`, so two connectors sharing a
`visualizerName` cannot resolve each other's requests — but it avoids a second fetch
and a second handshake, and it matches the established house pattern.

### D6 — Layout numbers are resolved by the app, not branched inside the lib

`width` / `height` / `mobileHeight` travel to the iframe inside
`CustomVisualizerDataLayout` (the visualizer decides what to do with them), and the
host also needs a concrete pixel height for the inline box. The app picks between
`height` and `mobileHeight` with the existing `useIsMobile` hook and passes one
resolved number; `InlineGroupedVisualizer` never reads a breakpoint. Both surfaces send
the same `layout` object, so the iframe cannot tell the two mount points apart unless
it chooses to.

### D7 — Fail-open parsing, mirroring `parseCustomVisualizers`

`EnvConfigProvider` gains `parseApplicationVisualizers`, structurally the sibling of
the existing array parser: unparseable JSON or a non-object (including an array) logs
an error and resolves to `{}`; each value is validated independently through
`plainToInstance` + `validateSync` against `ApplicationVisualizerDto`, so one bad entry
never drops the others; unrecognised keys are warned about and ignored rather than
being a reason to drop an entry (deferred `development`-only fields must not break a
copied-over configuration). `ApplicationVisualizerDto` is `CustomVisualizerDto` with
`contentType` made optional and its "no usable MIME" check applied only when the field
is present.

One addition over the sibling: at parse time the provider also warns when an entry's
origin is absent from `ALLOWED_IFRAME_ORIGINS`. Both values are env, so the check is
free, and a missing origin is the single most likely misconfiguration — the iframe is
blocked by CSP with no error the operator can see in the browser.

### D8 — What is dropped, and why it cannot be ported

- **`passAuthInfo` / `passExplicitToken` / `layout.accessToken`.** In 0.x these worked
  because the access token was placed in the client-visible NextAuth session behind
  `ALLOW_TOKEN_IN_SESSION`. 1.0 auth is server-side (BFF): the browser holds an
  encrypted session cookie and never an access token, and `ALLOW_TOKEN_IN_SESSION` was
  dropped in the migration. There is nothing on the client to forward. The two fields
  are accepted and preserved for schema parity — exactly as `CustomVisualizerDto`
  already does — so a copied configuration is not rejected, and they are documented as
  inert. Wiring them would need a new chat-api endpoint minting a scoped token for a
  named visualizer origin, which is its own change with its own threat model.
- **`expanded` / `borderless` / `withoutTitle`.** These configured legacy's inline
  attachment chrome, whose paired `ATTACHMENT_TYPES_EXPANDED` /
  `ATTACHMENT_TYPES_BORDERLESS` / `ATTACHMENT_TYPES_WITHOUT_TITLE` variables were
  dropped in 1.0 with no successor. The `custom-visualizers` spec already lists them as
  ignored with a warning; this change keeps that treatment rather than reintroducing a
  display-configuration layer that 1.0 deliberately removed.
- **`SEND_MESSAGE` / `ALLOW_VISUALIZER_SEND_MESSAGES`.** Unchanged deferred item.

### D8a — The iframe cannot read DIAL-hosted URLs, and that is a measured limit

The grouped protocol hands the visualizer URLs and expects it to fetch them itself.
For a DIAL-hosted attachment that URL is `/api/v1/files/download`, which needs the
session cookie — and the iframe is a different origin. Verified against a running
`chat-api` (`CORS_ORIGIN=http://localhost:4207`,
`ALLOWED_IFRAME_ORIGINS=http://localhost:4300`):

| Probe | Result |
|---|---|
| `CSP` header on the app document | `frame-src 'self' http://localhost:4300` — the iframe **loads** |
| `OPTIONS /api/v1/files/download` with `Origin: http://localhost:4300` | `204`, `Access-Control-Allow-Origin: http://localhost:4207` — **mismatch, the browser blocks the read** |
| Same preflight with `Origin: http://localhost:4207` | same `Access-Control-Allow-Origin` — only the app's own origin is ever echoed |

`app.enableCors` takes a single origin from `CORS_ORIGIN`; `ALLOWED_IFRAME_ORIGINS`
feeds CSP only and has no part in CORS. So the frame mounts, receives its payload, and
then cannot read a single file out of it.

**Consequence:** a grouped visualizer works only when the attachment URLs are publicly
readable, or when the visualizer is served from the app's own origin. The
single-attachment path avoids the whole problem by fetching host-side and sending bytes
as `data` — a channel the grouped request does not have.

**Legacy 0.x had the same wall, and did not solve it either.** Read from the source
rather than assumed:

- `MessageAttachments.tsx` built each item as `url: getMappedAttachmentUrl(a.url)`, and
  `utils/app/attachments.ts` defines that as
  `isAbsoluteUrl(url) ? url : ` + "`/api/${url}`" + ` — a **host-relative path**. The
  iframe was expected to join it with the `dialHost` its `ChatVisualizerConnector` was
  constructed with.
- `passAuthInfo` only ever added `logInHint` (the user's email) and `providerId`.
- `passExplicitToken` forwarded the **overlay host's** token and, per the connector
  README, "if no overlay token is present (e.g. standalone mode), `accessToken` is
  omitted" — so a standalone deployment forwarded no credential at all.

So auth forwarding answered *who is asking*, never *may this origin read the response*.
The preflight above is rejected before any credential is considered; a token-bearing
fetch from `http://localhost:4300` is blocked identically. Whatever made a 0.x grouped
visualizer work had to be arranged in the deployment — a CORS policy that admitted the
visualizer origin, or files reachable without one — exactly as it must be here.

**Where this change differs from 0.x, deliberately:** it sends an absolute URL where
legacy sent `/api/…`. A relative path posted into a cross-origin iframe resolves
against the *visualizer's* origin, so it is unusable unless the visualizer re-joins it
with `dialHost`. The absolute form is self-describing — but a visualizer carried over
from 0.x that still prefixes `dialHost` itself would double the origin. If operator
parity for already-deployed visualizers matters more than the cleaner contract, the
builder should emit the relative path instead and the README should say the visualizer
must join it with its configured host.

Filtering, by contrast, matches legacy exactly: `if (!a.url) return false` before any
MIME test (a URL is required in both branches), no `contentType` means every attachment
with a URL, and claiming nothing leaves every attachment an ordinary tile. The one
intentional divergence is case-insensitive MIME comparison, where legacy's
`allowedMimeTypes.includes(a.type)` was case-sensitive.

That leaves two real ways out, neither in scope here and both a separate change:

1. **Host-fetched bytes.** The app downloads each claimed attachment (it is same-origin,
   so it may) and puts the content into the payload instead of a URL. No CORS, no
   credential in the iframe. Cost: the published connector's `GroupedAttachmentsData`
   defines `url`/`mimeType`/`visualizerData` and no byte channel, so this is a protocol
   extension to agree with visualizer authors.
2. **Publicly readable URLs.** State the constraint as the operator's and document which
   attachments a grouped visualizer can render. No code.

A scoped token minted per visualizer origin — the obvious third idea — solves nothing on
its own: the request still has to pass CORS first. It would only matter combined with
serving the files from somewhere that allows the visualizer's origin.

### D9 — Streaming and remounts

The grouped payload is built from the attachments currently on the message, and
`VisualizerCanvasRenderer` already reads its payload through a ref so that a changed
`data`/`layout` identity does not tear down the iframe — only `url`, `visualizerName`,
or `requestTimeout` do. While a response streams, attachments append and the payload
object changes identity on each tick without remounting the frame; the grouped send
fires once per mount, after the handshake, with whatever is claimed at that moment.
Re-sending on every streamed attachment is explicitly not attempted here — legacy did
not, and the connector gives no ordering guarantee for overlapping `send()` calls.

## Risks / Trade-offs

- **[CSP blocks the iframe silently]** An entry whose origin is missing from
  `ALLOWED_IFRAME_ORIGINS` renders an empty frame with no browser-visible error —
  mitigated by the parse-time warning naming the entry and the missing origin (D7),
  plus an explicit note in the README and `.env.template` rows.
- **[Visualizer state lost on expand]** Because the inline frame unmounts when the
  canvas opens (D5a), any state the visualizer holds internally — a selected series, a
  zoom level — is lost, and is lost again on collapse. Mitigated only by the fact that
  the grouped payload is re-sent to the new frame, so the visualizer starts from the
  same data; a visualizer that needs to survive the transition would need session
  persistence of its own. This is the same trade-off MCP Apps already accept.
- **[A visualizer that ignores `SEND_GROUPED_VISUALIZE_DATA`]** A third-party app built
  only against the single-attachment request shows an empty frame rather than an error,
  because the request resolves at the protocol level — mitigated only by the request
  timeout, which surfaces the renderer's existing error state; documented as the
  operator's responsibility, since the same was true in 0.x.
- **[Grouped payload size]** Claiming every URL attachment (no `contentType`) on a long
  message posts a large `AttachmentItem[]` through `postMessage` — the payload carries
  URLs and MIME types, not file bytes, so size stays proportional to attachment count;
  no additional cap is introduced.
- **[Two registries, overlapping intent]** Operators now have two visualizer variables
  and must understand which wins — D3 makes the precedence explicit and it is stated in
  both the README rows and the capability spec.

## Migration Plan

1. Ship backend first: the variable, DTO, registry entry, and client-config field are
   additive and inert while unset. Regenerate the OpenAPI client in the same change
   (`npm run openapi`, `npm run openapi:check`).
2. Ship the lib and app surfaces. With an empty registry every new code path is
   unreachable, so the two steps can land together or separately.
3. Operators enable per deployment by setting `APPLICATION_VISUALIZERS` and adding each
   entry's origin to `ALLOWED_IFRAME_ORIGINS`.
4. Rollback is unsetting the variable — no persisted state, no data migration, no
   conversation content depends on it.

## Open Questions

- **Should the inline surface wait for streaming to settle?** The grouped payload is
  sent once per mount (D9), but claimed attachments are also excluded from the tray as
  soon as they arrive. An attachment appended *after* the send is therefore in neither
  place — invisible until the canvas is reopened. Deferring either the surface or the
  exclusion until `isStreaming` clears would close it, at the cost of the visualizer
  appearing only after the response finishes.

- Does any current deployment rely on a grouped visualizer being the *only* thing in
  the bubble (no residual attachment tiles)? Legacy's wording implies unclaimed
  attachments always render, which is what is specified; a deployment that used
  `withoutTitle` / `borderless` to hide chrome will look different from 0.x and there
  is no configuration here to restore that.
- Whether the expand control should be suppressed on mobile, where the canvas panel
  occupies the full viewport and the inline frame is already near full width.
  Specified as present on both breakpoints for now; cheap to revisit after the first
  deployment.
