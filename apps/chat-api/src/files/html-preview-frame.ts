/**
 * `postMessage` type the embedding app sends to hand the preview frame the
 * HTML to render. Must stay in sync with `HTML_PREVIEW_FRAME_RENDER_MESSAGE`
 * in `@epam/ai-dial-attachment-canvas` — `tests/html-preview-frame.spec.ts`
 * fails when they diverge.
 */
export const HTML_PREVIEW_FRAME_RENDER_MESSAGE = 'dial-html-preview:render';

/**
 * Static bootstrap document for previewing HTML that has no file URL (an
 * attachment carried inline as `data`, or other in-memory content).
 *
 * Rendering such HTML through `srcdoc` makes the frame inherit the chat
 * shell's enforced CSP, which refuses its inline `<style>`/`<script>`. This
 * document is instead loaded via `src=`, so it carries its own response-level
 * policy (`createHtmlPreviewCspHeader`, including `sandbox allow-scripts`).
 * It waits for exactly one render message from its parent window and then
 * replaces itself with that HTML via `document.write`, which keeps the same
 * document — and therefore the same relaxed, sandboxed CSP — rather than
 * navigating to a new one.
 */
export const HTML_PREVIEW_FRAME_DOCUMENT = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function () {
  var onMessage = function (event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (data == null || data.type !== '${HTML_PREVIEW_FRAME_RENDER_MESSAGE}' || typeof data.html !== 'string') return;
    window.removeEventListener('message', onMessage);
    document.open();
    document.write(data.html);
    document.close();
  };
  window.addEventListener('message', onMessage);
})();
</script>
</body>
</html>
`;
