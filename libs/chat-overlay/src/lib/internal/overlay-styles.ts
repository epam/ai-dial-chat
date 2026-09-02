import { injectStyleSheet } from './dom-styles';

const STYLE_ELEMENT_ID = 'dial-overlay-styles';

/** Class names applied by `ChatOverlay` to the host root, iframe, and loader. */
export enum OverlayClassName {
  /** Positioning context on the host-provided root element. */
  Root = 'dial-overlay-root',
  /** The embedded chat iframe. */
  Iframe = 'dial-overlay-iframe',
  /** The loader shown until the configured hide event arrives. */
  Loader = 'dial-overlay-loader',
  /** Hidden state of the loader. */
  LoaderHidden = 'dial-overlay-loader--hidden',
}

/**
 * Custom properties the injected stylesheet reads, each with a literal
 * fallback. This lib deliberately ships no CSS file and no `--cs-*` theming
 * channel, so these are the supported way for a host to retheme the loader
 * palette without an `!important` fight against the injected source order.
 */
export enum OverlayCssVariable {
  /** Loader backdrop. Defaults to `#ffffff`. */
  LoaderBackground = '--dial-overlay-loader-background',
  /** Loader foreground, inherited by the spinner's `currentColor` stroke. Defaults to `#2764d9`. */
  LoaderColor = '--dial-overlay-loader-color',
}

/*
 * Every declaration below is a look a host may override — except the hidden
 * state. `display: none !important` is deliberate there: hiding the loader once
 * the embedded app is ready is a state change, not styling, so it must not lose
 * to `loaderClass` host CSS that happens to sit later in the cascade. The one
 * layer an author `!important` cannot outrank is an inline declaration that is
 * itself `!important`, so `ChatOverlay.hideLoader()` additionally clears any
 * inline `display` the host set through the `loaderStyles` escape hatch.
 */
const OVERLAY_CSS = `
.${OverlayClassName.Root} {
  position: relative;
}
.${OverlayClassName.Iframe} {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}
.${OverlayClassName.Loader} {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: var(${OverlayCssVariable.LoaderBackground}, #ffffff);
  color: var(${OverlayCssVariable.LoaderColor}, #2764d9);
}
.${OverlayClassName.LoaderHidden} {
  display: none !important;
}
`;

/** Injects the `ChatOverlay` stylesheet into `document.head`, once per document. */
export const ensureOverlayStylesInjected = (): void => {
  injectStyleSheet(STYLE_ELEMENT_ID, OVERLAY_CSS);
};
