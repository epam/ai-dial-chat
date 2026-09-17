import type {
  CustomVisualizerData,
  CustomVisualizerDataLayout,
} from './custom-visualizer';

/**
 * A single application → grouped visualizer mapping from the
 * `APPLICATION_VISUALIZERS` registry. Field semantics are fixed by
 * already-deployed visualizer applications and operator configurations
 * carried over from legacy Chat 0.x, which is why `contentType` is optional
 * here while `CustomVisualizer.contentType` is required.
 */
export interface ApplicationVisualizer {
  /**
   * The postMessage protocol namespace, NOT a display label. Every message
   * exchanged with the iframe is prefixed `${title}/…`, and the iframe-side
   * visualizer application must be constructed with this identical string
   * as its `appName`. A mismatch is a silent failure — the iframe loads but
   * never receives data. Also used as the inline frame's header text.
   */
  title: string;
  /** Human-readable description of the visualizer. Accepted for operator-configuration parity; not consumed by host logic. */
  description?: string;
  /** Icon URL or identifier for the visualizer. Accepted for operator-configuration parity; not consumed by host logic. */
  icon?: string;
  /**
   * Comma-separated list of MIME types this entry claims (e.g.
   * `'application/vnd.plotly.v1+json'` or
   * `'application/vnd.plotly.v1+json, application/vnd.vega.v5+json'`).
   * Stored verbatim; splitting happens at lookup time. When omitted, the
   * entry claims every attachment that carries a URL.
   */
  contentType?: string;
  /** Absolute HTTP(S) URL of the visualizer iframe. */
  url: string;
  /** Milliseconds to wait for a `send()` request's `/RESPONSE` before rejecting. Defaults to `10000`. Does NOT bound the initial handshake. */
  requestTimeout?: number;
  /** Suggested initial width of the visualizer surface in pixels. Forwarded as-is in `CustomVisualizerDataLayout`. */
  width?: number;
  /** Suggested initial height of the visualizer surface in pixels. Forwarded as-is in `CustomVisualizerDataLayout`, and used by the host to size the inline frame. */
  height?: number;
  /** Suggested height on mobile viewports in pixels. Forwarded as-is in `CustomVisualizerDataLayout`, and used by the host to size the inline frame on mobile. */
  mobileHeight?: number;
  /** Whether the host should pass auth info to the visualizer. Accepted for operator-configuration parity; inert, because 1.0 auth is server-side and the browser holds no access token. */
  passAuthInfo?: boolean;
  /** Whether the host should pass an explicit access token. Accepted for operator-configuration parity; inert, because 1.0 auth is server-side and the browser holds no access token. */
  passExplicitToken?: boolean;
}

/** The `APPLICATION_VISUALIZERS` registry: application id → grouped visualizer entry. */
export type ApplicationVisualizerRegistry = Record<
  string,
  ApplicationVisualizer
>;

/** A single attachment handed to a grouped visualizer inside `SEND_GROUPED_VISUALIZE_DATA`. */
export interface GroupedAttachmentItem {
  /** Absolute URL of the attachment, resolved by the host before sending. */
  url: string;
  /** The attachment's own MIME type. */
  mimeType: string;
  /** Presentation layout plus the opaque per-attachment payload. */
  visualizerData: CustomVisualizerData;
}

/** Payload of a `SEND_GROUPED_VISUALIZE_DATA` request: every claimed attachment plus the shared presentation layout. */
export interface GroupedAttachmentsData {
  /** One item per claimed attachment, in the message's attachment order. */
  attachments: GroupedAttachmentItem[];
  /** Presentation layout hints shared by every item. */
  layout: CustomVisualizerDataLayout;
}
