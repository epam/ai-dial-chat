/**
 * `postMessage` type `HtmlContent` sends to the document at
 * `HtmlCanvasContent.srcdocHostUrl` once it loads. The message is
 * `{ type: HTML_PREVIEW_FRAME_RENDER_MESSAGE, html: string }`; the host
 * document is expected to accept it only from its parent window and replace
 * itself with `html` (e.g. via `document.write`).
 */
export const HTML_PREVIEW_FRAME_RENDER_MESSAGE = 'dial-html-preview:render';
