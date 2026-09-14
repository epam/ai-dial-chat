import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import {
  existsSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  createFixtureDir,
  formatExecError,
  npmInstallFixture,
} from './harness.mjs';
import { ALL_OPTIONAL_PEERS } from './fixtures.mjs';
export const APPLICATION_ENTRY_SOURCE = `import { createElement, createContext, useContext, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { clearAttachmentCache } from '@epam/ai-dial-chat-hooks/file-manager';
import { usePanelMaxWidth } from '@epam/ai-dial-chat-hooks/viewport-layout';
import { useConversationSources } from '@epam/ai-dial-chat-hooks/conversation-sources';
import { resolveExternalSourceContentType } from '@epam/ai-dial-chat-hooks/source-content';
import { subscribeToolsetLoginSuccess } from '@epam/ai-dial-chat-hooks';
import { CodeBlockTheme, FilterTab } from '@epam/ai-dial-chat-shared';
import { CredentialsLevel } from '@epam/ai-dial-catalog/mapping';

const ConversationContext = createContext([]);
const messages = [{role:'user',content:'Fixture conversation',custom_content:{attachments:[]}}];
globalThis.__appEntry = { clearAttachmentCache, CodeBlockTheme, FilterTab, CredentialsLevel };
globalThis.__oauthIdentityEvents = [];
subscribeToolsetLoginSuccess(detail => globalThis.__oauthIdentityEvents.push(detail));
const noop = () => {};
const loadStyles = () => import('@epam/ai-dial-chat-shared/styles.css');
const markdown = '# Sample\\n\\n' + '\\x60\\x60\\x60ts\\nconst x: number = 1;\\n\\x60\\x60\\x60\\n\\nInline math: $E=mc^2$\\n';

function Conversation() {
  const messages = useContext(ConversationContext);
  const sources = useConversationSources(messages);
  const maxWidth = usePanelMaxWidth(320);
  const rootRef = useRef(null);
  useEffect(() => {
    const roots = new Map();
    const mount = (key, component, props) => {
      let root = roots.get(key);
      if (!root) {
        const element = document.createElement('section');
        element.id = key + '-feature-root';
        rootRef.current.append(element);
        root = createRoot(element);
        roots.set(key, root);
      }
      root.render(createElement(component, props));
    };
    globalThis.__closeFeature = key => roots.get(key)?.render(null);
    globalThis.__openCatalogFeature = () => Promise.all([loadStyles(),import('@epam/ai-dial-ui-kit/styles.css'),import('@epam/ai-dial-catalog/styles.css'),import('@epam/ai-dial-catalog')]).then(([, , , mod]) => {
      mount('catalog', mod.Catalog, {items:[],favorites:[]});
    });
    globalThis.__openPublishPanel = () => Promise.all([loadStyles(),import('@epam/ai-dial-ui-kit/styles.css'),import('@epam/ai-dial-publish-panel/styles.css'),import('@epam/ai-dial-publish-panel')]).then(([, , , mod]) => {
      mount('publication', mod.PublishPanel, {
        resource:{title:'Fixture publication'},history:[],folderItems:[],selectedFolderPath:[],
        onSelectedFolderPathChange:noop,onCreateFolder:async()=>{},hasExistingPublicationInFolder:false,
        hasWriteAccess:true,isSubmitting:false,rules:[],onRulesChange:noop,ruleSourceOptions:[]
      });
    });
    globalThis.__openFileManagerFeature = () => Promise.all([loadStyles(),import('@epam/ai-dial-ui-kit/styles.css'),import('@epam/ai-dial-react-file-manager/styles.css'),import('@epam/ai-dial-chat-shared/file-manager')]).then(([, , , mod]) => {
      const controller = {
        items:[],isLoading:false,error:null,path:'/',isSearching:false,searchResults:null,
        expandedPaths:new Set(),loadedPaths:new Set(),folderPopupLoadingPaths:new Set(),
        uploadBatchState:null,uploadEnabled:false,isNewButtonDisabled:true,disabledNewButtonTooltip:'',
        visibleColumns:[],dateLocale:'en',dateOptions:{},actionLabels:{},sharedByMePaths:new Set()
      };
      for (const key of ['onPathChange','retry','onSearchFiles','clearSearchResults','onExpandedPathsChange',
        'onFolderPopupPathChange','onUploadFiles','onUploadArchive','cancelUpload','clearUploadBatch',
        'onDownloadFiles','onDeleteFiles','onMoveToFiles','onCopyFiles','cancelCopyMove','onUnshareFiles',
        'onRemoveFilesAccess','onGetInfo','clearMetadata']) controller[key] = noop;
      controller.onCreateFolder = async()=>{};
      controller.onCreateFolderValidate = controller.onRenameValidate = ()=>null;
      mount('files', mod.DialFileManagerShell, {
        controller, labels:{treeHeaderByTab:{my_files:'Files'},emptyStateByTab:{my_files:{}}},
        activeTab:'my_files',tabs:[],onTabChange:noop,selectedPaths:new Set(),onSelectedPathsChange:noop,
        variant:'standalone',actionProfile:'full'
      });
    });
    globalThis.__openMarkdownFeature = () => Promise.all([loadStyles(),import('@epam/ai-dial-chat-shared/markdown')]).then(([,mod]) => {
      mount('markdown', mod.MarkdownRenderer, {content:markdown});
    });
    globalThis.__openOAuthAndEmit = () => import('@epam/ai-dial-chat-hooks/oauth').then(mod => {
      mod.emitToolsetLoginSuccess({toolsetId:'browser-parity-fixture',credentialsLevel:'browser-parity-test'});
    });
    globalThis.__appReadyAt = performance.timeOrigin + performance.now();
    document.getElementById('app-marker').setAttribute('data-app-ready','true');
  }, []);
  return createElement('main', {'data-max-width':String(maxWidth)},
    createElement('div',{id:'app-marker'},messages[0].content),
    createElement('output',{'data-testid':'sources'},String(sources.sources.length)),
    createElement('output',{'data-testid':'mime'},resolveExternalSourceContentType('text/markdown','https://example.test/report.pdf')),
    createElement('div',{ref:rootRef})
  );
}
createRoot(document.getElementById('root')).render(
  createElement(ConversationContext.Provider,{value:messages},createElement(Conversation))
);
`;
export const DEFERRED_FEATURES = [
  {
    key: 'catalog',
    label: 'catalog (Catalog)',
    opener: '__openCatalogFeature',
    root: 'catalog',
  },
  {
    key: 'publishPanel',
    label: 'publication (PublishPanel)',
    opener: '__openPublishPanel',
    root: 'publication',
  },
  {
    key: 'markdown',
    label: 'markdown/code/math (MarkdownRenderer)',
    opener: '__openMarkdownFeature',
    root: 'markdown',
  },
  {
    key: 'fileManagerUi',
    label: 'file-manager (DialFileManagerShell)',
    opener: '__openFileManagerFeature',
    root: 'files',
  },
];
export const IN_SCOPE_WORKSPACE_PACKAGE_NAMES = [
  '@epam/ai-dial-chat-hooks',
  '@epam/ai-dial-chat-shared',
  '@epam/ai-dial-catalog',
  '@epam/ai-dial-publish-panel',
];
export const HARD_EXCLUDED_MODULE_MARKERS = [
  'ag-grid-community',
  'monaco-editor',
  'pdfjs-dist',
  'react-syntax-highlighter',
  'katex/dist/katex',
  'mammoth',
  '@silurus/ooxml',
  'docx-preview',
  'xlsx',
  'pptx',
  'ai-dial-react-file-manager/dist/',
  'ai-dial-publish-panel/',
  '/chat-shared/dist/file-manager/DialFileManagerShell/',
  '/chat-shared/src/file-manager/DialFileManagerShell/',
];
const measureFiles = (filePaths) =>
  filePaths.reduce(
    (total, filePath) => {
      const contents = readFileSync(filePath);
      return {
        raw: total.raw + statSync(filePath).size,
        gzip: total.gzip + gzipSync(contents).length,
      };
    },
    { raw: 0, gzip: 0 },
  );
const listAllFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listAllFiles(full) : [full];
  });
const MODULE_ORIGIN_PLUGIN_SOURCE = `{
    name: 'record-module-origins',
    /*
     * writeBundle (not generateBundle) — the outDir is only actually created
     * on disk once Vite writes the emitted files, which happens between
     * generateBundle and writeBundle.
     */
    writeBundle(_options, bundle) {
      const origins = {};
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type !== 'chunk') continue;
        origins[fileName] = Object.fromEntries(
          Object.entries(item.modules).map(([id, mod]) => [id, mod.renderedLength ?? 0]),
        );
      }
      writeFileSync(path.join(outDirAbs, 'module-origins.json'), JSON.stringify(origins));
    },
  }`;
export const buildEntry = (
  workspaceRoot,
  dir,
  aliasEntries,
  externalSpecifiers = [
    'react',
    'react-dom',
    'react-dom/client',
    'react/jsx-runtime',
  ],
) => {
  const viteEntryUrl = pathToFileURL(
    path.join(
      workspaceRoot,
      'node_modules',
      'vite',
      'dist',
      'node',
      'index.js',
    ),
  ).href;
  const aliasLiteral = aliasEntries
    ? `{\n${Object.entries(aliasEntries)
        .map(
          ([find, replacement]) =>
            `      ${JSON.stringify(find)}: ${JSON.stringify(replacement)},`,
        )
        .join('\n')}\n    }`
    : '{}';
  const outDir = path.join(dir, 'dist-app');
  const outDirAbsLiteral = JSON.stringify(outDir);
  writeFileSync(
    path.join(dir, 'vite.config.mjs'),
    [
      `import { defineConfig } from '${viteEntryUrl}';`,
      `import { writeFileSync } from 'node:fs';`,
      `import path from 'node:path';`,
      '',
      `const outDirAbs = ${outDirAbsLiteral};`,
      '',
      'export default defineConfig({',
      `  resolve: { alias: ${aliasLiteral} },`,
      `  plugins: [${MODULE_ORIGIN_PLUGIN_SOURCE}],`,
      '  build: {',
      "    outDir: 'dist-app',",
      '    emptyOutDir: true,',
      '    manifest: true,',
      '    rolldownOptions: {',
      "      input: 'entry.ts',",
      `      external: ${JSON.stringify(externalSpecifiers)},`,
      '    },',
      '  },',
      "  logLevel: 'warn',",
      '});',
      '',
    ].join('\n'),
  );
  try {
    const viteCli = path.join(
      workspaceRoot,
      'node_modules',
      'vite',
      'bin',
      'vite.js',
    );
    const output = execFileSync(
      process.execPath,
      [
        viteCli,
        'build',
        '--config',
        'vite.config.mjs',
        '--configLoader',
        'native',
      ],
      { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return { success: true, output, outDir };
  } catch (err) {
    return { success: false, output: formatExecError(err), outDir };
  }
};
export const readManifest = (outDir) => {
  const manifestPath = path.join(outDir, '.vite', 'manifest.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
};
export const writeAppShellHtml = (outDir) => {
  const manifest = readManifest(outDir);
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
  if (!entryKey)
    throw new Error(`No entry chunk found in ${outDir}/.vite/manifest.json`);
  const entry = manifest[entryKey];
  const cssLinks = [
    ...new Set(staticClosure(manifest).flatMap((chunk) => chunk.css ?? [])),
  ]
    .map((href) => `    <link rel="stylesheet" href="/${href}">`)
    .join('\n');
  writeFileSync(
    path.join(outDir, 'index.html'),
    `<!doctype html>
<html>
  <head>
${cssLinks}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entry.file}"></script>
  </body>
</html>
`,
  );
};
// Real paths reject symlink escapes; unresolved test paths remain comparable.
const canonicalPath = (value) => {
  const clean = value
    .replace(/^\0/, '')
    .replace(/\?(?:commonjs-[^?]+|v=[^?]+)$/, '');
  return (
    existsSync(clean) ? realpathSync(clean) : path.resolve(clean)
  ).replaceAll('\\', '/');
};
export const auditResolvedOrigins = ({ measured, fixtureDir }) => {
  const root = canonicalPath(path.join(fixtureDir, 'node_modules')) + '/';
  const entry = canonicalPath(path.join(fixtureDir, 'entry.ts'));
  const violations = measured.initialModuleOrigins.filter((origin) => {
    if (
      [
        '\0rolldown/runtime.js',
        '\0commonjsHelpers.js',
        '\0vite/preload-helper.js',
        '\0vite/modulepreload-polyfill.js',
      ].includes(origin)
    )
      return false;
    const resolved = canonicalPath(origin);
    return resolved !== entry && !resolved.startsWith(root);
  });
  return { pass: violations.length === 0, violations };
};

export const staticClosure = (manifest) => {
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
  if (!entryKey) throw new Error('Manifest has no entry chunk');
  const chunks = new Map();
  const visit = (key) => {
    if (chunks.has(key)) return;
    const chunk = manifest[key];
    if (!chunk?.file) throw new Error('Missing manifest chunk: ' + key);
    chunks.set(key, chunk);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  visit(entryKey);
  return [...chunks.values()];
};

export const measureBuild = (outDir, { sizeThresholdBytes = 50000 } = {}) => {
  const manifest = readManifest(outDir);
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
  if (!entryKey)
    throw new Error(`No entry chunk found in ${outDir}/.vite/manifest.json`);
  const chunks = staticClosure(manifest);
  const initialJsFiles = new Set(
    chunks.map((chunk) => path.join(outDir, chunk.file)),
  );
  const initialCssFiles = new Set(
    chunks.flatMap((chunk) =>
      (chunk.css ?? []).map((file) => path.join(outDir, file)),
    ),
  );
  const allJsFiles = listAllFiles(outDir).filter((f) => f.endsWith('.js'));
  const dynamicChunks = allJsFiles.filter((f) => !initialJsFiles.has(f));
  const originsPath = path.join(outDir, 'module-origins.json');
  const originsByFile = JSON.parse(readFileSync(originsPath, 'utf8'));
  if (
    !originsByFile ||
    Array.isArray(originsByFile) ||
    typeof originsByFile !== 'object'
  )
    throw new Error('Invalid module origins');
  const initialModuleSizeById = new Map();
  for (const f of initialJsFiles) {
    const modules = originsByFile[path.relative(outDir, f).replace(/\\/g, '/')];
    if (
      !modules ||
      Array.isArray(modules) ||
      typeof modules !== 'object' ||
      !Object.keys(modules).length
    )
      throw new Error('Missing module origins for ' + f);
    for (const [id, bytes] of Object.entries(modules)) {
      if (!Number.isFinite(bytes) || bytes < 0)
        throw new Error('Invalid module length for ' + id);
      if (bytes === 0) continue;
      initialModuleSizeById.set(
        id,
        (initialModuleSizeById.get(id) ?? 0) + bytes,
      );
    }
  }
  const initialModuleOrigins = [...initialModuleSizeById.keys()];
  const originPackageOf = (id) => {
    const normalized = id.replace(/\\/g, '/');
    const nodeModulesMatch = normalized.match(
      /node_modules\/((?:@[^/]+\/)?[^/]+)\//,
    );
    if (nodeModulesMatch) return nodeModulesMatch[1];
    const libsMatch = normalized.match(/\/libs\/([^/]+)\/src\//);
    if (libsMatch) return `libs/${libsMatch[1]} (source)`;
    return normalized;
  };
  const bytesByOriginPackage = new Map();
  for (const [id, bytes] of initialModuleSizeById) {
    const key = originPackageOf(id);
    bytesByOriginPackage.set(key, (bytesByOriginPackage.get(key) ?? 0) + bytes);
  }
  const heaviestOriginPackages = [...bytesByOriginPackage.entries()]
    .map(([origin, bytes]) => ({ origin, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
  return {
    initialJs: measureFiles([...initialJsFiles]),
    initialCss: measureFiles([...initialCssFiles]),
    initialAssets: measureFiles(
      [...new Set(chunks.flatMap((chunk) => chunk.assets ?? []))].map((file) =>
        path.join(outDir, file),
      ),
    ),
    dynamicChunks: dynamicChunks.map((f) => path.relative(outDir, f)),
    largeModules: [...initialJsFiles]
      .filter((f) => statSync(f).size > sizeThresholdBytes)
      .map((f) => ({
        file: path.relative(outDir, f),
        bytes: statSync(f).size,
      })),
    initialFilesText: [...initialJsFiles]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n'),
    initialModuleOrigins,
    heaviestOriginPackages,
  };
};
export const matchesForbiddenOrigin = (measured, forbiddenPathSegments) =>
  forbiddenPathSegments.filter((segment) =>
    measured.initialModuleOrigins.some((origin) =>
      origin.replace(/\\/g, '/').includes(segment),
    ),
  );
export const recordProvenance = (workspaceRoot) => {
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();
  const hash = createHash('sha256');
  hash.update(
    execFileSync('git', ['diff', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  const statusOutput = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: workspaceRoot, encoding: 'utf8' },
  );
  const untrackedFiles = statusOutput
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).trim())
    .sort();
  for (const relativeFile of untrackedFiles) {
    const absoluteFile = path.join(workspaceRoot, relativeFile);
    if (existsSync(absoluteFile) && statSync(absoluteFile).isFile()) {
      hash.update(relativeFile);
      hash.update(readFileSync(absoluteFile));
    }
  }
  const dirty = untrackedFiles.length > 0 || statusOutput.trim().length > 0;
  const readInstalledVersion = (packageName) =>
    JSON.parse(
      readFileSync(
        path.join(
          workspaceRoot,
          'node_modules',
          ...packageName.split('/'),
          'package.json',
        ),
        'utf8',
      ),
    ).version;
  return {
    gitSha,
    dirty,
    dirtyContentHash: hash.digest('hex'),
    viteVersion: readInstalledVersion('vite'),
    reactVersion: readInstalledVersion('react'),
  };
};
export const buildSourceFixture = ({ workspaceRoot, tmpRoot }) => {
  const dir = createFixtureDir(tmpRoot, 'application-source');
  writeFileSync(path.join(dir, 'entry.ts'), APPLICATION_ENTRY_SOURCE);
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'application-mode-source-fixture',
        private: true,
        type: 'module',
      },
      null,
      2,
    ) + '\n',
  );
  const libSrc = (projectRoot, entryFile) =>
    path.join(workspaceRoot, projectRoot, 'src', entryFile);
  const requireFromWorkspace = createRequire(
    path.join(workspaceRoot, 'package.json'),
  );
  const alias = {
    '@epam/ai-dial-ui-kit/styles.css': requireFromWorkspace.resolve(
      '@epam/ai-dial-ui-kit/styles.css',
    ),
    '@epam/ai-dial-react-file-manager/styles.css': requireFromWorkspace.resolve(
      '@epam/ai-dial-react-file-manager/styles.css',
    ),
    'react/jsx-runtime': requireFromWorkspace.resolve('react/jsx-runtime'),
    'react/jsx-dev-runtime': requireFromWorkspace.resolve(
      'react/jsx-dev-runtime',
    ),
    'react-dom/client': requireFromWorkspace.resolve('react-dom/client'),
    react: requireFromWorkspace.resolve('react'),
    '@epam/ai-dial-chat-hooks/file-manager': libSrc(
      'libs/chat-hooks',
      'entry-points/file-manager.ts',
    ),
    '@epam/ai-dial-chat-hooks/viewport-layout': libSrc(
      'libs/chat-hooks',
      'entry-points/viewport-layout.ts',
    ),
    '@epam/ai-dial-chat-hooks/oauth': libSrc(
      'libs/chat-hooks',
      'entry-points/oauth.ts',
    ),
    '@epam/ai-dial-chat-hooks/conversation-sources': libSrc(
      'libs/chat-hooks',
      'entry-points/conversation-sources.ts',
    ),
    '@epam/ai-dial-chat-hooks/source-content': libSrc(
      'libs/chat-hooks',
      'entry-points/source-content.ts',
    ),
    '@epam/ai-dial-chat-hooks': libSrc('libs/chat-hooks', 'index.ts'),
    '@epam/ai-dial-chat-shared/file-manager': libSrc(
      'libs/chat-shared',
      'entry-points/file-manager.ts',
    ),
    '@epam/ai-dial-chat-shared/markdown': libSrc(
      'libs/chat-shared',
      'entry-points/markdown.ts',
    ),
    // Both hosts use the documented stylesheet artifact; JavaScript varies source vs packed.
    '@epam/ai-dial-chat-shared/styles.css': path.join(
      workspaceRoot,
      'libs/chat-shared/dist/index.css',
    ),
    '@epam/ai-dial-chat-shared': libSrc('libs/chat-shared', 'index.ts'),
    '@epam/ai-dial-catalog/mapping': libSrc(
      'libs/catalog',
      'entry-points/mapping.ts',
    ),
    '@epam/ai-dial-catalog/styles.css': libSrc('libs/catalog', 'styles.css'),
    '@epam/ai-dial-catalog': libSrc('libs/catalog', 'index.ts'),
    '@epam/ai-dial-publish-panel/styles.css': libSrc(
      'libs/publish-panel',
      'styles.css',
    ),
    '@epam/ai-dial-publish-panel': libSrc('libs/publish-panel', 'index.ts'),
  };
  const build = buildEntry(workspaceRoot, dir, alias, []);
  if (!build.success) return { pass: false, dir, output: build.output };
  return {
    pass: true,
    dir,
    outDir: build.outDir,
    ...measureBuild(build.outDir),
  };
};
export const buildPackedFixture = ({
  workspaceRoot,
  tmpRoot,
  dependencyResolver,
  reactVersion,
  reactDomVersion,
}) => {
  const dir = createFixtureDir(tmpRoot, 'application-packed');
  writeFileSync(path.join(dir, 'entry.ts'), APPLICATION_ENTRY_SOURCE);
  const directPeers = [
    ...new Set([...IN_SCOPE_WORKSPACE_PACKAGE_NAMES, ...ALL_OPTIONAL_PEERS]),
  ];
  const dependencies = {
    react: reactVersion,
    'react-dom': reactDomVersion,
    ...dependencyResolver.resolvePeerClosure(directPeers),
  };
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'application-mode-packed-fixture',
        private: true,
        type: 'module',
        dependencies,
      },
      null,
      2,
    ) + '\n',
  );
  try {
    npmInstallFixture(dir);
  } catch (err) {
    return { pass: false, dir, output: formatExecError(err) };
  }
  const build = buildEntry(workspaceRoot, dir, null, []);
  if (!build.success) return { pass: false, dir, output: build.output };
  const tarballHashes = auditInstalledTarballs(dir, dependencies);
  const measured = measureBuild(build.outDir);
  const resolutionAudit = auditResolvedOrigins({
    measured,
    workspaceRoot,
    fixtureDir: dir,
  });
  if (!resolutionAudit.pass)
    throw new Error(
      'Unexpected packed module origins: ' +
        resolutionAudit.violations.join(', '),
    );
  return {
    pass: true,
    dir,
    outDir: build.outDir,
    ...measured,
    resolutionAudit,
    tarballHashes,
  };
};

export const auditInstalledTarballs = (dir, dependencies) => {
  const lock = JSON.parse(
    readFileSync(path.join(dir, 'package-lock.json'), 'utf8'),
  );
  const expected = new Map();
  const hashes = {};
  for (const [name, spec] of Object.entries(dependencies)) {
    if (!spec.startsWith('file:')) continue;
    const tarball = spec.startsWith('file:///')
      ? fileURLToPath(spec)
      : path.resolve(dir, spec.slice(5));
    const integrity =
      'sha512-' +
      createHash('sha512').update(readFileSync(tarball)).digest('base64');
    expected.set(name, integrity);
    hashes[name] = integrity;
    const installed = lock.packages?.['node_modules/' + name];
    if (installed?.integrity !== integrity)
      throw new Error('Tarball integrity mismatch: ' + name);
  }
  for (const [location, pkg] of Object.entries(lock.packages ?? {})) {
    const name = location.split('node_modules/').at(-1);
    if (expected.has(name) && pkg.integrity !== expected.get(name))
      throw new Error('Stale internal copy: ' + location);
  }
  return hashes;
};

// Representative source baseline: 1,196,084 B / 348,064 B JS and 6,214 B /
// 1,134 B CSS. Fixed headroom is independent of subsequent source inflation.
export const APPLICATION_BUDGET = {
  initialJs: { raw: 1500000, gzip: 450000 },
  initialCss: { raw: 8000, gzip: 2000 },
  initialAssets: { raw: 0, gzip: 0 },
};
export const assertApplicationBudget = (measured) => {
  for (const [kind, budget] of Object.entries(APPLICATION_BUDGET)) {
    if (!measured[kind]) throw new Error('Missing measurement: ' + kind);
    for (const metric of ['raw', 'gzip'])
      if (measured[kind][metric] > budget[metric])
        throw new Error(
          kind +
            ' ' +
            metric +
            ' exceeds ' +
            budget[metric] +
            ': ' +
            measured[kind][metric],
        );
  }
};
