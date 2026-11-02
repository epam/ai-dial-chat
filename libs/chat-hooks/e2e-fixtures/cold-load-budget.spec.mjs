import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProbeIsolation,
  PROBE_DEFINITIONS,
} from './cold-load-probes.mjs';
import { SUBPATH_FIXTURES } from './fixtures.mjs';

test('the utils cold-load probe installs its public entry resolution peers', () => {
  const probe = PROBE_DEFINITIONS.find(
    ({ specifier }) => specifier === '@epam/ai-dial-chat-hooks/utils',
  );
  const fixture = SUBPATH_FIXTURES.find(({ subpath }) => subpath === 'utils');
  assert.ok(probe.featurePeers.includes('@epam/ai-dial-chat-shared'));
  assert.deepEqual(new Set(probe.featurePeers), new Set(fixture.peers));
});
test('source inflation and excluded code cannot raise probe ceilings', () => {
  const measured = {
    initialJs: { raw: 2000, gzip: 100 },
    initialCss: { raw: 0 },
    initialModuleOrigins: [],
  };
  assert.throws(
    () => assertProbeIsolation(PROBE_DEFINITIONS[0], measured),
    /ceiling/,
  );
  measured.initialJs.raw = 100;
  measured.initialJs.gzip = 600;
  assert.throws(
    () => assertProbeIsolation(PROBE_DEFINITIONS[0], measured),
    /gzip/,
  );
  measured.initialJs.gzip = 80;
  measured.initialModuleOrigins = ['/fixture/node_modules/katex/dist/katex.js'];
  assert.throws(
    () => assertProbeIsolation(PROBE_DEFINITIONS[0], measured),
    /katex/,
  );
});
