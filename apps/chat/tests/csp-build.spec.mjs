import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { addTrustedStyleNonces } from '../../../tools/vite/csp-nonce.mjs';

const vendorPath = '/workspace/node_modules/@silurus/ooxml/dist/viewer.js';

describe('trusted style build adapter', () => {
  it('adds the nonce before insertion and evaluates the document receiver once', () => {
    let documentReads = 0;
    let appended = false;
    const doc = {
      createElement: () => ({}),
      querySelector: () => ({ nonce: 'approved' }),
      head: {
        append: (style) => {
          expect(style.nonce).toBe('approved');
          appended = true;
        },
      },
    };
    const code =
      'const style = getDocument().createElement("style"); doc.head.append(style);';
    runInNewContext(addTrustedStyleNonces(code, vendorPath), {
      doc,
      getDocument: () => {
        documentReads++;
        return doc;
      },
    });
    expect(documentReads).toBe(1);
    expect(appended).toBe(true);
  });

  it('adapts local overlay styles only when bundled by the application', () => {
    expect(
      addTrustedStyleNonces(
        "const style = document.createElement('style');",
        '/workspace/libs/chat-overlay/src/lib/internal/dom-styles.ts',
      ),
    ).toContain('nonce: doc.querySelector');
  });

  it('does not authorize styles from unrelated modules', () => {
    const code = 'document.createElement("style")';
    expect(addTrustedStyleNonces(code, '/workspace/src/unknown.js')).toBeNull();
    expect(
      addTrustedStyleNonces(
        code,
        '/workspace/node_modules/untrusted/viewer.js',
      ),
    ).toBeNull();
  });

  it.each(['@epam/ai-dial-ui-kit', '@epam/ai-dial-react-file-manager'])(
    'covers nested grid runtimes bundled into %s',
    (name) => {
      expect(
        addTrustedStyleNonces(
          'doc.createElement("style")',
          `/workspace/node_modules/${name}/dist/index.js`,
        ),
      ).toContain('nonce: doc.querySelector');
    },
  );

  it('does not modify script creation, inline attributes, comments, or string content', () => {
    const code = `const sample = 'document.createElement("style")';
      // document.createElement('style')
      doc.createElement('script');
      element.setAttribute('style', userValue);`;
    expect(addTrustedStyleNonces(code, vendorPath)).toBeNull();
  });
});
