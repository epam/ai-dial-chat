## ADDED Requirements

### Requirement: ChatOverlay styles its own elements through an injected stylesheet, not inline styles

`ChatOverlay` SHALL NOT write inline styles onto the root element, the iframe, or the loader for its
own presentation. Instead, its constructor SHALL append a `<style id="dial-overlay-styles">` element
to `document.head` — at most once per document, guarded on that id, so any number of `ChatOverlay`
instances share one stylesheet — and SHALL apply these classes:

| Class                         | Applied to                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `dial-overlay-root`           | The host-provided root element, and only when its computed `position` is `static` or empty. |
| `dial-overlay-iframe`         | The embedded chat iframe (`display: block`, full width/height, no border).                  |
| `dial-overlay-loader`         | The loader element (absolutely positioned over the iframe, centered content).               |
| `dial-overlay-loader--hidden` | The loader once its configured hide event has arrived.                                      |

The stylesheet SHALL use `!important` only on the `dial-overlay-loader--hidden` rule's `display`
declaration, so that hiding the loader cannot be defeated by host CSS or by a `display` entry in
`options.loaderStyles`. Every other declaration SHALL be overridable by host CSS of equal or higher
specificity.

The four class names and both `<style>` element ids SHALL be documented in
`libs/chat-overlay/README.md`, since hosts target them from their own CSS. The enum that declares
them SHALL remain internal to the package — it SHALL NOT be exported from
`libs/chat-overlay/src/index.ts`, because hosts consume these names as CSS strings, not as
TypeScript symbols.

`ChatOverlayManager` SHALL keep injecting its own separate `<style id="dial-overlay-manager-styles">`
element for its `dial-overlay-btn` chrome buttons, and both classes SHALL share one injection helper
rather than duplicating the inject-once logic.

#### Scenario: Overlay elements carry classes and no style attribute

- **WHEN** a `ChatOverlay` is constructed on a root element whose computed `position` is `static`
- **THEN** the root element has class `dial-overlay-root`, the iframe has class `dial-overlay-iframe`,
  and the loader has class `dial-overlay-loader`
- **AND** none of the three has a `style` attribute

#### Scenario: Stylesheet is injected once per document

- **WHEN** two `ChatOverlay` instances are constructed in the same document
- **THEN** `document` contains exactly one element with id `dial-overlay-styles`

#### Scenario: Root positioning class is not applied over existing positioning

- **WHEN** a `ChatOverlay` is constructed on a root element whose computed `position` is `fixed`
- **THEN** the root element does NOT get the `dial-overlay-root` class
- **AND** its existing `position` is left untouched

#### Scenario: Host loaderClass is added alongside the default loader class

- **WHEN** a `ChatOverlay` is constructed with `options.loaderClass` set to `'host-loader'`
- **THEN** the loader element carries both `dial-overlay-loader` and `host-loader`
- **AND** the default class is NOT replaced, so the loader keeps its positioning and centering

#### Scenario: loaderStyles remains the inline escape hatch

- **WHEN** a `ChatOverlay` is constructed with `options.loaderStyles`
- **THEN** those entries are applied as inline styles on the loader and therefore take precedence over
  the injected stylesheet
- **AND** they are the only inline styles the loader carries

## MODIFIED Requirements

### Requirement: Loader visibility follows configured hide event

`ChatOverlay` SHALL render a loader — the default animated SVG, or `options.loaderInnerHTML` if
provided — that stays visible until the event named by `options.loaderHideEvent` occurs; if
`loaderHideEvent` is unset, the loader hides on the app's `READY` event. Hiding SHALL be performed by
adding the `dial-overlay-loader--hidden` class, not by writing an inline `display` value, and SHALL
take effect regardless of host CSS or of a `display` entry in `options.loaderStyles`.

The loader's appearance comes from three layers, in increasing precedence: the injected
`dial-overlay-loader` defaults, then `options.loaderClass` (added alongside the default class, so it
competes with the defaults through the normal cascade rather than replacing them), then
`options.loaderStyles` (inline, always wins).

#### Scenario: Default loader hides on READY

- **WHEN** no `loaderHideEvent` option is provided and the app sends its `READY` event
- **THEN** the loader element gains the `dial-overlay-loader--hidden` class and is hidden

#### Scenario: Custom loaderHideEvent postpones hiding

- **WHEN** `loaderHideEvent` is set to `READY_TO_INTERACT` and only `READY` has been received so far
- **THEN** the loader does NOT yet carry `dial-overlay-loader--hidden` and remains visible until
  `READY_TO_INTERACT` is received
