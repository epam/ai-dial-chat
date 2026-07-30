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

/** Full `SEND_VISUALIZE_DATA` request payload. */
export interface AttachmentData {
  /** MIME type of the attachment being visualized. */
  mimeType: string;
  /** Layout hints plus the opaque attachment payload. */
  visualizerData: CustomVisualizerData;
}

/** A single attachment entry inside a `SEND_GROUPED_VISUALIZE_DATA` payload. */
export interface AttachmentItem {
  /** URL of the attachment resource. */
  url: string;
  /** MIME type of the attachment. */
  mimeType: string;
  /** Layout hints plus opaque payload for this specific attachment. */
  visualizerData: CustomVisualizerData;
}

/** Full `SEND_GROUPED_VISUALIZE_DATA` request payload for application-level visualizers. */
export interface GroupedAttachmentsData {
  /** Ordered list of attachments to render together. */
  attachments: AttachmentItem[];
  /** Shared layout hints applied to the whole group. */
  layout: CustomVisualizerDataLayout;
}

/** Options accepted by the host-side `VisualizerConnector` constructor. */
export interface VisualizerConnectorOptions {
  /** URL of the visualizer application to load in the iframe. */
  domain: string;
  /**
   * Wire-format namespace prefix used on every outbound and inbound message
   * (`${visualizerName}/…`). Must equal the iframe-side application's
   * `appName` or no messages will be recognized on either side.
   */
  visualizerName: string;
  /** Milliseconds to wait for a `send()` request's `/RESPONSE` before rejecting. Defaults to `10000`. Does NOT bound `ready()`. */
  requestTimeout?: number;
  /** CSS styles applied to the built-in loader overlay element while the iframe is not yet ready. */
  loaderStyles?: Record<string, string>;
  /** CSS class(es) applied to the built-in loader overlay element. */
  loaderClass?: string;
  /** HTML string set as the `innerHTML` of the built-in loader overlay element. */
  loaderInnerHTML?: string;
}

/** Wire envelope for every message exchanged between host and visualizer iframe. */
export interface VisualizerConnectorRequest {
  /** Full wire type string, `${visualizerName}/${eventOrRequestName}` (or `.../RESPONSE`). */
  type: string;
  /** Present on request/response envelopes; absent on unsolicited event envelopes. */
  requestId?: string;
  /** Envelope-specific payload. */
  payload?: unknown;
}
