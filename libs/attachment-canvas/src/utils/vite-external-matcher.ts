/**
 * Package names that must never be bundled into the built package — each is
 * declared in `package.json` as either a peer (resolved to the copy the host
 * app already installs) or a dependency (npm installs it alongside this
 * package), and either way the import stays external so consumers get one
 * shared copy rather than a second one inlined here.
 */
export const EXTERNAL_PACKAGE_NAMES = [
  'react',
  '@silurus/ooxml',
  '@epam/ai-dial-chat-shared',
  '@epam/ai-dial-shared',
  '@epam/ai-dial-sidebar',
  '@epam/ai-dial-ui-kit',
  '@epam/ai-dial-visualizer-connector',
  '@tabler/icons-react',
  'react-json-view-lite',
  '@epam/ai-dial-react-pdf-highlighter',
  '@epam/pdf-highlighter-kit',
  'react-syntax-highlighter',
  '@mcp-ui/client',
  '@modelcontextprotocol/sdk',
  '@modelcontextprotocol/ext-apps',
  'pdfjs-dist',
] as const;

/**
 * Returns true when `id` is a bare runtime package name, or is prefixed by
 * `<packageName>/` (a deep subpath of that package), for any name in
 * {@link EXTERNAL_PACKAGE_NAMES} — except when `id` ends in `.css`, since a
 * vendor stylesheet subpath must stay locally resolved (via `resolve.alias`)
 * so Vite can process and extract it, rather than being left as an
 * unresolvable raw `import "…css"` statement in the output JS.
 */
export const isExternalPackageImport = (id: string): boolean => {
  if (id.endsWith('.css')) return false;
  return EXTERNAL_PACKAGE_NAMES.some(
    (name) => id === name || id.startsWith(`${name}/`),
  );
};
