## MODIFIED Requirements

### Requirement: Attachment-opening hook exported from the package root

`@epam/ai-dial-attachment-canvas` SHALL export a hook that, given a `DisplayAttachment`
(from `@epam/ai-dial-chat-shared`) and an optional caller-scoped
`canvasAttachmentId`, decides whether and how to open the attachment canvas,
using only injected content resolvers, an injected `resolveContentUrl`
callback, an injected `customVisualizers` list, an optional `themeId`, and an
optional `onBeforeOpen` callback — never an application React context. The
hook SHALL return `{ openAttachmentCanvas: (attachment, canvasAttachmentId?,
shouldCommit?) => Promise<boolean> }`, resolving `true` when the canvas was
opened and `false` when the attachment could not be previewed or when the
request was not permitted to commit.

The hook writes canvas state itself — a loading state synchronously, then
content or a close once an awaited resolver settles — so a caller cannot undo
a completion that arrives once its request is no longer the one the caller
wants displayed. The optional third argument `shouldCommit: () => boolean`
(exported as `ShouldCommitCanvas`) SHALL therefore be consulted by the hook
immediately before **each** canvas write that follows an awaited resolver, and
SHALL NOT be consulted only once at call time. When it returns `false` the hook
SHALL write no canvas state, SHALL release a resolved payload's object URL
(the canvas revokes only what it actually held), SHALL NOT close the canvas,
and SHALL resolve `false`. Omitting the argument SHALL commit every request,
preserving the behavior of callers that do not pass one.

The hook SHALL NOT cancel the underlying I/O: suppressing a stale request's
effect on shared state is the guarantee, and cancellation of a host's resolvers
is not required to provide it.

#### Scenario: Consumer supplies resolvers instead of the hook reading contexts

- **WHEN** a host calls the exported hook with its own
  `resolveImageContent`/`resolveTextContent`/`resolveMarkdownContent`/
  `resolveCodeContent`/`resolveHtmlContent`/`resolvePdfContent`/
  `resolveOoxmlContent`/`resolveJsonContent`/`resolveVisualizerContent`/
  `resolveReferencePdfContent`/`resolveContentUrl`/`hasTextSource` callbacks
  and a `customVisualizers` array
- **THEN** the hook never imports or reads any React context, and every
  content decision is made by calling the supplied resolver for the matched
  content type

#### Scenario: Panel coordination is delegated to the host

- **WHEN** the hook is about to open the canvas for an image, file, pasted,
  or prompt attachment
- **THEN** it calls the supplied `onBeforeOpen` callback (if provided) before
  opening the canvas, and does not call it for an audio attachment

#### Scenario: A request that may no longer commit writes no canvas state

- **WHEN** a caller passes a `shouldCommit` that returns `false` by the time the
  resolver settles
- **THEN** no content is written to the canvas, the open resolves `false`, and
  the canvas keeps whatever it was displaying

#### Scenario: A request that may no longer commit does not close another owner's canvas

- **WHEN** a request whose `shouldCommit` returns `false` resolves no content at
  all (the attachment could not be previewed)
- **THEN** the canvas is not closed, so a canvas opened in the meantime by
  another caller is left intact

#### Scenario: A discarded payload's object URL is released

- **WHEN** a resolver produces content carrying an object URL and the commit is
  discarded because `shouldCommit` returned `false`
- **THEN** that object URL is revoked, because the canvas never held it and so
  will never revoke it itself

#### Scenario: The guard is evaluated at the commit boundary

- **WHEN** a caller's `shouldCommit` returns `true` when `openAttachmentCanvas`
  is called and `false` by the time the resolver settles
- **THEN** the result is discarded, because the guard is consulted before the
  write rather than when the request starts

#### Scenario: Omitting the guard preserves existing behavior

- **WHEN** a caller passes no `shouldCommit` argument
- **THEN** every resolved request commits exactly as it did before the argument
  existed
