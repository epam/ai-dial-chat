/**
 * Fixture table for the packed-package consumer tests (design.md D5, tasks.md
 * §6). Each entry's `peers` list is copied from both peer columns in
 * design.md's dependency matrix — runtime and type-only packages are equally
 * required for a strict consumer typecheck — not re-derived here, so a drift
 * between this file and the matrix is a review
 * question, not a silent divergence.
 */

/** The dependency-light entry with zero peers beyond `react` (task 6.2). */
export const MINIMAL_FIXTURE = {
  name: 'minimal',
  subpath: 'viewport-layout',
  peers: [],
};

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
    ],
  },
  {
    name: 'conversation-transfer',
    subpath: 'conversation-transfer',
    peers: ['@epam/ai-dial-chat-api-client', '@epam/ai-dial-chat-shared'],
  },
  {
    name: 'conversation-sources',
    subpath: 'conversation-sources',
    peers: [
      '@epam/ai-dial-source-panel',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-quotations',
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
      // Runtime, not type-only — see design.md's task-6 correction:
      // useCatalogItemDetails.ts pulls in skill.ts's SKILL_MANIFEST_FILE
      // constant, and skill.ts itself uses SkillFileNodeKind as a value.
      '@epam/ai-dial-skill-editor',
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
    ],
  },
  {
    name: 'oauth',
    subpath: 'oauth',
    peers: ['@epam/ai-dial-chat-shared', '@epam/ai-dial-chat-api-client'],
  },
  {
    name: 'scheduled-tasks',
    subpath: 'scheduled-tasks',
    peers: ['@epam/ai-dial-scheduled-tasks', '@epam/ai-dial-chat-api-client'],
  },
  {
    name: 'sharing',
    subpath: 'sharing',
    // '@epam/ai-dial-chat-api-client' is runtime, not type-only — see
    // design.md's task-6 correction: useShareLink.ts compares against
    // ShareLinkResponseDtoAccessEnum's real value.
    peers: ['@epam/ai-dial-share', '@epam/ai-dial-chat-api-client'],
  },
  {
    name: 'attachments',
    subpath: 'attachments',
    peers: [
      '@epam/ai-dial-quotations',
      '@epam/ai-dial-attachment-input',
      '@epam/ai-dial-attachment-canvas',
      '@epam/ai-dial-chat-shared',
    ],
  },
  {
    name: 'utils',
    subpath: 'utils',
    peers: [
      '@epam/ai-dial-chat-api-client',
      '@epam/ai-dial-chat-shared',
      '@epam/ai-dial-deployment-creation-form',
    ],
  },
];

/** Every optional peer `package.json#peerDependencies` lists (excluding `react`). */
export const ALL_OPTIONAL_PEERS = [
  '@epam/ai-dial-attachment-canvas',
  '@epam/ai-dial-attachment-input',
  '@epam/ai-dial-catalog',
  '@epam/ai-dial-chat-api-client',
  '@epam/ai-dial-chat-overlay',
  '@epam/ai-dial-chat-shared',
  '@epam/ai-dial-deployment-creation-form',
  '@epam/ai-dial-publish-panel',
  '@epam/ai-dial-quotations',
  '@epam/ai-dial-react-file-manager',
  '@epam/ai-dial-scheduled-tasks',
  '@epam/ai-dial-share',
  '@epam/ai-dial-skill-editor',
  '@epam/ai-dial-source-panel',
  '@epam/ai-dial-ui-kit',
  '@epam/pdf-highlighter-kit',
];

/** Installs all 16 declared optional peers and imports the unchanged root entry (task 6.4). */
export const LEGACY_ROOT_FIXTURE = {
  name: 'legacy-root',
  subpath: '.',
  peers: ALL_OPTIONAL_PEERS,
};

/**
 * Installs every documented `./oauth` peer except
 * `@epam/ai-dial-chat-shared`, so the build has exactly one genuinely
 * missing direct peer and must name that package literally (task 6.5 and the
 * OpenSpec negative scenario).
 */
export const NEGATIVE_FIXTURE = {
  name: 'negative-oauth',
  subpath: 'oauth',
  peers: ['@epam/ai-dial-chat-api-client'],
  expectFailure: true,
  failureMustName: '@epam/ai-dial-chat-shared',
};

/**
 * Side-effect content checks (task 6.6): the minimal fixture's bundle must
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
