import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_PEER_NAMES } from '../../src/utils/vite-external-matcher';

/*
 * `EXTERNAL_PEER_NAMES` and `package.json#peerDependencies` record one
 * decision twice, so they have to be asserted equal. A peer the matcher does
 * not name is bundled into the package instead of resolved from the host, and
 * the size budgets catch that only when the private copy happens to be large
 * enough to breach a ceiling. `@modelcontextprotocol/ext-apps` reached this
 * branch exactly that way — declared as a peer, absent from the matcher, and
 * its transitive `zod` copy added ~106 KB raw to the eager entry closure.
 */

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'),
);

const declaredPeers = Object.keys(packageJson.peerDependencies ?? {});
const externalNames: readonly string[] = EXTERNAL_PEER_NAMES;

describe('externalized peer names', () => {
  it('names every declared peer dependency', () => {
    const bundledPeers = declaredPeers.filter(
      (name) => !externalNames.includes(name),
    );
    expect(bundledPeers).toEqual([]);
  });

  it('names nothing that is not a declared peer dependency', () => {
    const undeclared = externalNames.filter(
      (name) => !declaredPeers.includes(name),
    );
    expect(undeclared).toEqual([]);
  });
});
