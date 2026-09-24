/** Public entry-point peer sets for isolated packed consumers. */

/*
 * `@epam/ai-dial-chat-api-client` appears in no list below: this package ships
 * it as a `dependency`, because its conversation entry imports a runtime enum
 * from it. `@epam/ai-dial-quotations` stays an optional peer and now appears
 * only in the three rows whose entry really imports it — the conversation
 * stream's annotation normalizer moved to `@epam/ai-dial-chat-shared`, which
 * every one of these fixtures installs anyway
 * ([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719)).
 */

/** The dependency-light entry with zero peers beyond `react`. */
export const MINIMAL_FIXTURE = {
  name: 'minimal',
  subpath: 'viewport-layout',
  peers: [],
};

/*
 * `@epam/ai-dial-ui-kit@0.14.0-dev.51` moved its editor stack from required
 * peers to optional ones, but its published root entry still reaches all
 * three by name, so an installing consumer still has to provide them
 * ([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719)):
 *
 *  - the runtime root entry re-exports `LazyDialJsonEditor`, whose dynamic
 *    import target does `import { Editor } from '@monaco-editor/react'`, and
 *    a bundler has to resolve a dynamic import target to chunk it;
 *  - the declaration root entry reaches `JsonEditor.d.ts`,
 *    `MarkdownEditor.d.ts` and `types/editor.d.ts`, which import
 *    `@monaco-editor/react`, `monaco-editor` and `@uiw/react-md-editor` by
 *    name — unresolvable to `tsc`, which these fixtures deliberately run
 *    with `skipLibCheck: false`, when the optional peer is absent.
 *
 * An optional peer reachable from the root entry is a kit-side bug; until
 * the kit confines these to its `./editors` boundary, every fixture that
 * installs the kit installs them too, at the ranges the kit asks for.
 */
export const UI_KIT_EDITOR_PEERS = [
  '@monaco-editor/react',
  'monaco-editor',
  '@uiw/react-md-editor',
];

/*
 * What a consumer still has to install itself once it pulls in
 * `@epam/ai-dial-chat-shared` — which every entry below does through a root
 * re-export, and a re-export has to *resolve* before unused features are
 * tree-shaken.
 *
 * Two families are deliberately absent, and their absence is the assertion —
 * a fixture that installed them anyway could not tell a working contract from
 * a broken one:
 *
 *  - the markdown stack (`react-markdown`, `remark-*`, `rehype-*`, `katex`,
 *    `react-syntax-highlighter`, `@tabler/icons-react`), which
 *    `@epam/ai-dial-chat-shared` ships as dependencies;
 *  - `@epam/ai-dial-react-file-manager` and `ag-grid-community`, which used to
 *    be here because the root entry re-exported the two grid-rendering
 *    components. They now live behind that package's `./file-manager` entry
 *    ([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719)), so the
 *    root closure no longer reaches the grid and only the `file-manager`
 *    fixture below names the pair.
 */
export const CHAT_SHARED_ROOT_PEERS = [
  '@epam/ai-dial-ui-kit',
  ...UI_KIT_EDITOR_PEERS,
];

/** Every published subpath, with its complete documented direct peer set. */
export const SUBPATH_FIXTURES = [
  MINIMAL_FIXTURE,
  { name: 'scroll-anchoring', subpath: 'scroll-anchoring', peers: [] },
  {
    name: 'conversation',
    subpath: 'conversation',
    /*
     * `@epam/ai-dial-chat-overlay` is deliberately absent: the overlay
     * protocol mapper moved to `./conversation-overlay` below, so a host
     * importing this entry for ordinary chat behavior never has to install
     * that optional peer
     * ([issue #8855](https://github.com/epam/ai-dial-chat/issues/8855)).
     */
    peers: [
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-publish-panel',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'conversation-overlay',
    subpath: 'conversation-overlay',
    peers: [
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-chat-overlay',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'conversation-transfer',
    subpath: 'conversation-transfer',
    peers: ['@epam/ai-dial-chat-shared', ...CHAT_SHARED_ROOT_PEERS],
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
    /*
     * The one fixture that names the grid pair: this entry is where
     * `@epam/ai-dial-chat-shared/file-manager` — and so
     * `@epam/ai-dial-react-file-manager` with its `ag-grid-community` peer —
     * enters the closure.
     *
     * The canvas trio (`@epam/ai-dial-attachment-canvas`,
     * `@epam/ai-dial-quotations` and the `@epam/pdf-highlighter-kit` its
     * highlight types reach) is deliberately absent: the canvas content
     * resolvers moved to `./file-manager-canvas` below, so browsing, upload
     * and naming helpers no longer require them
     * ([issue #8855](https://github.com/epam/ai-dial-chat/issues/8855)).
     *
     * `@epam/ai-dial-attachment-input` was added for `useFileAttachmentPicker`,
     * whose row-eligibility predicate calls its `isMimeTypeAllowed` directly.
     */
    peers: [
      '@epam/ai-dial-react-file-manager',
      'ag-grid-community',
      '@epam/ai-dial-attachment-input',
      '@epam/ai-dial-ui-kit',
      '@epam/ai-dial-chat-shared',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'file-manager-canvas',
    subpath: 'file-manager-canvas',
    peers: [
      '@epam/ai-dial-attachment-canvas',
      '@epam/ai-dial-quotations',
      '@epam/pdf-highlighter-kit',
      '@epam/ai-dial-chat-shared',
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'skills-state',
    subpath: 'skills-state',
    peers: [],
  },
  {
    name: 'catalog',
    subpath: 'catalog',
    peers: [
      '@epam/ai-dial-catalog',
      '@epam/ai-dial-chat-shared',
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
      ...CHAT_SHARED_ROOT_PEERS,
    ],
  },
  {
    name: 'oauth',
    subpath: 'oauth',
    peers: ['@epam/ai-dial-chat-shared', ...CHAT_SHARED_ROOT_PEERS],
  },
  {
    name: 'scheduled-tasks',
    subpath: 'scheduled-tasks',
    peers: ['@epam/ai-dial-scheduled-tasks', ...CHAT_SHARED_ROOT_PEERS],
  },
  {
    name: 'sharing',
    subpath: 'sharing',
    /*
     * useShareLink.ts compares against ShareLinkResponseDtoAccessEnum, so
     * chat-api-client is needed at runtime — this package ships it as a
     * dependency, which is why the fixture no longer installs it.
     */
    peers: ['@epam/ai-dial-share', ...CHAT_SHARED_ROOT_PEERS],
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
    peers: ['@epam/ai-dial-chat-shared', ...CHAT_SHARED_ROOT_PEERS],
  },
  {
    name: 'usage',
    subpath: 'usage',
    peers: [
      '@epam/ai-dial-usage-dashboard',
      '@epam/ai-dial-chat-shared',
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
  '@epam/ai-dial-chat-overlay',
  '@epam/ai-dial-chat-shared',
  '@epam/ai-dial-mcp-apps',
  '@epam/ai-dial-publish-panel',
  '@epam/ai-dial-quotations',
  '@epam/ai-dial-react-file-manager',
  '@epam/ai-dial-scheduled-tasks',
  '@epam/ai-dial-share',
  '@epam/ai-dial-skill-editor',
  '@epam/ai-dial-source-panel',
  '@epam/ai-dial-ui-kit',
  '@epam/ai-dial-usage-dashboard',
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
 * `@epam/ai-dial-chat-shared` — which, since `@epam/ai-dial-chat-api-client`
 * became a dependency of this package, leaves nothing to install at all. The
 * build then has exactly one genuinely missing direct peer and must name that
 * package literally.
 */
export const NEGATIVE_FIXTURE = {
  name: 'negative-oauth',
  subpath: 'oauth',
  peers: [],
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
  { fixtureName: 'file-manager-canvas', mustContain: ['LRUCache'] },
];

export const SIDE_EFFECT_SYMBOLS = ['new EventTarget()', 'LRUCache'];
