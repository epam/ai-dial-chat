import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const collector = join(
  dirname(fileURLToPath(import.meta.url)),
  'collect-test-health.mjs',
);

const FIXTURES = {
  'libs/a/src/Foo.tsx': 'export const Foo = () => null;\n',
  'libs/a/src/tests/Foo.spec.tsx': `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Foo } from '../Foo';

const expectRow = (value: string) => expect(value).toBeTruthy();
const verifyFoo = () => {
  expectRow('foo');
};

describe('Foo', () => {
  it('renders without an assertion', () => {
    render(<Foo />);
  });
  it('asserts through a throwing query', () => {
    render(<Foo />);
    screen.getByRole('button');
  });
  it('asserts through a local helper', () => {
    verifyFoo();
  });
  it('is empty', () => {});
  it.skip('is skipped', () => {
    expect(Foo).toBeTruthy();
  });
  it.only('is focused', () => {
    expect(Foo).toBeDefined();
  });
  it.todo('is planned');
  it.skipIf(process.env.CI)('is conditional', () => {
    expect(Foo).not.toBeNull();
  });
  it.each([1, 2])('is parameterized %s', (value) => {
    const doubled = value * 2;
    expect(doubled).toBeGreaterThan(value);
  });
  it.each([3, 4])('is parameterized again %s', (value) => {
    const doubled = value * 2;
    expect(doubled).toBeGreaterThan(value);
  });
  describe.skip('skipped suite', () => {
    it('inner one', () => {
      expect(1).toBe(1);
    });
    it('inner two', () => {
      expect(2).toBe(2);
    });
  });
  it('has a duplicate name', () => {
    expect(render).toBeTruthy();
  });
  it('has a duplicate name', () => {
    expect(screen).toBeTruthy();
  });
});
`,
  'libs/a/src/Dup.ts': 'export const add = (a: number, b: number) => a + b;\n',
  'libs/a/src/tests/Dup.spec.ts': `import { beforeEach, describe, expect, it } from 'vitest';
import { add } from '../Dup';

describe('add', () => {
  it('adds one and two', () => {
    const result = add(1, 2);
    expect(result).toBe(3);
  });
  it('adds small numbers', () => {
    const result = add(1, 2);
    expect(result).toBe(3);
  });
  it('adds two and three', () => {
    const result = add(2, 3);
    expect(result).toBe(5);
  });
  it('adds four and five', () => {
    const result = add(4, 5);
    expect(result).toBe(9);
  });
  describe('without setup of its own', () => {
    it('adds one and two in a nested suite', () => {
      const result = add(1, 2);
      expect(result).toBe(3);
    });
  });
  describe('with setup', () => {
    let calls = 0;
    beforeEach(() => {
      calls += 1;
    });
    it('adds one and two after setup', () => {
      const result = add(1, 2);
      expect(result).toBe(3);
    });
  });
});
`,
  'libs/a/src/Other.ts':
    'export const add = (a: number, b: number) => a - b;\n',
  'libs/a/src/tests/Other.spec.ts': `import { expect, it } from 'vitest';
import { add } from '../Other';

it('adds one and two', () => {
  const result = add(1, 2);
  expect(result).toBe(3);
});
`,
  'libs/a/src/Bar.ts': 'export const bar = 1;\n',
  'libs/a/src/tests/Bar.spec.ts': `import { expect, it, vi } from 'vitest';
import { bar } from '../Bar';

vi.mock('../dep');

it('reads bar', () => {
  expect(bar).toBe(1);
});
`,
  'libs/a/src/tests/Bar.edge.spec.ts': `import { expect, it, vi } from 'vitest';
import { bar } from '../Bar';

vi.mock('../dep');

it('reads bar at the edge', () => {
  expect(bar).toBeGreaterThan(0);
});
`,
  'libs/a/src/tests/Gone.spec.ts': `import { expect, it } from 'vitest';

it('tests nothing in the repo', () => {
  expect(true).toBe(true);
});
`,
  'libs/a/src/Baz.ts': 'export const baz = 2;\n',
  'libs/a/src/Baz.test.ts': `import { expect, it } from 'vitest';
import { baz } from './Baz';

it('reads baz', () => {
  expect(baz).toBe(2);
});
`,
  'apps/api/src/cfg/registry/provider.ts': 'export const provider = {};\n',
  'apps/api/src/cfg/tests/registry/provider.spec.ts': `import { expect, it } from 'vitest';
import { provider } from '../../registry/provider';

it('exposes the provider', () => {
  expect(provider).toEqual({});
});
`,
  'apps/api/src/cfg/dto/create-thing.dto.ts':
    'export class CreateThingDto {}\n',
  'apps/api/src/cfg/tests/create-thing.dto.spec.ts': `import { expect, it } from 'vitest';
import { CreateThingDto } from '../dto/create-thing.dto';

it('constructs', () => {
  expect(new CreateThingDto()).toBeInstanceOf(CreateThingDto);
});
`,
  'apps/web/browser-tests/flow.spec.mjs': `import { expect, test } from '@playwright/test';

test.describe('flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });
  test('opens', async ({ page }) => {
    test.skip(!process.env.BASE_URL, 'needs a server');
    await expect(page).toHaveTitle('x');
  });
});
`,
  'tools/compare.spec.mjs': `import { strictEqual } from 'node:assert';
import { test } from 'node:test';

test('compares', () => {
  strictEqual(1, 1);
});
`,
  'libs/celebrations/src/tests/scene.spec.ts': "it('x', () => {});\n",
  'libs/chat-api-client/src/client.spec.ts': "it('y', () => {});\n",
  'libs/a/src/tests/Deleted.spec.ts': "it('z', () => {});\n",
};
const UNTRACKED = {
  'libs/a/src/New.ts': 'export const fresh = true;\n',
  'libs/a/src/tests/New.spec.ts': `import { expect, it } from 'vitest';
import { fresh } from '../New';

it('is fresh', () => {
  expect(fresh).toBe(true);
});
`,
};

const writeFiles = (root, files) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

const fullNames = (items) => items.map((item) => item.fullName).sort();

describe('collect-test-health', () => {
  let root;
  let report;
  let stdout;

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'test-health-'));
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFiles(root, FIXTURES);
    execFileSync('git', ['add', '.'], { cwd: root });
    rmSync(join(root, 'libs/a/src/tests/Deleted.spec.ts'));
    writeFiles(root, UNTRACKED);
    const json = join(root, 'report.json');
    stdout = execFileSync(
      process.execPath,
      [collector, '--root', root, '--json', json, '--min-duplicate-nodes', '5'],
      { encoding: 'utf8' },
    );
    report = JSON.parse(readFileSync(json, 'utf8'));
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports success and scans tracked plus untracked test files only', () => {
    assert.match(stdout, /collector-status: OK/);
    const files = report.files.map((entry) => entry.file);
    assert.ok(files.includes('libs/a/src/tests/New.spec.ts'));
    assert.ok(!files.includes('libs/a/src/tests/Deleted.spec.ts'));
    assert.deepEqual(report.excluded, {
      'generated-client': 1,
      celebrations: 1,
      openspec: 0,
      'build-output': 0,
    });
    assert.equal(
      report.files.find((entry) => entry.file.endsWith('New.spec.ts'))
        .untracked,
      true,
    );
  });

  it('separates focused, skipped, conditional, todo and empty tests', () => {
    const { sections } = report;
    assert.deepEqual(fullNames(sections.focused), ['Foo > is focused']);
    assert.deepEqual(fullNames(sections.skippedTests), ['Foo > is skipped']);
    assert.deepEqual(
      sections.skippedSuites.map((suite) => [suite.fullName, suite.tests]),
      [['Foo > skipped suite', 2]],
    );
    assert.deepEqual(fullNames(sections.conditionalTests), [
      'Foo > is conditional',
    ]);
    assert.deepEqual(fullNames(sections.todoTests), ['Foo > is planned']);
    assert.deepEqual(fullNames(sections.emptyTests), ['Foo > is empty']);
  });

  it('accepts expect, throwing queries, asserting helpers, node:assert and Playwright expect', () => {
    assert.deepEqual(fullNames(report.sections.noAssertion), [
      'Foo > renders without an assertion',
    ]);
    const playwright = report.files.find((entry) =>
      entry.file.endsWith('flow.spec.mjs'),
    );
    assert.deepEqual(fullNames(playwright.tests), ['flow > opens']);
    assert.equal(playwright.tests[0].skip, false);
  });

  it('flags duplicate names but not parameterized titles', () => {
    assert.deepEqual(
      report.sections.duplicateNames.map((group) => group[0].fullName),
      ['Foo > has a duplicate name'],
    );
  });

  it('splits identical bodies into exact duplicates and other-context groups', () => {
    const { exactDuplicates, sameBodyOtherContext } = report.sections;
    assert.deepEqual(exactDuplicates.map(fullNames), [
      [
        'add > adds one and two',
        'add > adds small numbers',
        'add > without setup of its own > adds one and two in a nested suite',
      ],
    ]);
    assert.equal(sameBodyOtherContext.length, 1);
    assert.deepEqual(fullNames(sameBodyOtherContext[0]), [
      'add > adds one and two',
      'add > adds small numbers',
      'add > with setup > adds one and two after setup',
      'add > without setup of its own > adds one and two in a nested suite',
      'adds one and two',
    ]);
    const parameterized = exactDuplicates
      .flat()
      .filter((test) => test.parameterized);
    assert.deepEqual(parameterized, []);
  });

  it('groups literal-only clones in one suite as it.each candidates', () => {
    assert.deepEqual(report.sections.cloneGroups.map(fullNames), [
      [
        'add > adds four and five',
        'add > adds one and two',
        'add > adds small numbers',
        'add > adds two and three',
      ],
    ]);
  });

  it('resolves subjects by dot-prefix, nested tests folders and subtrees', () => {
    const subjects = Object.fromEntries(
      report.files.map((entry) => [entry.file, entry.subject.resolved]),
    );
    assert.equal(
      subjects['libs/a/src/tests/Bar.edge.spec.ts'],
      'libs/a/src/Bar.ts',
    );
    assert.equal(
      subjects['apps/api/src/cfg/tests/registry/provider.spec.ts'],
      'apps/api/src/cfg/registry/provider.ts',
    );
    assert.equal(
      subjects['apps/api/src/cfg/tests/create-thing.dto.spec.ts'],
      'apps/api/src/cfg/dto/create-thing.dto.ts',
    );
    assert.deepEqual(
      report.sections.mergeFamilies.map((family) => [
        family.subject,
        family.files.map((entry) => entry.label),
        family.sharedMocks,
      ]),
      [
        [
          'libs/a/src/Bar.ts',
          ['tests/Bar.edge.spec.ts', 'tests/Bar.spec.ts'],
          ['../dep'],
        ],
      ],
    );
  });

  it('lists unnamed subjects with their first-party import count', () => {
    const missing = Object.fromEntries(
      report.sections.missingSubjects.map((entry) => [
        entry.file,
        entry.firstPartyImports,
      ]),
    );
    assert.equal(missing['libs/a/src/tests/Gone.spec.ts'], 0);
    assert.ok(!('libs/a/src/tests/Foo.spec.tsx' in missing));
  });

  it('reports `.test.*` names and unit specs outside a tests folder', () => {
    assert.deepEqual(report.sections.testSuffix, ['libs/a/src/Baz.test.ts']);
    assert.deepEqual(report.sections.outsideTestsFolder, [
      'libs/a/src/Baz.test.ts',
    ]);
  });

  it('fails outside a git work tree', () => {
    const outside = mkdtempSync(join(tmpdir(), 'test-health-plain-'));
    try {
      const result = spawnSync(
        process.execPath,
        [collector, '--root', outside],
        {
          encoding: 'utf8',
        },
      );
      assert.equal(result.status, 2);
      assert.match(result.stdout, /collector-status: FAILED/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
