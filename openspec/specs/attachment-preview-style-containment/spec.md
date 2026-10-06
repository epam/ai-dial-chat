# attachment-preview-style-containment Specification

## Purpose
Specifies how vendor CSS pulled in by a lazily loaded attachment-preview engine is kept from altering layout or typography outside the preview surface, and states exactly what of that guarantee is verified today. A preview engine's stylesheet is injected when its chunk loads, after the application's own, and is never unloaded; when that stylesheet carries a CSS reset or duplicates the application's utility class names, it wins on document order at equal specificity and the damage lasts for the session. Today the PDF engine (`PdfContent` in `libs/attachment-canvas`) is the one engine whose vendor CSS is contained; this capability records that mechanism, the build assertion that guards it on the library's own build output, and the verification that has not been done.

## Requirements

### Requirement: The PDF engine's vendor CSS is loaded inside the `pdf-vendor` cascade layer

`PdfContent` (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx`) SHALL pull in its vendor stylesheets only through `libs/attachment-canvas/src/components/PdfContent/pdf-vendor.css`, which imports `@epam/ai-dial-react-pdf-highlighter/styles.css` and `@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css` with `@import … layer(pdf-vendor)`. Because unlayered author styles outrank every layered rule regardless of document order, the vendor sheet's Preflight reset and its base utilities that duplicate the host's (`.hidden`, `.flex`, …) SHALL NOT outrank an unlayered application rule of equal specificity — including a breakpoint variant such as `@media (min-width:1280px) { .desktop\:block { display: block } }` that overrides a base utility — while the vendor's own `.pdf-*` / `.highlight-*` rules, which no host rule competes for, stay in effect.

The containment SHALL NOT be achieved by loading the vendor CSS eagerly at application start — `attachment-canvas-package-loading` requires it to stay out of the initial load — nor by a page reload, a timer, or a reset of application state after the fact. The library's base stylesheet (`dist/index.css`) SHALL NOT carry the vendor payload.

Only the PDF engine is covered. Other stylesheets the canvas imports (for example `react-json-view-lite/dist/index.css` in `AttachmentCanvasBody.tsx`) are not layered and are outside this requirement.

#### Scenario: A vendor CSS reset is confined to the layer
- **WHEN** the library is built and `dist/PdfContent.css` is inspected
- **THEN** Tailwind Preflight's opening rule (`border:0 solid`) appears only inside the single `@layer pdf-vendor{…}` block

#### Scenario: Duplicated utility class names are confined to the layer
- **WHEN** `dist/PdfContent.css` is inspected
- **THEN** the host-colliding `.hidden{display:none}` appears inside the `pdf-vendor` layer and nowhere outside it, and the only rule outside the layer is the library's own CSS-module rule for `.pdf-container`

#### Scenario: Containment does not move the vendor CSS into the initial load
- **WHEN** the library's base stylesheet `dist/index.css` is inspected
- **THEN** it contains neither `@layer pdf-vendor` nor Preflight's `border:0 solid`

### Requirement: Containment verification is a library-build assertion; application-level behaviour is a known gap

The cascade is not evaluated by the jsdom environment the project's unit tests run in, so a passing unit test SHALL NOT be treated as evidence of containment. The enforced verification SHALL be `libs/attachment-canvas/tests/package-boundary/pdf-vendor-style-containment.spec.ts`, which reads the library's own build output (`libs/attachment-canvas/dist/PdfContent.css` and `dist/index.css`; the lib's `test` target depends on `build`) and asserts the layer shape described above. Verification results SHALL be reported as what they are: build assertion, mocked test, isolated browser check, or application-level check.

What is not verified today SHALL be reported as not verified rather than implied by the build assertion:

- **Application-build containment** — that the layer survives the `apps/chat` build (`apps/chat/dist/assets/PdfContent-*.css`) and that `index.html` links no `PdfContent-*.css` was checked once by hand in the archived change `2026-09-16-fix-skill-preview-back-navigation-and-recovery` (`notes.md`), but no test asserts it.
- **Application-level computed styles** — no recorded browser check of computed styles before and after the engine loads in the running application, at desktop and mobile widths, in light and dark themes (that change's task 5.5 is open). The only browser evidence is an isolated Chromium check outside the application, recorded once in that change's `notes.md` (desktop Files panel / header actions at 1440px: `block`/`flex` before the vendor sheet, `none`/`none` with it unlayered, `block`/`flex` with it inside `@layer pdf-vendor`; 768px unaffected).
- **The PDF viewer's own styling** — that the viewer (document render, thumbnails, highlights, toolbar) is undamaged by layering, now that Preflight sits below all unlayered author styles, is not verified at application level in either theme or layout (task 5.6 is open).
- **Navigation across routes** — that every other route renders unchanged after a preview engine loads is not verified in a browser.

#### Scenario: Library build output carries the containment mechanism
- **WHEN** `pdf-vendor-style-containment.spec.ts` runs after the `attachment-canvas` build
- **THEN** it asserts that `dist/PdfContent.css` contains exactly one `@layer pdf-vendor{` block of non-trivial size and that `dist/index.css` contains none of the vendor payload

#### Scenario: Unverified claims are reported as gaps
- **WHEN** this capability's verification status is reported
- **THEN** application-build containment, application-level computed styles at both widths and themes, the PDF viewer's own styling, and cross-route layout are each stated as not verified, and the build assertion is not presented as covering them

#### Scenario: Unit tests are not reported as browser verification
- **WHEN** the change's verification is reported
- **THEN** each result states whether it came from a build assertion, a mocked test, an isolated browser check, or an application-level check, and the cascade claim is supported only by the build assertion and the isolated browser check
