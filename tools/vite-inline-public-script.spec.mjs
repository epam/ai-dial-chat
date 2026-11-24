import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inlinePublicScript } from './vite/inline-public-script.mjs';

const HTML =
  '<head><script src="/theme-init.js"></script><script type="module" src="/src/main.tsx"></script></head>';

describe('inlinePublicScript', () => {
  it('replaces the external script with its source and drops the leading comment', () => {
    const html = inlinePublicScript(
      HTML,
      'theme-init.js',
      '/*\n * Docs.\n */\n(() => { paint(); })();\n',
    );

    assert.equal(
      html,
      '<head><script>(() => { paint(); })();</script><script type="module" src="/src/main.tsx"></script></head>',
    );
  });

  it('keeps dollar sequences in the source literally', () => {
    const html = inlinePublicScript(HTML, 'theme-init.js', "x = '$&$`$\\'';");

    assert.ok(html.includes("<script>x = '$&$`$\\'';</script>"));
  });

  it('throws when index.html does not load the script', () => {
    assert.throws(
      () => inlinePublicScript('<head></head>', 'theme-init.js', 'x();'),
      /has no <script src="\/theme-init.js"><\/script>/,
    );
  });

  it('throws when the source would close the script element', () => {
    assert.throws(
      () => inlinePublicScript(HTML, 'theme-init.js', "s = '</script>';"),
      /contains "<\/script"/,
    );
  });
});
