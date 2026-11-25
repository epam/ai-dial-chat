/**
 * Responses whose body must reach the browser byte for byte: proxied DIAL
 * Core files keep the upstream `Content-Type` and `Content-Length`, so a
 * `.json` file would otherwise look like a JSON API response to the
 * compression filter and be re-encoded without its size header.
 */
const passthroughResponses = new WeakSet<object>();

/** Marks `response` so the BFF's response compression leaves its body as it is. Call before the first byte is written. */
export const skipResponseCompression = (response: object): void => {
  passthroughResponses.add(response);
};

/** Whether {@link skipResponseCompression} marked `response`. */
export const isResponseCompressionSkipped = (response: object): boolean =>
  passthroughResponses.has(response);
