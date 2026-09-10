import { writeFileSync } from 'fs';
import path from 'path';
import {
  auditInstalledTarballs,
  auditResolvedOrigins,
  buildEntry,
  measureBuild,
  matchesForbiddenOrigin,
} from './application-mode.mjs';
import {
  createFixtureDir,
  formatExecError,
  npmInstallFixture,
} from './harness.mjs';
import { ALL_OPTIONAL_PEERS, CHAT_SHARED_ROOT_PEERS } from './fixtures.mjs';
export const PROBE_DEFINITIONS = [
  {
    name: 'chat-shared-root-filtertab',
    exportName: 'FilterTab',
    packageName: '@epam/ai-dial-chat-shared',
    projectRoot: 'libs/chat-shared',
    specifier: '@epam/ai-dial-chat-shared',
    sourceEntryFile: 'index.ts',
    featurePeers: CHAT_SHARED_ROOT_PEERS,
  },
  {
    name: 'chat-shared-root-codeblocktheme',
    exportName: 'CodeBlockTheme',
    packageName: '@epam/ai-dial-chat-shared',
    projectRoot: 'libs/chat-shared',
    specifier: '@epam/ai-dial-chat-shared',
    sourceEntryFile: 'index.ts',
    featurePeers: CHAT_SHARED_ROOT_PEERS,
  },
  {
    name: 'catalog-root-credentialslevel',
    exportName: 'CredentialsLevel',
    packageName: '@epam/ai-dial-catalog',
    projectRoot: 'libs/catalog',
    specifier: '@epam/ai-dial-catalog',
    sourceEntryFile: 'index.ts',
    featurePeers: ['@epam/ai-dial-publish-panel', ...CHAT_SHARED_ROOT_PEERS],
  },
  {
    name: 'catalog-mapping-credentialslevel',
    exportName: 'CredentialsLevel',
    packageName: '@epam/ai-dial-catalog',
    projectRoot: 'libs/catalog',
    specifier: '@epam/ai-dial-catalog/mapping',
    sourceEntryFile: 'entry-points/mapping.ts',
    featurePeers: ['@epam/ai-dial-publish-panel', ...CHAT_SHARED_ROOT_PEERS],
  },
  {
    name: 'chat-hooks-root-safedecodeuricomponent',
    exportName: 'safeDecodeURIComponent',
    packageName: '@epam/ai-dial-chat-hooks',
    projectRoot: 'libs/chat-hooks',
    specifier: '@epam/ai-dial-chat-hooks',
    sourceEntryFile: 'index.ts',
    featurePeers: ALL_OPTIONAL_PEERS,
  },
  {
    name: 'chat-hooks-utils-safedecodeuricomponent',
    exportName: 'safeDecodeURIComponent',
    packageName: '@epam/ai-dial-chat-hooks',
    projectRoot: 'libs/chat-hooks',
    specifier: '@epam/ai-dial-chat-hooks/utils',
    sourceEntryFile: 'entry-points/utils.ts',
    featurePeers: [],
  },
  {
    name: 'chat-hooks-source-content-resolveexternalsourcecontenttype',
    exportName: 'resolveExternalSourceContentType',
    packageName: '@epam/ai-dial-chat-hooks',
    projectRoot: 'libs/chat-hooks',
    specifier: '@epam/ai-dial-chat-hooks/source-content',
    sourceEntryFile: 'entry-points/source-content.ts',
    featurePeers: [],
  },
];
const probeEntrySource = ({ exportName, specifier }) =>
  `import { ${exportName} } from '${specifier}';\nglobalThis.__probe = ${exportName};\n`;
export const buildProbeSourceFixture = ({ workspaceRoot, tmpRoot, probe }) => {
  const dir = createFixtureDir(tmpRoot, `${probe.name}-source`);
  writeFileSync(path.join(dir, 'entry.ts'), probeEntrySource(probe));
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      { name: `${probe.name}-source-fixture`, private: true, type: 'module' },
      null,
      2,
    ) + '\n',
  );
  const alias = {
    [probe.specifier]: path.join(
      workspaceRoot,
      probe.projectRoot,
      'src',
      probe.sourceEntryFile,
    ),
  };
  const build = buildEntry(workspaceRoot, dir, alias);
  if (!build.success) return { pass: false, dir, output: build.output };
  return { pass: true, dir, ...measureBuild(build.outDir) };
};
export const buildProbePackedFixture = ({
  workspaceRoot,
  tmpRoot,
  probe,
  dependencyResolver,
  reactVersion,
}) => {
  const dir = createFixtureDir(tmpRoot, `${probe.name}-packed`);
  writeFileSync(path.join(dir, 'entry.ts'), probeEntrySource(probe));
  const directPeers = [probe.packageName, ...(probe.featurePeers ?? [])];
  const dependencies = {
    react: reactVersion,
    ...dependencyResolver.resolvePeerClosure(directPeers),
  };

  const manifest = {
    name: `${probe.name}-packed-fixture`,
    private: true,
    type: 'module',
    dependencies,
  };

  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  try {
    npmInstallFixture(dir);
  } catch (err) {
    return { pass: false, dir, output: formatExecError(err) };
  }
  const build = buildEntry(workspaceRoot, dir, null);
  if (!build.success) return { pass: false, dir, output: build.output };
  const measured = measureBuild(build.outDir);
  auditInstalledTarballs(dir, dependencies);
  const audit = auditResolvedOrigins({ measured, fixtureDir: dir });
  if (!audit.pass)
    throw new Error('Unexpected origins: ' + audit.violations.join(', '));
  return { pass: true, dir, ...measured };
};

// Fixed ceilings include < 1 KiB scaffolding for enums/utilities and < 1 KiB
// above the source classifier. They do not grow when the source gets heavier.
export const probeBudget = (probe) =>
  probe.exportName === 'resolveExternalSourceContentType'
    ? { raw: 2048, gzip: 1024 }
    : { raw: 1024, gzip: 512 };
export const assertProbeIsolation = (probe, measured) => {
  const budget = probeBudget(probe);
  for (const metric of ['raw', 'gzip'])
    if (measured.initialJs[metric] > budget[metric])
      throw new Error(
        probe.name +
          ' exceeds fixed ' +
          metric +
          ' ceiling: ' +
          measured.initialJs[metric],
      );
  if (measured.initialCss.raw)
    throw new Error(probe.name + ' retains feature CSS');
  const forbidden = matchesForbiddenOrigin(measured, [
    'react-markdown',
    'remark-',
    'micromark',
    'rehype-',
    'katex',
    'ag-grid',
    'ai-dial-react-file-manager',
    'ai-dial-publish-panel',
    '@silurus/ooxml',
    'monaco-editor',
    'pdfjs-dist',
    'react-syntax-highlighter',
    '@mcp-ui/',
    '@modelcontextprotocol/',
    '/toolset-login-events.',
    '/attachment-canvas.',
  ]);
  if (forbidden.length)
    throw new Error(probe.name + ' retains ' + forbidden.join(', '));
};
