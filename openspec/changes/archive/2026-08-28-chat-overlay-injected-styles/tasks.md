**As built:** this change was implemented in one slice, in `libs/chat-overlay` only, and is committed
as `ec7378b41` on branch `refactor/chat-overlay-injected-styles`. Every task below is done; the
verification notes record what actually ran.

## 1. Style-injection plumbing

- [x] 1.1 Add `injectStyleSheet(id, css)` to `libs/chat-overlay/src/lib/internal/dom-styles.ts` —
      appends a `<style>` with that id to `document.head`, returning early when the id already exists
      (design **D1**, **D8**). `setStyles` stays, for host-supplied `loaderStyles` only.
- [x] 1.2 Add `libs/chat-overlay/src/lib/internal/overlay-styles.ts` with the `OverlayClassName`
      string enum (`Root`, `Iframe`, `Loader`, `LoaderHidden`), the `OVERLAY_CSS` constant, and
      `ensureOverlayStylesInjected()`. `!important` appears on the hidden-loader `display` only, with
      a comment stating why (design **D3**). Do NOT export the enum from `src/index.ts` (**D6**).
- [x] 1.3 Replace `ChatOverlayManager`'s inline copy of the inject-once logic with a call to
      `injectStyleSheet(STYLE_ELEMENT_ID, MANAGER_CSS)`, leaving its CSS string and its own dynamic
      `setStyles` layout calls untouched (**D8**, Non-Goals).

## 2. ChatOverlay class-based styling

- [x] 2.1 Call `ensureOverlayStylesInjected()` from the `ChatOverlay` constructor, before the iframe
      and loader are created.
- [x] 2.2 Replace the iframe's `setStyles` call with `iframe.className = OverlayClassName.Iframe`.
- [x] 2.3 Replace the loader's `setStyles` defaults with
      `[OverlayClassName.Loader, options.loaderClass].filter(Boolean).join(' ')`, so `loaderClass` is
      additive rather than overwriting `className` (**D5**). Keep the `options.loaderStyles`
      `setStyles` call as the inline escape hatch, applied after the class assignment.
- [x] 2.4 Replace `setStyles(this.root, { position: 'relative' })` with
      `this.root.classList.add(OverlayClassName.Root)`, keeping the existing
      `window.getComputedStyle(...).position` guard exactly as it was (**D7**).
- [x] 2.5 Change `hideLoader()` to add `OverlayClassName.LoaderHidden` instead of writing
      `style.display`.

## 3. Tests

- [x] 3.1 Replace the inline-style assertions in `ChatOverlay.spec.ts` (`root.style.position`,
      `loader.style.position/inset/display`, `iframe.style.display/height`) with class assertions plus
      an assertion that none of the three elements has a `style` attribute.
- [x] 3.2 Add a test that two overlays in one document produce exactly one `#dial-overlay-styles`
      element.
- [x] 3.3 Add a test that a host `loaderClass` sits alongside `dial-overlay-loader` rather than
      replacing it.
- [x] 3.4 Convert both loader-visibility tests to assert the `dial-overlay-loader--hidden` class
      instead of `style.display === 'none'`, keeping the two existing spec scenarios covered.
- [x] 3.5 Keep the non-static-root test, now asserting the class is absent and `position: fixed`
      survives.

## 4. Documentation

- [x] 4.1 Add a **Styling** section to `libs/chat-overlay/README.md`: the injected `<style>` ids, a
      table of the four class names and what each attaches to, the
      stylesheet → `loaderClass` → `loaderStyles` precedence order, and the manager's separate sheet.
- [x] 4.2 Correct the `loaderStyles` and `loaderClass` rows in the README's options table —
      `loaderClass` is now "added alongside `dial-overlay-loader`", not "applied to the loader
      element".

## 5. Verification

- [x] 5.1 `vitest run` in `libs/chat-overlay` — 81/81 pass.
      **Note:** `npm exec nx test @epam/ai-dial-chat-overlay` cannot be used to verify this change.
      All three suites fail to load with `Cannot read properties of undefined (reading 'config')` on a
      clean `development` checkout, before this change — confirmed by stashing. The nx-vitest wiring
      break is pre-existing, out of scope, and left unfixed (design **Risks**).
- [x] 5.2 `npm exec nx lint @epam/ai-dial-chat-overlay` — clean.
- [x] 5.3 `npm exec nx build @epam/ai-dial-chat-overlay` — succeeds, `dist/index.js` emitted with
      declarations.
- [x] 5.4 `npm run validate:docs` — passes (40 markdown files).
