/** Public entry-point peer sets for isolated packed consumers. */

/** The dependency-light entry with zero peers beyond `react`. */
export const MINIMAL_FIXTURE = {
  name: 'minimal',
  subpath: 'viewport-layout',
  peers: [],
};

/** Root re-exports require these peers to resolve before unused features are tree-shaken. */
export const CHAT_SHARED_ROOT_PEERS = [
  '@tabler/icons-react',
  'react-syntax-highlighter',
  'react-markdown',
  'remark-breaks',
  'remark-gfm',
  'remark-math',
  'rehype-katex',
  'rehype-raw',
  'rehype-sanitize',
  'katex',
  '@epam/ai-dial-ui-kit',
  '@epam/ai-dial-react-file-manager',
  'ag-grid-community',
];

/** Every published subpath, with its complete documented direct peer set. */
export const SUBPATH_FIXTURES = [
  MINIMAL_FIXTURE,
  { name: 'scroll-anchoring', subpath: 'scroll-anchoring', peers: [] },
  {
    name: 'conversation',
    subpath: 'conversation',
    peers: [
      '@epam/ai-dial-chat-api-client',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-quotations',
      '@epam/ai-dial-publish-panel',
      '@epam/ai-dial-chat-overlay',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'conversation-transfer',
    subpath: 'conversation-transfer',
    peers: [
      '@epam/ai-dial-chat-api-client',
      '@epam/ai-dial-chat-shared',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'conversation-sources',
    subpath: 'conversation-sources',
    peers: [
      '@epam/ai-dial-source-panel',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-quotations',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'file-manager',
    subpath: 'file-manager',
    peers: [
      '@epam/ai-dial-react-file-manager',
      '@epam/ai-dial-ui-kit',
      '@epam/ai-dial-chat-api-client',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-attachment-canvas',
      '@epam/ai-dial-quotations',
      '@epam/pdf-highlighter-kit',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'skills-state',
    subpath: 'skills-state',
    peers: ['@epam/ai-dial-chat-api-client'],
  },
  {
    name: 'catalog',
    subpath: 'catalog',
    peers: [
      '@epam/ai-dial-catalog',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-chat-api-client',
      '@epam/ai-dial-attachment-input',
      '@epam/ai-dial-publish-panel',
      /*
       * useCatalogItemDetails.ts imports skill.ts, whose SkillFileNodeKind
       * value requires this peer at runtime.
       */
      '@epam/ai-dial-skill-editor',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'skill-editor',
    subpath: 'skill-editor',
    peers: [
      '@epam/ai-dial-skill-editor',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-ui-kit',
      '@epam/ai-dial-chat-api-client',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'oauth',
    subpath: 'oauth',
    peers: [
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-chat-api-client',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'scheduled-tasks',
    subpath: 'scheduled-tasks',
    peers: [
      '@epam/ai-dial-scheduled-tasks',
      '@epam/ai-dial-chat-api-client',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'sharing',
    subpath: 'sharing',
    /*
     * useShareLink.ts compares against ShareLinkResponseDtoAccessEnum,
     * so chat-api-client is a runtime dependency.
     */
    peers: [
      '@epam/ai-dial-share',
      '@epam/ai-dial-chat-api-client',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'attachments',
    subpath: 'attachments',
    peers: [
      '@epam/ai-dial-quotations',
      '@epam/ai-dial-attachment-input',
      '@epam/ai-dial-attachment-canvas',
      '@epam/ai-dial-chat-shared',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'utils',
    subpath: 'utils',
    peers: [
      '@epam/ai-dial-chat-api-client',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-deployment-creation-form',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
];

/**
 * Every optional peer `package.json#peerDependencies` lists (excluding
 * `react`), plus `CHAT_SHARED_ROOT_PEERS` — the root entry re-exports
 * `@epam/ai-dial-chat-shared`, which itself transitively needs its own full
 * peer set (see `CHAT_SHARED_ROOT_PEERS`'s doc comment).
 *
 * `@epam/ai-dial-mcp-apps` was missing from this list (a pre-existing gap,
 * unrelated to chat-shared, confirmed by `legacy-root`'s own
 * `MISSING_EXPORT` failure for `computeMcpAppSeedKey`/`collectToolCallNames`
 * before it was added here) — the root entry's `./mcp-apps`-derived exports
 * need it installed too.
 */
export const ALL_OPTIONAL_PEERS = [
  '@epam/ai-dial-attachment-canvas',
  '@epam/ai-dial-attachment-input',
  '@epam/ai-dial-catalog',
  '@epam/ai-dial-chat-api-client',
  '@epam/ai-dial-chat-overlay',
  '@epam/ai-dial-chat-shared',
  '@epam/ai-dial-deployment-creation-form',
  '@epam/ai-dial-mcp-apps',
  '@epam/ai-dial-publish-panel',
  '@epam/ai-dial-quotations',
  '@epam/ai-dial-react-file-manager',
  '@epam/ai-dial-scheduled-tasks',
  '@epam/ai-dial-share',
  '@epam/ai-dial-skill-editor',
  '@epam/ai-dial-source-panel',
  '@epam/ai-dial-ui-kit',
  '@epam/pdf-highlighter-kit',
  ...CHAT_SHARED_ROOT_PEERS,
];

/** Installs the root entry's optional peers and imports its public exports. */
export const LEGACY_ROOT_FIXTURE = {
  name: 'legacy-root',
  subpath: '.',
  peers: ALL_OPTIONAL_PEERS,
};

/**
 * Installs every documented `./oauth` peer except
 * `@epam/ai-dial-chat-shared`, so the build has exactly one genuinely
 * missing direct peer and must name that package literally.
 */
export const NEGATIVE_FIXTURE = {
  name: 'negative-oauth',
  subpath: 'oauth',
  peers: ['@epam/ai-dial-chat-api-client'],
  expectFailure: true,
  failureMustName: '@epam/ai-dial-chat-shared',
};

/**
 * Side-effect content checks: the minimal fixture's bundle must
 * contain neither marker; the named heavy fixture's bundle must contain its
 * own, proving `sideEffects` is respected rather than stripped.
 *
 * Neither marker is the source identifier name — `toolsetLoginEventTarget`
 * and the two `blobCache`/`textCache` locals are local bindings that this
 * package's own production build (a Vite/Rolldown build, same as every
 * fixture's rebundle) already renames to single letters, so grepping for
 * the declared name would never match a real, successful build:
 * - `new EventTarget()`: the singleton's constructor CALL survives
 *   unchanged — `EventTarget` is a global constructor reference, and a
 *   bundler renames local *declarations*, never references to a global.
 * - `LRUCache`: the bundled `lru-cache` class sets
 *   `[Symbol.toStringTag] = "LRUCache"` as a string literal on itself,
 *   which — unlike the class's own (anonymous, minified) local binding —
 *   survives bundling unchanged and proves the implementation is present.
 */
export const SIDE_EFFECT_CHECKS = [
  { fixtureName: 'oauth', mustContain: ['new EventTarget()'] },
  { fixtureName: 'file-manager', mustContain: ['LRUCache'] },
];

export const SIDE_EFFECT_SYMBOLS = ['new EventTarget()', 'LRUCache'];
