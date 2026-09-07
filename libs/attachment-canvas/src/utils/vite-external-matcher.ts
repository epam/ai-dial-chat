/**
 * Peer package names that must never be bundled into the built package —
 * every one of them is declared in `package.json#peerDependencies` and is
 * expected to resolve to whatever copy the host app itself already installs.
 */
export const EXTERNAL_PEER_NAMES = [
  'react',
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
  'pdfjs-dist',
] as const;

/**
 * Returns true when `id` is a bare peer package name, or is prefixed by
 * `<peerName>/` (a deep subpath of that peer), for any name in
 * {@link EXTERNAL_PEER_NAMES} — except when `id` ends in `.css`, since a
 * vendor stylesheet subpath must stay locally resolved (via `resolve.alias`)
 * so Vite can process and extract it, rather than being left as an
 * unresolvable raw `import "…css"` statement in the output JS.
 */
export const isExternalPeerImport = (id: string): boolean => {
  if (id.endsWith('.css')) return false;
  return EXTERNAL_PEER_NAMES.some(
    (name) => id === name || id.startsWith(`${name}/`),
  );
};
