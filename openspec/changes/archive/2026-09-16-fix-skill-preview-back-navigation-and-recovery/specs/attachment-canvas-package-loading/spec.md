## MODIFIED Requirements

### Requirement: PDF-only CSS loads separately from the base stylesheet

Vendor CSS required only by the PDF preview feature (the styles `PdfContent` imports for `@epam/ai-dial-react-pdf-highlighter` and `@epam/pdf-highlighter-kit`) SHALL be emitted in a build output file distinct from the package's base stylesheet, and SHALL load only when the PDF feature's own lazy chunk loads. Importing the package root and its base stylesheet, then rendering any non-PDF and non-highlighted-code attachment, SHALL NOT cause the PDF vendor CSS to be requested.

Loading that CSS late SHALL NOT let it outrank the consuming application's own styles. Because it is injected after the host's stylesheet, any rule in it that is not scoped to the PDF preview's own class names would win on document order at equal specificity — including the plain utility class names and the CSS reset that `@epam/ai-dial-react-pdf-highlighter`'s published stylesheet currently carries. The PDF vendor CSS SHALL therefore be loaded so that it cannot override a host rule of equal specificity, while remaining sufficient to style the PDF preview itself. Satisfying the separate-file and lazy-load rules above by means of a stylesheet that outranks host styles SHALL NOT be considered satisfying this requirement. The containment mechanism and the guarantees the host can rely on are specified by `attachment-preview-style-containment`.

#### Scenario: Rendering a non-PDF attachment after importing the base stylesheet

- **WHEN** a consumer imports the package root and `./styles.css`, then renders an image, text, JSON, markdown, HTML, or OOXML attachment
- **THEN** no PDF-vendor stylesheet is requested by the browser

#### Scenario: Opening a PDF attachment loads its CSS alongside its JS chunk

- **WHEN** an attachment resolves to `AttachmentContentType.Pdf` for the first time
- **THEN** the PDF-only stylesheet loads at the same time as the PDF feature's dynamically imported JS chunk, with no flash of unstyled PDF UI

#### Scenario: The lazily loaded PDF CSS does not outrank host styles

- **WHEN** a consumer's own stylesheet and the PDF vendor stylesheet define a rule for the same selector at the same specificity, and the PDF vendor stylesheet is injected later
- **THEN** the consumer's rule still wins

#### Scenario: The PDF preview is still fully styled

- **WHEN** a PDF attachment renders after its CSS has loaded under the containment mechanism
- **THEN** the viewer, its page canvases, thumbnails, and highlight layers are styled as they are without containment
