import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_PACKAGE_NAMES } from '../../src/utils/vite-external-matcher';

/*
 * `EXTERNAL_PACKAGE_NAMES` and the manifest record one decision twice, so they
 * have to be asserted equal. A runtime package the matcher does not name is
 * bundled into the library instead of resolved from the consumer's install.
 * Dependencies remain automatic npm installs; peers remain host-owned. In
 * both cases externalization avoids a second private copy in this artifact.
 */

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'),
);

const declared = [
  ...Object.keys(packageJson.peerDependencies ?? {}),
  ...Object.keys(packageJson.dependencies ?? {}),
];
const externalNames: readonly string[] = EXTERNAL_PACKAGE_NAMES;

describe('externalized runtime package names', () => {
  it('names every declared dependency and peer', () => {
    const bundledPackages = declared.filter(
      (name) => !externalNames.includes(name),
    );
    expect(bundledPackages).toEqual([]);
  });

  it('names nothing that is not a declared dependency or peer', () => {
    const undeclared = externalNames.filter((name) => !declared.includes(name));
    expect(undeclared).toEqual([]);
  });
});
