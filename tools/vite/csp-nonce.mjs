import ts from 'typescript';

/** Replaced per HTML response by chat-api; never use it as a production nonce. */
export const CSP_NONCE_PLACEHOLDER = '__DIAL_CSP_NONCE__';

const isTrustedStyleProducer = (id) => {
  const path = id.split('?')[0].replaceAll('\\', '/');
  return (
    (path.endsWith('.js') &&
      [
        '/node_modules/@silurus/ooxml/dist/',
        '/node_modules/@epam/ai-dial-ui-kit/dist/',
        '/node_modules/@epam/ai-dial-react-file-manager/dist/',
      ].some((packagePath) => path.includes(packagePath))) ||
    path.endsWith('/libs/chat-overlay/src/lib/internal/dom-styles.ts')
  );
};

/**
 * App-owned compatibility adapter for styles inside independently bundled
 * components whose nested runtimes cannot receive a shared global nonce.
 * Only style creation in the vetted source modules is changed. DOM prototypes,
 * inserted HTML, and style elements created by other code remain untouched.
 */
export const addTrustedStyleNonces = (code, id) => {
  if (!isTrustedStyleProducer(id) || !code.includes('createElement'))
    return null;
  const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true);
  const edits = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'createElement' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === 'style'
    ) {
      const document = node.expression.expression.getText(source);
      edits.push({
        start: node.getStart(source),
        end: node.end,
        replacement: `((doc) => Object.assign(doc.createElement('style'), { nonce: doc.querySelector('meta[property="csp-nonce"]')?.nonce ?? '' }))(${document})`,
      });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!edits.length) return null;
  for (const { start, end, replacement } of edits.reverse()) {
    code = code.slice(0, start) + replacement + code.slice(end);
  }
  return code;
};

/** Applies only to application builds; published library artifacts stay host-agnostic. */
export const trustedStyleNoncePlugin = () => ({
  name: 'dial-trusted-style-nonce',
  enforce: 'pre',
  transform(code, id) {
    const transformed = addTrustedStyleNonces(code, id);
    return transformed == null ? null : { code: transformed, map: null };
  },
});
