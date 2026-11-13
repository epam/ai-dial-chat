/*
 * Guards that every project's `typecheck` target actually runs the compiler.
 * `@nx/js/typescript` replaces an inferred `typecheck` target with an echo
 * ("The 'typecheck' target is disabled because one or more project references
 * set 'noEmit: true'...") when a project tsconfig sets `noEmit`. That echo exits
 * 0, so `nx run-many -t typecheck --all` reports the project as green without
 * checking it. This test reads the Nx project graph and fails, naming the
 * project, when any `typecheck` target is disabled that way.
 * Run: node --test tools/typecheck-targets.spec.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createProjectGraphAsync } from '@nx/devkit';

const DISABLED_MARKER = 'target is disabled';

const commandsOf = (target) => {
  const options = target.options ?? {};
  const commands = [options.command, ...(options.commands ?? [])];
  return commands
    .map((entry) => (typeof entry === 'string' ? entry : entry?.command))
    .filter(Boolean);
};

test('no project has a disabled typecheck target', async () => {
  const graph = await createProjectGraphAsync({ exitOnError: false });
  const typecheckTargets = Object.values(graph.nodes)
    .map((node) => [node.name, node.data.targets?.typecheck])
    .filter(([, target]) => target);

  assert.ok(
    typecheckTargets.length > 0,
    'no project declares a typecheck target',
  );

  const disabled = typecheckTargets
    .filter(([, target]) =>
      commandsOf(target).some((command) => command.includes(DISABLED_MARKER)),
    )
    .map(([name]) => name);
  assert.deepEqual(
    disabled,
    [],
    `typecheck is disabled for: ${disabled.join(', ')}. Remove "noEmit": true from the project's tsconfig files.`,
  );

  const withoutTsc = typecheckTargets
    .filter(
      ([, target]) =>
        target.executor === 'nx:run-commands' &&
        !commandsOf(target).some((command) => /\btsc\b/.test(command)),
    )
    .map(([name]) => name);
  assert.deepEqual(
    withoutTsc,
    [],
    `typecheck does not run tsc for: ${withoutTsc.join(', ')}`,
  );
});
