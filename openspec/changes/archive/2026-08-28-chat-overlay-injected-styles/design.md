## Context

`libs/chat-overlay` is a publishable, framework-free widget package. Two classes in it styled DOM
they own, by two different mechanisms:

| Class                | Mechanism (before)                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatOverlayManager` | `<style id="dial-overlay-manager-styles">` injected once per document for `.dial-overlay-btn`, plus `setStyles` for the genuinely dynamic layout (`width`/`height`/`zIndex`/position) |
| `ChatOverlay`        | `setStyles` for everything — iframe box, loader box, root `position`, loader hide                                                                     |

Everything `ChatOverlay` set inline is static: it does not vary with options, viewport, or state.
The one dynamic input, `options.loaderStyles`, is a host-supplied `Record<string, string>` and is
inherently inline. So the whole of `ChatOverlay`'s own styling could move to a stylesheet without
losing anything, which is what this change does.

Constraints that shaped the result:

- The package ships as a single ESM entry with no CSS asset and no build step on the host side.
  Hosts embed it with one `import`; that must keep working.
- `openspec/specs/chat-overlay-library/spec.md` already requires the loader to hide on
  `loaderHideEvent` (default `READY`). The hide must stay unconditional in practice, whatever host
  CSS is on the page.
- `libs/*` isolation rules apply: no i18n, no app knowledge. CSS class names and a `<style>` element
  are host-agnostic, so nothing here approaches that boundary.

## Goals / Non-Goals

**Goals:**

- Remove every inline style `ChatOverlay` writes for itself.
- Let hosts restyle the overlay's iframe and loader with ordinary CSS, no `!important` needed.
- Keep loader hiding unconditional.
- Have one style-injection helper in the package rather than two copies.
- Keep `loaderClass`, `loaderStyles`, `loaderInnerHTML`, and `loaderHideEvent` working as documented.

**Non-Goals:**

- Converting `ChatOverlayManager`'s container/header/body styling. Most of it is dynamic
  (`width`/`height`/`zIndex`/corner/mobile layout) and would need CSS custom properties, not plain
  classes — a separate change with a real design question in it.
- Theming tokens, CSS custom properties, or a `*Colors` prop surface for the overlay.
- Shipping a `.css` file from the package (see D2).
- Any change to the `postMessage` protocol, the v1 method surface, or the iframe `sandbox`/`allow`
  attributes.

## Decisions

### D1 — Inject one `<style>` element per document, keyed by id

`ensureOverlayStylesInjected()` calls `injectStyleSheet('dial-overlay-styles', css)`, which returns
early when `document.getElementById(id)` already resolves. It is called from the `ChatOverlay`
constructor, so N overlays on a page produce one stylesheet.

Alternative — inject at module load: rejected. The package is imported in SSR and test contexts
where `document` may not exist at import time; a constructor already implies a DOM.

Alternative — one stylesheet per overlay instance: rejected. Identical CSS repeated per instance, and
cleanup on `destroy()` would have to reference-count for no benefit.

### D2 — A `<style>` element, not a shipped `.css` file

A stylesheet asset is the cleaner cascade story, but it would require every host to import a second
entry point. Hosts embedding this package are arbitrary third-party pages, many with no bundler at
all — the migration guide's whole selling point is a single import. `ChatOverlayManager` had already
made this call for its buttons; matching it keeps one convention in the package instead of two.

### D3 — `display: none !important` on the hidden-loader class, and nowhere else

The inline `style.display = 'none'` this replaces was unbeatable by construction. A plain class is
not: a host rule of equal specificity declared later wins, and a `display` entry in `loaderStyles` —
an inline style — always wins. Since a loader that fails to hide covers the entire chat, the hidden
modifier keeps `!important`.

Nothing else in the stylesheet uses `!important`: the visible-state declarations are exactly what
hosts are now meant to be able to override.

Alternative — keep writing `style.display` inline just for hiding: rejected, it reintroduces the
thing this change removes and leaves the loader's `style` attribute mutating at runtime.

Alternative — no `!important`, rely on source order: rejected. Injection order relative to host
stylesheets is not controllable, and `loaderStyles` would silently defeat hiding.

### D4 — CSP posture is a lateral move, and it is documented

Inline `style` attributes fall under `style-src-attr`; a `<style>` element falls under
`style-src-elem`. Both fall back to `style-src`. A host with no CSP, or with a single `style-src`
allowing inline, is unaffected either way, and any host already using `ChatOverlayManager` was
already receiving an injected `<style>` element. The only newly-affected host is one that split the
two directives and allowed attributes but not elements — rare enough to document rather than design
around. Should a host hit it, the fix on their side is a nonce or `style-src-elem 'unsafe-inline'`;
the package does not attempt nonce plumbing, since there is no host-agnostic way to obtain one.

### D5 — `loaderClass` becomes additive

`loader.className = options.loaderClass` overwrote the class attribute. With a default class to
preserve, the options were: put the host class first, put it last, or keep overwriting and lose the
defaults entirely. Chosen: `[OverlayClassName.Loader, options.loaderClass].filter(Boolean).join(' ')`.

Class-attribute order does not affect specificity, so this does not by itself decide who wins — the
cascade does. What it does guarantee is that the loader always keeps its positioning/centering
defaults, which is what the previous inline behaviour effectively guaranteed too. The observable
delta is that a host class can now beat a default declaration where before inline styles made that
impossible; that is the point of the change, and `loaderStyles` remains available for hosts that want
the old "nothing can override me" behaviour.

### D6 — Class names are a public contract, so they are documented and enumerated

The four names live in an `OverlayClassName` string enum (repo convention: string enums over union
literals for named finite sets) and are listed in the lib README with what each attaches to. They are
deliberately `dial-overlay-`-prefixed to match the existing `dial-overlay-btn` and to make collision
with host classes implausible.

The enum is **not** exported from `src/index.ts`. Hosts write these names in CSS, not TypeScript, so
a public export would widen the API surface with no call site — the repo's libs rule against
exporting symbols nothing imports.

### D7 — Root gets the positioning class only when its computed `position` is `static`

Unchanged logic, new mechanism: the constructor still reads
`window.getComputedStyle(this.root).position` and only acts when it is `static` or empty. It adds
`dial-overlay-root` where it used to write `position: relative` inline.

Note the asymmetry this keeps: `destroy()` does not remove the class, exactly as it never removed the
inline `position: relative`. Leaving a class on a host element after teardown is untidy, but changing
it here would be an unrequested behaviour change on a host-owned element — flagged for a follow-up
rather than folded in.

### D8 — `injectStyleSheet` lives in `internal/dom-styles.ts`

That module was already the package's one styling utility (`setStyles`). Putting the injector beside
it keeps both style mechanisms in one place, and lets `ChatOverlayManager` drop its duplicated
eight-line injection block. The CSS strings stay with their owners — `MANAGER_CSS` in
`ChatOverlayManager.ts`, `OVERLAY_CSS` in `internal/overlay-styles.ts` — so neither class reaches
into the other's presentation.

## Risks / Trade-offs

- **A host stylesheet accidentally matches `dial-overlay-*` and breaks the overlay.** → The prefix
  makes collision implausible, and the names are documented so a host can see what to avoid.
- **A host's `loaderClass` now overrides a default it previously could not, changing the loader's
  appearance on upgrade.** → Called out as breaking in the proposal and in the README's Styling
  section; `loaderStyles` restores unbeatable precedence.
- **Loader fails to hide because of host CSS.** → `!important` on the hidden modifier (D3), covered by
  the two existing loader-visibility scenarios, now asserted through the class rather than the inline
  `display`.
- **A host with split `style-src-attr`/`style-src-elem` directives loses the styles entirely.** → D4:
  documented, not designed around. Failure mode is cosmetic (unstyled iframe/loader), not a broken
  handshake.
- **Someone later adds a dynamic value to `OVERLAY_CSS`.** → It is a module-level constant with no
  interpolation of runtime data; dynamic values belong in `setStyles` or, if the need is real, in a
  CSS-custom-property channel added deliberately.
- **`nx test` for this project cannot verify the change.** → Pre-existing and unrelated: all three
  suites fail to load under `nx test @epam/ai-dial-chat-overlay` on a clean `development`
  (`Cannot read properties of undefined (reading 'config')`). Verified by running `vitest` directly in
  the lib — 81/81 pass. The nx-vitest wiring break is out of scope here and left unfixed.

## Migration Plan

No host action required for hosts that do not style the overlay. For hosts that do:

1. If you passed `loaderClass` and relied on it _not_ overriding the built-in loader look, check the
   loader after upgrading; move any declaration you need to win into `loaderStyles`.
2. If you matched the loader or iframe on their `style` attribute, switch to the documented classes.
3. If your CSP sets `style-src-elem` without `'unsafe-inline'`, add a nonce or allow inline style
   elements.

Rollback is reverting the commit — no persisted state, protocol field, or HTTP contract is involved.

## Open Questions

- Should `destroy()` remove `dial-overlay-root` from the host root (D7)? Today it leaks, as the inline
  style did before it. Fixing it is a two-line change plus a flag on the entry, but it is a behaviour
  change on a host-owned element and belongs to whoever owns the teardown semantics.
- Should the same treatment be applied to `ChatOverlayManager`'s container/header/body? It needs CSS
  custom properties for `width`/`height`/`zIndex`/corner, so it is a design decision, not a mechanical
  port. Deliberately out of scope (Non-Goals).
