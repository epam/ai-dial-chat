## Why

`ChatOverlay` wrote every one of its own styles inline through `setStyles` — `border`/`display`/
`width`/`height` on the iframe, nine declarations on the loader, `position: relative` on the host's
root element, and `display: none` on the loader when it hid. Inline styles are the highest-priority
author-level origin short of `!important`, so a host embedding the overlay could not restyle any of
it without `!important` of its own. `ChatOverlayManager`, in the same package, already solved this
for its chrome buttons with a `<style id="dial-overlay-manager-styles">` element injected once per
document — `ChatOverlay` simply never adopted the pattern.

## What Changes

- `ChatOverlay` injects a `<style id="dial-overlay-styles">` element into `document.head`, once per
  document, and applies classes instead of inline styles: `dial-overlay-root`,
  `dial-overlay-iframe`, `dial-overlay-loader`, `dial-overlay-loader--hidden`.
- `hideLoader()` adds `dial-overlay-loader--hidden` rather than writing `style.display`. That rule
  carries `display: none !important` so hiding cannot lose to host CSS or to a `display` entry in
  `loaderStyles` — the guarantee the inline write used to provide for free.
- **BREAKING (host CSS only, no API change):** `loaderClass` is now added *alongside*
  `dial-overlay-loader` instead of overwriting `className`. Previously the default look was inline
  and therefore unbeatable, so `loaderClass` could only add declarations the defaults did not set;
  now a host class of equal specificity that is declared later in the cascade can override them.
  `loaderStyles` is unchanged and still wins over both.
- The four class names are documented in `libs/chat-overlay/README.md`, making them part of the
  package's public contract.
- `injectStyleSheet(id, css)` moves into `internal/dom-styles.ts` and `ChatOverlayManager` reuses it
  instead of its own copy of the same eight lines.

## Capabilities

### New Capabilities

<!-- none: this change adds no capability -->

### Modified Capabilities

- `chat-overlay-library`: gains a requirement fixing the styling mechanism (injected stylesheet,
  the four public class names, `loaderClass`/`loaderStyles`/stylesheet precedence, and the
  computed-`position` condition on the root class). The loader-visibility requirement is restated
  because hiding is now a class toggle rather than an inline `display` write, and because its
  parenthetical "styled via `options.loaderStyles`/`options.loaderClass`" no longer describes the
  whole styling story.

## Impact

- **Affected lib**: `libs/chat-overlay` only. New `src/lib/internal/overlay-styles.ts`;
  `internal/dom-styles.ts` gains `injectStyleSheet`; `ChatOverlay.ts` and `ChatOverlayManager.ts`
  updated; `README.md` gains a Styling section.
- **Public API**: no TypeScript surface change — no export added, removed, or retyped. The new
  contract is CSS-level: four class names and two `<style>` element ids.
- **Hosts**: a host that relied on `loaderClass` being unable to override the defaults, or that
  matched on the loader's inline `style` attribute, is affected. Both are unlikely; `loaderStyles`
  remains the escape hatch for either.
- **CSP**: the styling moves from the `style-src-attr` bucket (inline `style` attributes) to the
  `style-src-elem` bucket (a `<style>` element). Both already needed `'unsafe-inline'` or a nonce
  under a plain `style-src`, so a host with no `style-src` at all, or one `style-src` covering both,
  is unaffected — and any host using `ChatOverlayManager` already allowed a `<style>` element. Only a
  host that split the directives and allowed attributes but not elements is newly affected
  (see design D4).
- **i18n / a11y / RTL**: nothing user-visible. The stylesheet uses `inset: 0` and no physical-
  direction properties, so RTL behaviour is unchanged.
- **Rollback**: revert the commit; no data, route, protocol, or HTTP contract is touched.

### Alternatives considered

1. **Leave the inline styles** (baseline). Zero risk, but hosts stay unable to restyle the overlay
   and the package keeps two contradictory conventions for the same problem. Rejected.
2. **Ship a real `.css` file from the package.** Cleanest cascade story, but the package is a
   plain-ESM widget consumed by arbitrary host pages, many without a bundler — it would force every
   host into a separate stylesheet import and break the "one import, it works" embed. Rejected.
3. **Constructable stylesheets (`adoptedStyleSheets`).** Avoids the `<style>` element, but needs a
   fallback path anyway for older Safari, and `document.adoptedStyleSheets` is not covered by
   `style-src` in a way that helps. More code, same CSP position. Rejected.
4. **Inject a `<style>` element once per document** (chosen). Matches what `ChatOverlayManager`
   already does in this same package, needs no host build step, and puts the defaults at normal
   author specificity where hosts can beat them.
