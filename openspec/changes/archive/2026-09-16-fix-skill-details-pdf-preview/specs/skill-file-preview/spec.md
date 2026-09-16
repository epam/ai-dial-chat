## ADDED Requirements

### Requirement: Skill Builder's PDF preview uses the host's own PDF worker

The shared `SkillFilePreview` component SHALL pass the application-owned
`configurePdfWorker` from `apps/chat/src/utils/pdf.ts` to
`AttachmentCanvasBody`. That component
(`apps/chat/src/components/SkillFilePreview/SkillFilePreview.tsx`) is what the
Skill Editor mounts in `libs/skill-editor`'s `supportingFileContent` slot.

Today it passes no such prop. `PdfContent` therefore initialises its
preparation state to `Ready`, mounts `DocumentPreview` with no gate, and
leaves in place the `workerSrc` that `@epam/pdf-highlighter-kit` assigns at
module-evaluation time —
`https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs`, applied under
an `if (!workerSrc)` guard in its `core/pdf-engine.js`. Selecting a PDF
supporting file in Skill Builder consequently depends on outbound access to
that CDN, or on the page-level chat attachment canvas having already run the
app's initializer in the same page session. Since the app's initializer
assigns `workerSrc` unconditionally and runs after the vendor module has
evaluated, passing the prop is sufficient to take ownership of the value.

The initializer SHALL stay at the application edge:
`@epam/ai-dial-attachment-canvas` receives it only as an injected callback,
and `apps/chat/src/utils/pdf.ts` is unchanged — its `pdfjs-dist` imports stay
dynamic, so the package remains out of the eager bundle and is fetched only on
the first real PDF open.

Because both `apps/chat/src/utils/pdf.ts` and `PdfContent` memoise their
preparation promises at module scope, the initializer runs at most once per
successful resolution across Skill Builder, skill details, and the chat
canvas combined. Its module-level identity is stable, so `PdfContent`'s
preparation effect SHALL NOT re-run on re-render.

#### Scenario: Selecting a PDF supporting file in Skill Builder configures the app's worker

- **WHEN** a user selects a PDF supporting file in the Skill Editor's Files tree on a freshly loaded page
- **THEN** the app's `configurePdfWorker` is invoked before `DocumentPreview` mounts, `GlobalWorkerOptions.workerSrc` points at the app's bundled worker asset, and the vendor's CDN URL is not relied upon

#### Scenario: The preview does not depend on the chat canvas running first

- **WHEN** the user goes straight to the Skill Editor after a page reload, without opening any chat attachment
- **THEN** the PDF preview behaves identically to one opened after a chat PDF — there is no ordering dependency between the two surfaces

#### Scenario: The initializer runs once across surfaces

- **WHEN** a PDF is previewed in Skill Builder and then another PDF is opened in skill details or the chat canvas within the same page session
- **THEN** `configurePdfWorker` is not invoked a second time, and the later previews mount without repeating worker preparation

#### Scenario: A worker preparation failure is retryable and distinct from a content failure

- **WHEN** `configurePdfWorker` rejects while a Skill Builder PDF preview is opening
- **THEN** `PdfContent`'s own retryable preparation-error state renders rather than the canvas load-error state, and a later preview or an explicit retry invokes the initializer again

#### Scenario: Every other supporting-file type is unchanged

- **WHEN** a Markdown, JSON, code, HTML, image, audio, visualizer, or unsupported supporting file is selected in the Skill Editor
- **THEN** it renders exactly as before, through the same renderers and labels, and `configurePdfWorker` is never invoked

#### Scenario: Existing lifecycle guarantees still hold

- **WHEN** the user switches selection between supporting files, removes the previewed file, replaces its bytes, or leaves the Skill Editor route
- **THEN** the preview replacement, close, refresh, out-of-order-resolution, and cleanup behaviour already specified for this capability is unchanged
