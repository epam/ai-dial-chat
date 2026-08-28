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

/*
 * `display: none !important` is deliberate: the loader look is overridable
 * through `loaderClass`/`loaderStyles`, but hiding it once the embedded app is
 * ready must never lose to host CSS or to a `display` entry in `loaderStyles`.
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
  background: #ffffff;
  color: #2764d9;
}
.${OverlayClassName.LoaderHidden} {
  display: none !important;
}
`;

/** Injects the `ChatOverlay` stylesheet into `document.head`, once per document. */
export const ensureOverlayStylesInjected = (): void => {
  injectStyleSheet(STYLE_ELEMENT_ID, OVERLAY_CSS);
};
