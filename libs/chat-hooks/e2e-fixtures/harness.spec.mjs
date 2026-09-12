import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePeerClosure } from './harness.mjs';

test('resolves workspace peers to local artifacts and external peers to exact locked versions', () => {
  const specs = {
    '@epam/ai-dial-chat-shared':
      'file:///tmp/epam-ai-dial-chat-shared-0.0.0-packed.0.tgz',
    '@epam/ai-dial-ui-kit': '0.14.0-dev.15',
    '@tabler/icons-react': '3.44.0',
  };
  const requiredPeers = {
    '@epam/ai-dial-chat-shared': {
      '@epam/ai-dial-ui-kit': '^0.14.0-dev.15',
    },
    '@epam/ai-dial-ui-kit': {
      '@tabler/icons-react': '^3.30.0',
      react: '^19.0.0',
    },
    '@tabler/icons-react': { react: '>=16' },
  };

  const closure = resolvePeerClosure(['@epam/ai-dial-chat-shared'], {
    resolveDependencySpec: (name) => specs[name],
    readClosureDependencies: (name) => requiredPeers[name] ?? {},
  });

  assert.deepEqual(closure, specs);
  assert.equal(
    Object.values(closure).some((spec) =>
      ['development', 'latest', '*'].includes(spec),
    ),
    false,
  );
});

test('deduplicates cycles in a peer dependency graph', () => {
  const calls = [];
  const closure = resolvePeerClosure(['a'], {
    resolveDependencySpec: (name) => `file:///tmp/${name}.tgz`,
    readClosureDependencies: (name) => {
      calls.push(name);
      return name === 'a' ? { b: '*' } : { a: '*' };
    },
  });

  assert.deepEqual(closure, {
    a: 'file:///tmp/a.tgz',
    b: 'file:///tmp/b.tgz',
  });
  assert.deepEqual(calls, ['a', 'b']);
});

test('packs a workspace sibling reached through dependencies, not only peers', () => {
  /*
   * `conversation-panel` composes `sidebar` as a `dependency`. The publish
   * transform rewrites that spec to the packed version, which exists only as a
   * local tarball — so a closure that followed peers alone left the sibling
   * unpacked and npm went to the registry for
   * `@epam/ai-dial-sidebar@0.0.0-packed.0`.
   */
  const pulledIn = {
    '@epam/ai-dial-conversation-panel': {
      '@epam/ai-dial-chat-shared': '*',
      '@epam/ai-dial-sidebar': '0.0.1',
    },
    '@epam/ai-dial-chat-shared': {},
    '@epam/ai-dial-sidebar': {},
  };

  const closure = resolvePeerClosure(['@epam/ai-dial-conversation-panel'], {
    resolveDependencySpec: (name) => `file:///tmp/${name}.tgz`,
    readClosureDependencies: (name) => pulledIn[name] ?? {},
  });

  assert.deepEqual(Object.keys(closure).sort(), [
    '@epam/ai-dial-chat-shared',
    '@epam/ai-dial-conversation-panel',
    '@epam/ai-dial-sidebar',
  ]);
});
