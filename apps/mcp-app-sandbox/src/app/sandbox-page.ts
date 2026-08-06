/**
 * Builds the self-contained MCP Apps sandbox-proxy HTML document.
 *
 * Adapted from `modelcontextprotocol/ext-apps`'s reference implementation
 * (`examples/basic-host/{sandbox.html,src/sandbox.ts}`), with one deliberate
 * change: the reference validates `document.referrer` client-side against a
 * hardcoded regex; this embeds the *server-validated* host origin directly
 * (see `SandboxController`), so the page trusts only what `chat-api`'s own
 * Referer check already confirmed, not a value the browser supplies.
 *
 * There is no `?csp=`-driven Permissions-Policy `allow` attribute here (see
 * `mcp-app-sandbox-proxy` spec) — DIAL Core's MCP Apps Phase 1 never
 * surfaces a tool-declared permissions payload, so the inner iframe's
 * `sandbox` attribute is the only thing the relay negotiates.
 */
export const buildSandboxPageHtml = (expectedHostOrigin: string): string => {
  const escapedOrigin = JSON.stringify(expectedHostOrigin);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light dark" />
    <title>MCP Apps Sandbox</title>
    <style>
      html, body { margin: 0; height: 100vh; width: 100vw; background-color: transparent; }
      body { display: flex; flex-direction: column; }
      * { box-sizing: border-box; }
      iframe { background-color: transparent; border: 0 none transparent; padding: 0; overflow: hidden; flex-grow: 1; color-scheme: inherit; }
    </style>
  </head>
  <body>
    <script>
      (function () {
        if (window.self === window.top) {
          throw new Error('This page is only to be used in an iframe sandbox.');
        }

        var EXPECTED_HOST_ORIGIN = ${escapedOrigin};
        var OWN_ORIGIN = window.location.origin;

        // Self-test: confirms the browser actually enforced the outer
        // iframe's own sandbox isolation. Must throw a SecurityError.
        try {
          window.top.alert('If you see this, the sandbox is not set up securely.');
          throw 'FAIL';
        } catch (e) {
          if (e === 'FAIL') {
            throw new Error('The sandbox is not set up securely.');
          }
        }

        var inner = document.createElement('iframe');
        inner.style.width = '100%';
        inner.style.height = '100%';
        inner.style.border = 'none';
        inner.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        document.body.appendChild(inner);

        var RESOURCE_READY = 'ui/notifications/sandbox-resource-ready';
        var PROXY_READY = 'ui/notifications/sandbox-proxy-ready';

        window.addEventListener('message', function (event) {
          if (event.source === window.parent) {
            if (event.origin !== EXPECTED_HOST_ORIGIN) {
              return;
            }
            if (event.data && event.data.method === RESOURCE_READY) {
              var params = event.data.params || {};
              if (typeof params.sandbox === 'string') {
                inner.setAttribute('sandbox', params.sandbox);
              }
              if (typeof params.html === 'string') {
                var doc = inner.contentDocument || (inner.contentWindow && inner.contentWindow.document);
                if (doc) {
                  doc.open();
                  doc.write(params.html);
                  doc.close();
                } else {
                  inner.srcdoc = params.html;
                }
              }
            } else if (inner.contentWindow) {
              inner.contentWindow.postMessage(event.data, '*');
            }
          } else if (event.source === inner.contentWindow) {
            if (event.origin !== OWN_ORIGIN) {
              return;
            }
            window.parent.postMessage(event.data, EXPECTED_HOST_ORIGIN);
          }
        });

        window.parent.postMessage(
          { jsonrpc: '2.0', method: PROXY_READY, params: {} },
          EXPECTED_HOST_ORIGIN,
        );
      })();
    </script>
  </body>
</html>
`;
};
