/**
 * A single MIME → visualizer mapping from the `CUSTOM_VISUALIZERS` registry.
 * Field semantics are fixed by already-deployed visualizer applications and
 * operator configurations — see `design.md` D9/D10 in the
 * `add-custom-visualizers` change for why `title` is required and
 * `contentType` accepts a comma-separated list.
 */
export interface CustomVisualizer {
  /**
   * The postMessage protocol namespace, NOT a display label. Every message
   * exchanged with the iframe is prefixed `${title}/…`, and the iframe-side
   * visualizer application must be constructed with this identical string
   * as its `appName`. A mismatch is a silent failure — the iframe loads but
   * never receives data.
   */
  title: string;
  /** Human-readable description of the visualizer (kept for parity with the development schema; not consumed by host UI). */
  description?: string;
  /** Icon URL or identifier for the visualizer (kept for parity with the development schema; not consumed by host UI). */
  icon?: string;
  /**
   * Comma-separated list of one or more MIME types this entry matches (e.g.
   * `'application/vnd.plotly.v1+json'` or
   * `'application/vnd.plotly.v1+json, application/vnd.vega.v5+json'`).
   * Stored verbatim; splitting happens at lookup time.
   */
  contentType: string;
  /** Absolute HTTP(S) URL of the visualizer iframe. */
  url: string;
  /** Milliseconds to wait for a `send()` request's `/RESPONSE` before rejecting. Defaults to `10000`. Does NOT bound the initial handshake. */
  requestTimeout?: number;
  /** Suggested initial width of the canvas panel in pixels. Forwarded as-is in `CustomVisualizerDataLayout`. */
  width?: number;
  /** Suggested initial height of the canvas panel in pixels. Forwarded as-is in `CustomVisualizerDataLayout`. */
  height?: number;
  /** Suggested canvas panel height on mobile viewports in pixels. Forwarded as-is in `CustomVisualizerDataLayout`. */
  mobileHeight?: number;
  /** Whether the host should pass auth info to the visualizer. Accepted for schema parity with development but auth forwarding is not yet wired. */
  passAuthInfo?: boolean;
  /** Whether the host should pass an explicit access token. Accepted for schema parity with development but auth forwarding is not yet wired. */
  passExplicitToken?: boolean;
}

/** Presentation-only layout hints forwarded to the visualizer inside `SEND_VISUALIZE_DATA`. */
export interface CustomVisualizerDataLayout {
  /** Suggested width of the canvas panel in pixels (from the registry entry). */
  width?: number;
  /** Suggested height of the canvas panel in pixels (from the registry entry). */
  height?: number;
  /** Suggested height on mobile-sized screens in pixels (from the registry entry). */
  mobileHeight?: number;
  /** Id of the host's currently active theme. */
  themeId: string;
}

/** Payload of a `SEND_VISUALIZE_DATA` request: presentation layout plus the opaque attachment payload. */
export interface CustomVisualizerData {
  /** Presentation layout hints. */
  layout: CustomVisualizerDataLayout;
  /** Opaque attachment payload consumed by the third-party visualizer. */
  [key: string]: unknown;
}
