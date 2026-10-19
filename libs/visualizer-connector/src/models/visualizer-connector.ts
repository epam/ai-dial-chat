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

/** Shape of every message exchanged with the visualizer iframe. */
export interface VisualizerConnectorRequest {
  /** `${visualizerName}/${request or event}`, with `/RESPONSE` appended on replies. */
  type: string;
  /** Correlates a reply with its request; absent on unsolicited events. */
  requestId?: string;
  /** Request, reply, or event payload. */
  payload?: unknown;
}
