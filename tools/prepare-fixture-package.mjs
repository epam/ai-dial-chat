import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  collectExportFilePaths,
  preparePublishPackageJson,
} from './publish-lib-package-json.mjs';

/** Creates a private publish-ready copy without modifying shared build output. */
export const prepareFixturePackage = ({
  workspaceRoot,
  projectRoot,
  tmpRoot,
  version,
  isWorkspaceLib,
}) => {
  mkdirSync(tmpRoot, { recursive: true });
  const packageDir = mkdtempSync(path.join(tmpRoot, 'package-'));
  const distDir = path.join(workspaceRoot, projectRoot, 'dist');
  /* A different fixture may be rewriting the shared manifest while we copy. */
  cpSync(distDir, packageDir, {
    recursive: true,
    filter: (source) => source !== path.join(distDir, 'package.json'),
  });
  const rawSource = readFileSync(
    path.join(workspaceRoot, projectRoot, 'package.json'),
    'utf8',
  );
  const manifest = preparePublishPackageJson(JSON.parse(rawSource), {
    version,
    projectRoot,
    isWorkspaceLib,
    rawSource,
  });
  const missingExports = [...collectExportFilePaths(manifest.exports)].filter(
    (target) =>
      target !== './package.json' && !existsSync(path.join(packageDir, target)),
  );
  if (missingExports.length) {
    throw new Error(
      `Build output at ${distDir} is missing exports: ${missingExports.join(', ')}`,
    );
  }
  writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return packageDir;
};
