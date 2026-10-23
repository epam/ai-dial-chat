import type { AppsEditorMessages } from '../types/visualizer-connector';

/** CSS declarations applied inline to the built-in loader overlay. */
export type VisualizerConnectorLoaderStyles = {
  [property in keyof CSSStyleDeclaration]?: string;
};

/** Options for a `VisualizerConnector` instance. */
export interface VisualizerConnectorOptions {
  /** Visualizer URL loaded into the iframe; also the `targetOrigin` of every posted request. */
  domain: string;
  /**
   * Ignored. Kept so callers written against npm `0.48.0`, where it was
   * required, still type-check.
   * @deprecated Do not pass; the connector never reads it.
   */
  hostDomain?: string;
  /** Protocol namespace prefixed to every message; must equal the iframe-side `appName`. */
  visualizerName: string;
  /** Inline styles merged over the loader overlay defaults. */
  loaderStyles?: VisualizerConnectorLoaderStyles;
  /** Class name set on the loader overlay. */
  loaderClass?: string;
  /** HTML set as the loader overlay's content. Defaults to a spinner SVG. */
  loaderInnerHTML?: string;
  /** Milliseconds a `send()` waits for its `/RESPONSE`. Defaults to `10000`. Does not bound `ready()`. */
  requestTimeout?: number;
}

/** Payload of `SEND_VISUALIZE_DATA`, as `ChatVisualizerConnector` hands it to `onData`. */
export interface VisualizerAttachmentData {
  /** MIME type of the attachment being visualized. Absent when Chat 0.x's application editor sends only a layout. */
  mimeType?: string;
  /** Presentation layout plus the opaque per-attachment payload. */
  visualizerData: Record<string, unknown>;
}

/** One attachment inside a `SEND_GROUPED_VISUALIZE_DATA` payload. */
export interface VisualizerGroupedAttachmentItem extends VisualizerAttachmentData {
  /** The attachment's own MIME type; always present for a grouped item. */
  mimeType: string;
  /** Absolute URL of the attachment, resolved by the host. */
  url: string;
}

/** Payload of `SEND_GROUPED_VISUALIZE_DATA`, as `ChatVisualizerConnector` hands it to `onGroupedData`. */
export interface VisualizerGroupedAttachmentsData {
  /** One item per attachment the visualizer claims, in message order. */
  attachments: VisualizerGroupedAttachmentItem[];
  /** Presentation layout hints shared by every item. */
  layout: Record<string, unknown>;
}

/**
 * An unprefixed legacy application-editor message with application-defined fields.
 * @deprecated Use `AppsEditorHostMessage` / `AppsEditorClientMessage` with the dedicated editor connectors.
 */
export interface AppsEditorMessage {
  /** The message, as posted, with no `${applicationName}/` prefix. */
  type: AppsEditorMessages;
  /** Nested fields, for the messages that carry them there. */
  payload?: unknown;
  /** Top-level fields, for the messages that carry them there. */
  [field: string]: unknown;
}

/** Callbacks a `ChatVisualizerConnector` invokes with the data the host sends. */
export interface ChatVisualizerCallbacks {
  /** Single-attachment data (`CUSTOM_VISUALIZERS`). */
  onData?: (data: VisualizerAttachmentData) => void;
  /** Grouped attachments data (`APPLICATION_VISUALIZERS`). */
  onGroupedData?: (data: VisualizerGroupedAttachmentsData) => void;
  /** An application-editor message from an allowed host, such as `TRIGGER_SAVE`, with the sender's origin. */
  onEditorMessage?: (message: AppsEditorMessage, origin: string) => void;
}

/** Shape of every message exchanged with the visualizer iframe. */
export interface VisualizerConnectorRequest {
  /** `${visualizerName}/${request or event}`, with `/RESPONSE` appended on replies. */
  type: string;
  /** Correlates a reply with its request; absent on unsolicited events. */
  requestId?: string;
  /** Request, reply, or event payload. */
  payload?: unknown;
}
