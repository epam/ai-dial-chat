#!/usr/bin/env node
/*
 * Static test-suite health collector for the refactoring audit.
 *
 *   node .claude/skills/refactoring-audit/scripts/collect-test-health.mjs \
 *     [--root <dir>] [--json <file>] [--limit <n>] \
 *     [--merge-max-lines <n>] [--min-duplicate-nodes <n>] [--min-clone-group <n>]
 *
 * Parses every tracked (and untracked, not ignored) test file with the
 * installed TypeScript parser and prints candidate lists: focused, skipped and
 * todo tests; tests with no visible assertion; duplicate names; identical
 * bodies, split into exact duplicates (same body, same imports, same setup)
 * and one body run against different subjects or setups; clone groups that
 * differ only in literals (one `it.each`); small spec families for one
 * subject that could merge; specs whose subject cannot be found by name; and
 * test-file placement drift. Every hit is a candidate to read, never an
 * authorization to delete or merge a test.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, posix, resolve } from 'node:path';

const parseArgs = (argv) => {
  const parsed = {
    root: null,
    json: null,
    limit: 25,
    mergeMaxLines: 400,
    minDuplicateNodes: 25,
    minCloneGroup: 3,
  };
  const numeric = {
    '--limit': 'limit',
    '--merge-max-lines': 'mergeMaxLines',
    '--min-duplicate-nodes': 'minDuplicateNodes',
    '--min-clone-group': 'minCloneGroup',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--root' || flag === '--json') {
      if (!value) throw new Error(`${flag} needs a value`);
      parsed[flag.slice(2)] = value;
      index += 1;
    } else if (numeric[flag]) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1) {
        throw new Error(`${flag} needs a positive integer`);
      }
      parsed[numeric[flag]] = number;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return parsed;
};

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

let ts;
try {
  ts = (await import('typescript')).default;
} catch {
  console.log('collector-status: UNAVAILABLE');
  console.log(
    'reason: the `typescript` package is not installed; run npm install',
  );
  process.exit(2);
}

const git = (cwd, args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

let root;
try {
  root = git(resolve(options.root ?? process.cwd()), [
    'rev-parse',
    '--show-toplevel',
  ]).trim();
} catch {
  console.log('collector-status: FAILED');
  console.log('reason: not inside a git work tree');
  process.exit(2);
}

const gitOrNull = (args) => {
  try {
    return git(root, args).trim();
  } catch {
    return null;
  }
};

const TEST_FILE = /\.(spec|test)\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const UNIT_TEST_SOURCE = /^(apps|libs)\/[^/]+\/src\/.+\.(ts|tsx)$/;
/* Below this size a shared shape is usually a one-line `expect`, not a clone. */
const MIN_CLONE_NODES = 10;
/*
 * Declared exclusions, in match order. The generated client is regenerated,
 * never hand-edited; the skill leaves celebration code out of every audit;
 * OpenSpec changes are historical; the rest is build output git should
 * already ignore.
 */
const EXCLUSIONS = [
  ['generated-client', (file) => file.startsWith('libs/chat-api-client/')],
  ['celebrations', (file) => /celebration/i.test(file)],
  ['openspec', (file) => file.startsWith('openspec/')],
  [
    'build-output',
    (file) =>
      /(^|\/)(node_modules|dist|out-tsc|storybook-static|coverage)\//.test(
        file,
      ),
  ],
];

const listGitFiles = (args) =>
  git(root, ['ls-files', '-z', ...args])
    .split('\0')
    .filter(Boolean);

const untrackedFiles = new Set(
  listGitFiles(['--others', '--exclude-standard']),
);
const allFiles = [
  ...new Set([...listGitFiles(['--cached']), ...untrackedFiles]),
]
  .filter((file) => {
    const path = join(root, file);
    return existsSync(path) && statSync(path).isFile();
  })
  .sort();

const excludedCounts = Object.fromEntries(
  EXCLUSIONS.map(([name]) => [name, 0]),
);
const candidateFiles = allFiles.filter((file) => {
  const match = EXCLUSIONS.find(([, matches]) => matches(file));
  if (match && TEST_FILE.test(file)) excludedCounts[match[0]] += 1;
  return !match;
});
const testFiles = candidateFiles.filter((file) => TEST_FILE.test(file));

/* Non-test sources indexed by extension-less basename ("stem"). */
const sourcesByStem = new Map();
for (const file of candidateFiles) {
  if (!SOURCE_FILE.test(file) || TEST_FILE.test(file)) continue;
  const stem = posix.basename(file).replace(SOURCE_FILE, '');
  if (!sourcesByStem.has(stem)) sourcesByStem.set(stem, []);
  sourcesByStem.get(stem).push(file);
}
const directories = new Set(
  candidateFiles.flatMap((file) => {
    const parts = file.split('/');
    return parts
      .slice(0, -1)
      .map((_, index) => parts.slice(0, index + 1).join('/'));
  }),
);

const projectOf = (file) => {
  const parts = file.split('/');
  if ((parts[0] === 'apps' || parts[0] === 'libs') && parts.length > 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts.length > 1 ? parts[0] : '.';
};

const countLines = (text) => {
  if (text.length === 0) return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
};

const scriptKindFor = (file) =>
  ({
    '.ts': ts.ScriptKind.TS,
    '.mts': ts.ScriptKind.TS,
    '.cts': ts.ScriptKind.TS,
    '.tsx': ts.ScriptKind.TSX,
    '.js': ts.ScriptKind.JS,
    '.mjs': ts.ScriptKind.JS,
    '.cjs': ts.ScriptKind.JS,
    '.jsx': ts.ScriptKind.JSX,
  })[extname(file)] ?? ts.ScriptKind.TS;

const TEST_ROOTS = new Map([
  ['it', { kind: 'test' }],
  ['test', { kind: 'test' }],
  ['xit', { kind: 'test', skip: true }],
  ['xtest', { kind: 'test', skip: true }],
  ['fit', { kind: 'test', only: true }],
  ['describe', { kind: 'suite' }],
  ['suite', { kind: 'suite' }],
  ['xdescribe', { kind: 'suite', skip: true }],
  ['fdescribe', { kind: 'suite', only: true }],
]);
/* Chain members a test or suite definition may carry (Vitest and Playwright). */
const MODIFIERS = new Set([
  'skip',
  'only',
  'todo',
  'fails',
  'each',
  'for',
  'concurrent',
  'sequential',
  'shuffle',
  'skipIf',
  'runIf',
  'describe',
  'serial',
  'parallel',
  'fixme',
]);
/* Members that return a new test function instead of defining a test. */
const FACTORY_MODIFIERS = new Set(['each', 'for', 'skipIf', 'runIf']);
const ASSERTION_NAME = /^(expect|assert)/i;
const THROWING_QUERY = /^(get|find)(All)?By[A-Z]/;
const ASSERT_MODULES = new Set([
  'assert',
  'assert/strict',
  'node:assert',
  'node:assert/strict',
]);
const MOCK_CALLEES = new Set(['vi.mock', 'vi.doMock', 'jest.mock']);
const LITERAL_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.JsxText,
]);

const sha1 = (value) => createHash('sha1').update(value).digest('hex');
const squash = (text) => text.replace(/\s+/g, ' ').trim();

const calleeChain = (expression) => {
  const names = [];
  let node = expression;
  for (;;) {
    if (ts.isIdentifier(node)) {
      names.unshift(node.text);
      return names;
    }
    if (ts.isPropertyAccessExpression(node)) {
      names.unshift(node.name.text);
      node = node.expression;
    } else if (ts.isCallExpression(node)) {
      node = node.expression;
    } else if (ts.isTaggedTemplateExpression(node)) {
      node = node.tag;
    } else {
      return null;
    }
  }
};

const calleeName = (expression) => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = calleeName(expression.expression);
    return owner ? `${owner}.${expression.name.text}` : expression.name.text;
  }
  return null;
};

const isFunctionNode = (node) =>
  node != null && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

/* Classifies a call as a test or suite definition, or returns null. */
const definitionOf = (call) => {
  if (
    ts.isPropertyAccessExpression(call.expression) &&
    FACTORY_MODIFIERS.has(call.expression.name.text)
  ) {
    return null;
  }
  const chain = calleeChain(call.expression);
  if (!chain) return null;
  const rootName = TEST_ROOTS.get(chain[0]);
  if (!rootName) return null;
  const members = chain.slice(1);
  if (!members.every((member) => MODIFIERS.has(member))) return null;
  const isTodo = members.includes('todo');
  const body = [...call.arguments].reverse().find(isFunctionNode) ?? null;
  if (call.arguments.length === 0 || (!body && !isTodo)) return null;
  return {
    kind:
      rootName.kind === 'test' && members.includes('describe')
        ? 'suite'
        : rootName.kind,
    skip:
      Boolean(rootName.skip) ||
      members.includes('skip') ||
      members.includes('fixme'),
    only: Boolean(rootName.only) || members.includes('only'),
    todo: isTodo,
    conditional: members.includes('skipIf') || members.includes('runIf'),
    parameterized: members.includes('each') || members.includes('for'),
    /* `it.each(table)` / it.each`table`: the table is part of the test. */
    table:
      ts.isCallExpression(call.expression) ||
      ts.isTaggedTemplateExpression(call.expression)
        ? call.expression
        : null,
    body,
  };
};

const isDefinitionStatement = (statement) =>
  ts.isExpressionStatement(statement) &&
  ts.isCallExpression(statement.expression) &&
  definitionOf(statement.expression) !== null;

const titleOf = (node, sourceFile) => {
  if (!node) return '<untitled>';
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.getText(sourceFile).slice(1, -1);
  }
  return `<${node.getText(sourceFile)}>`;
};

/* Walks a node: exact and literal-masked fingerprints, size, calls, names. */
const fingerprint = (node) => {
  const exact = createHash('sha1');
  const masked = createHash('sha1');
  const calls = [];
  const identifiers = new Set();
  let nodes = 0;
  const visit = (current) => {
    if (ts.isJsxText(current) && current.containsOnlyTriviaWhiteSpaces) return;
    nodes += 1;
    exact.update(`${current.kind}|`);
    masked.update(`${current.kind}|`);
    if (ts.isIdentifier(current) || ts.isPrivateIdentifier(current)) {
      exact.update(`${current.text}|`);
      masked.update(`${current.text}|`);
      identifiers.add(current.text);
    } else if (LITERAL_KINDS.has(current.kind)) {
      exact.update(`${current.text}|`);
      masked.update('L|');
    }
    if (ts.isCallExpression(current)) {
      const name = calleeName(current.expression);
      if (name) calls.push(name);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return {
    exact: exact.digest('hex'),
    masked: masked.digest('hex'),
    nodes,
    calls,
    identifiers,
  };
};

const isAssertionCall = (name, assertingNames) => {
  const segments = name.split('.');
  return (
    segments.some((segment) => ASSERTION_NAME.test(segment)) ||
    THROWING_QUERY.test(segments.at(-1)) ||
    assertingNames.has(segments[0]) ||
    assertingNames.has(name)
  );
};

/* Test scaffolding a spec may import without exercising product code. */
const SCAFFOLDING_PATH =
  /(^|\/)(tests?|__mocks__|mocks?|fixtures?|test-utils?|testing)(\/|$)/;
const isFirstPartyModule = (file, specifier) => {
  if (specifier.startsWith('@/') || specifier.startsWith('@epam/')) return true;
  if (!specifier.startsWith('.')) return false;
  const resolved = posix.normalize(posix.join(posix.dirname(file), specifier));
  return (
    !SCAFFOLDING_PATH.test(resolved) &&
    !/\.(spec|test|fixtures?|mocks?)$/.test(resolved)
  );
};

const resolveSpecifier = (file, specifier) =>
  specifier.startsWith('.')
    ? posix.normalize(posix.join(posix.dirname(file), specifier))
    : specifier;

/*
 * File-level bindings a test body can reach: imports (identified by resolved
 * module and imported name) and top-level declarations (identified by their
 * text plus the identities of the bindings they use). Two identical bodies
 * that reach different bindings exercise different subjects.
 */
const bindingsOf = (sourceFile, file) => {
  const imports = new Map();
  const declarations = new Map();
  const assertModuleNames = new Set();
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause
    ) {
      const module = resolveSpecifier(file, statement.moduleSpecifier.text);
      const isAssertModule = ASSERT_MODULES.has(statement.moduleSpecifier.text);
      const add = (local, imported) => {
        imports.set(local, `${module}#${imported}`);
        if (isAssertModule) assertModuleNames.add(local);
      };
      const { name, namedBindings } = statement.importClause;
      if (name) add(name.text, 'default');
      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        add(namedBindings.name.text, '*');
      } else if (namedBindings) {
        for (const element of namedBindings.elements) {
          add(
            element.name.text,
            element.propertyName?.text ?? element.name.text,
          );
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      declarations.set(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          declarations.set(declaration.name.text, declaration);
        }
      }
    }
  }

  const identities = new Map();
  const identityOf = (name, seen = new Set()) => {
    if (imports.has(name)) return `import:${imports.get(name)}`;
    const declaration = declarations.get(name);
    if (!declaration) return null;
    if (identities.has(name)) return identities.get(name);
    if (seen.has(name)) return `cycle:${name}`;
    seen.add(name);
    const used = [...fingerprint(declaration).identifiers]
      .filter((other) => other !== name)
      .map((other) => [other, identityOf(other, seen)])
      .filter(([, identity]) => identity !== null)
      .map(([other, identity]) => `${other}=${identity}`)
      .sort();
    const identity = `local:${sha1(
      `${squash(declaration.getText(sourceFile))}\0${used.join('\0')}`,
    )}`;
    identities.set(name, identity);
    return identity;
  };
  const signatureOf = (identifiers) =>
    sha1(
      [...identifiers]
        .map((name) => [name, identityOf(name)])
        .filter(([, identity]) => identity !== null)
        .map(([name, identity]) => `${name}=${identity}`)
        .sort()
        .join('\0'),
    );

  /* Assertion helpers: node:assert imports plus local functions that assert. */
  const assertingNames = new Set(assertModuleNames);
  const helperCalls = new Map();
  const collectHelpers = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      helperCalls.set(node.name.text, fingerprint(node.body).calls);
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      isFunctionNode(node.initializer)
    ) {
      helperCalls.set(node.name.text, fingerprint(node.initializer.body).calls);
    }
    ts.forEachChild(node, collectHelpers);
  };
  collectHelpers(sourceFile);
  let hasChanged = true;
  while (hasChanged) {
    hasChanged = false;
    for (const [helper, calls] of helperCalls) {
      if (assertingNames.has(helper)) continue;
      if (calls.some((call) => isAssertionCall(call, assertingNames))) {
        assertingNames.add(helper);
        hasChanged = true;
      }
    }
  }

  return { signatureOf, assertingNames };
};

/* Setup a suite contributes: every statement that is not a test or suite. */
const setupOf = (statements, sourceFile, signatureOf) => {
  const setup = statements.filter(
    (statement) =>
      !isDefinitionStatement(statement) &&
      !ts.isImportDeclaration(statement) &&
      (ts.isExpressionStatement(statement) ||
        // Top-level declarations are compared through the binding signature.
        statement.parent?.kind !== ts.SyntaxKind.SourceFile),
  );
  if (setup.length === 0) return '';
  const identifiers = new Set(
    setup.flatMap((statement) => [...fingerprint(statement).identifiers]),
  );
  return sha1(
    `${setup.map((statement) => squash(statement.getText(sourceFile))).join('\0')}\0${signatureOf(identifiers)}`,
  );
};

const analyzeFile = (file) => {
  const text = readFileSync(join(root, file), 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const { signatureOf, assertingNames } = bindingsOf(sourceFile, file);
  const tests = [];
  const suites = [];
  const mocks = new Set();
  let firstPartyImports = 0;
  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;

  const visit = (node, suitePath, inherited, setup) => {
    if (
      (ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        isFirstPartyModule(file, node.moduleSpecifier.text)) ||
      (ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        isFirstPartyModule(file, node.arguments[0].text))
    ) {
      firstPartyImports += 1;
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      const [first] = node.arguments;
      if (
        name &&
        MOCK_CALLEES.has(name) &&
        first &&
        ts.isStringLiteralLike(first)
      ) {
        mocks.add(first.text);
      }
      const definition = definitionOf(node);
      if (definition) {
        const title = titleOf(first, sourceFile);
        const state = {
          skip: inherited.skip || definition.skip,
          only: inherited.only || definition.only,
        };
        if (definition.kind === 'suite') {
          suites.push({
            title,
            path: suitePath,
            line: lineOf(node),
            skip: definition.skip,
            only: definition.only,
          });
          const body = definition.body?.body;
          if (body) {
            const ownSetup = ts.isBlock(body)
              ? setupOf([...body.statements], sourceFile, signatureOf)
              : '';
            visit(
              body,
              [...suitePath, title],
              state,
              ownSetup ? sha1(setup + ownSetup) : setup,
            );
          }
          return;
        }
        const body = definition.body?.body ?? null;
        const print = body ? fingerprint(body) : null;
        if (print && definition.table) {
          print.exact = sha1(
            `${print.exact}\0${squash(definition.table.getText(sourceFile))}`,
          );
        }
        let statements = 0;
        if (body) statements = ts.isBlock(body) ? body.statements.length : 1;
        tests.push({
          file,
          line: lineOf(node),
          path: suitePath,
          title,
          fullName: [...suitePath, title].join(' > '),
          skip: state.skip,
          ownSkip: definition.skip,
          only: state.only,
          ownOnly: definition.only,
          todo: definition.todo,
          conditional: definition.conditional,
          parameterized: definition.parameterized,
          statements,
          nodes: print?.nodes ?? 0,
          exact: print?.exact ?? null,
          masked: print?.masked ?? null,
          context: print ? sha1(setup + signatureOf(print.identifiers)) : null,
          asserts: print
            ? print.calls.some((call) => isAssertionCall(call, assertingNames))
            : false,
        });
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, suitePath, inherited, setup));
  };
  visit(
    sourceFile,
    [],
    { skip: false, only: false },
    setupOf([...sourceFile.statements], sourceFile, signatureOf),
  );

  return {
    file,
    project: projectOf(file),
    lines: countLines(text),
    untracked: untrackedFiles.has(file),
    parseErrors: sourceFile.parseDiagnostics?.length ?? 0,
    tests,
    suites,
    mocks: [...mocks].sort(),
    firstPartyImports,
  };
};

/*
 * A spec's subject: `tests/<rel>/<Name>.<concern>.spec.ts` maps to
 * `<dir>/<rel>/`, and the longest dot-prefix of the name that names a source
 * file (or a component folder) there, then anywhere below it, wins.
 */
const subjectOf = (file) => {
  const parts = posix.basename(file).replace(TEST_FILE, '').split('.');
  const marker = file.lastIndexOf('/tests/');
  let directory = posix.dirname(file);
  if (marker !== -1) {
    const relative = posix.dirname(file.slice(marker + '/tests/'.length));
    const base = file.slice(0, marker);
    directory = relative === '.' ? base : `${base}/${relative}`;
  }
  const stems = parts.map((_, index) =>
    parts.slice(0, parts.length - index).join('.'),
  );
  const inDirectory = (stem) =>
    (sourcesByStem.get(stem) ?? []).find(
      (source) => posix.dirname(source) === directory,
    );
  const below = (stem) =>
    (sourcesByStem.get(stem) ?? [])
      .filter((source) => source.startsWith(`${directory}/`))
      .sort((a, b) => a.split('/').length - b.split('/').length)[0];
  let resolved = null;
  for (const stem of stems) {
    resolved =
      inDirectory(stem) ??
      (directories.has(`${directory}/${stem}`)
        ? `${directory}/${stem}/`
        : null);
    if (resolved) break;
  }
  if (!resolved) {
    for (const stem of stems) {
      resolved = below(stem) ?? null;
      if (resolved) break;
    }
  }
  return {
    name: parts[0],
    directory,
    inTests: marker !== -1,
    resolved,
  };
};

const report = {
  generatedAt: new Date().toISOString(),
  root,
  head: gitOrNull(['rev-parse', '--short', 'HEAD']) ?? '<no commits>',
  branch: gitOrNull(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '<unborn>',
  dirtyEntries: (gitOrNull(['status', '--porcelain']) ?? '')
    .split('\n')
    .filter(Boolean).length,
  thresholds: {
    mergeMaxLines: options.mergeMaxLines,
    minDuplicateNodes: options.minDuplicateNodes,
    minCloneGroup: options.minCloneGroup,
  },
  excluded: excludedCounts,
  files: [],
  failures: [],
};

for (const file of testFiles) {
  try {
    const entry = analyzeFile(file);
    entry.subject = subjectOf(file);
    report.files.push(entry);
  } catch (error) {
    report.failures.push({ file, error: error.message });
  }
}

const tests = report.files.flatMap((entry) => entry.tests);
const groupBy = (items, keyOf) => {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()];
};
const bySize = (a, b) => b.length * b[0].nodes - a.length * a[0].nodes;
const location = (test) => `${test.file}:${test.line}`;

const markedSuites = report.files.flatMap((entry) =>
  entry.suites
    .filter((suite) => suite.skip || suite.only)
    .map((suite) => {
      const prefix = [...suite.path, suite.title].join('\0');
      return {
        file: entry.file,
        line: suite.line,
        fullName: [...suite.path, suite.title].join(' > '),
        skip: suite.skip,
        only: suite.only,
        tests: entry.tests.filter(
          (test) =>
            test.path.slice(0, suite.path.length + 1).join('\0') === prefix,
        ).length,
      };
    }),
);

const identicalBodies = groupBy(
  tests.filter((test) => test.exact && test.nodes >= options.minDuplicateNodes),
  (test) => test.exact,
).filter((group) => group.length > 1);

const sections = {
  projects: groupBy(report.files, (entry) => entry.project)
    .map((entries) => {
      const projectTests = entries.flatMap((entry) => entry.tests);
      return {
        project: entries[0].project,
        files: entries.length,
        lines: entries.reduce((sum, entry) => sum + entry.lines, 0),
        tests: projectTests.length,
        skipped: projectTests.filter((test) => test.skip).length,
        todo: projectTests.filter((test) => test.todo).length,
        focused: projectTests.filter((test) => test.only).length,
      };
    })
    .sort((a, b) => b.tests - a.tests || a.project.localeCompare(b.project)),
  focused: [
    ...markedSuites.filter((suite) => suite.only),
    ...tests.filter((test) => test.ownOnly),
  ],
  skippedSuites: markedSuites.filter((suite) => suite.skip),
  skippedTests: tests.filter((test) => test.ownSkip),
  conditionalTests: tests.filter((test) => test.conditional),
  todoTests: tests.filter((test) => test.todo),
  emptyTests: tests.filter((test) => !test.todo && test.statements === 0),
  noAssertion: tests.filter(
    (test) => !test.todo && test.statements > 0 && !test.asserts,
  ),
  duplicateNames: groupBy(
    tests.filter((test) => !test.parameterized),
    (test) => `${test.file}\0${test.fullName}`,
  ).filter((group) => group.length > 1),
  exactDuplicates: identicalBodies
    .flatMap((group) => groupBy(group, (test) => test.context))
    .filter((group) => group.length > 1)
    .sort(bySize),
  sameBodyOtherContext: identicalBodies
    .filter((group) => new Set(group.map((test) => test.context)).size > 1)
    .sort(bySize),
  cloneGroups: groupBy(
    tests.filter(
      (test) =>
        test.masked && !test.parameterized && test.nodes >= MIN_CLONE_NODES,
    ),
    (test) => `${test.file}\0${test.path.join('\0')}\0${test.masked}`,
  )
    .filter(
      (group) =>
        group.length >= options.minCloneGroup &&
        new Set(group.map((test) => test.exact)).size > 1,
    )
    .sort(bySize),
  mergeFamilies: groupBy(
    report.files,
    (entry) =>
      entry.subject.resolved ??
      `${posix.dirname(entry.file)}/${entry.subject.name}?`,
  )
    .filter((group) => group.length > 1)
    .map((group) => {
      const mockCounts = new Map();
      for (const entry of group) {
        for (const mock of entry.mocks) {
          mockCounts.set(mock, (mockCounts.get(mock) ?? 0) + 1);
        }
      }
      return {
        subject:
          group[0].subject.resolved ??
          `${group[0].subject.directory}/${group[0].subject.name} (unresolved)`,
        lines: group.reduce((sum, entry) => sum + entry.lines, 0),
        files: group.map((entry) => ({
          file: entry.file,
          label: posix.relative(
            posix.dirname(group[0].subject.resolved ?? entry.file),
            entry.file,
          ),
          lines: entry.lines,
          tests: entry.tests.length,
        })),
        sharedMocks: [...mockCounts]
          .filter(([, count]) => count > 1)
          .map(([mock]) => mock)
          .sort(),
      };
    })
    .filter((family) => family.lines <= options.mergeMaxLines)
    .sort((a, b) => a.lines - b.lines || a.subject.localeCompare(b.subject)),
  missingSubjects: report.files
    .filter((entry) => !entry.subject.resolved)
    .map((entry) => ({
      file: entry.file,
      lookedFor: `${entry.subject.directory}/**/${entry.subject.name}*`,
      tests: entry.tests.length,
      firstPartyImports: entry.firstPartyImports,
    }))
    .sort(
      (a, b) =>
        a.firstPartyImports - b.firstPartyImports ||
        a.file.localeCompare(b.file),
    ),
  testSuffix: report.files
    .filter((entry) => /\.test\.[^.]+$/.test(entry.file))
    .map((entry) => entry.file),
  outsideTestsFolder: report.files
    .filter(
      (entry) => UNIT_TEST_SOURCE.test(entry.file) && !entry.subject.inTests,
    )
    .map((entry) => entry.file),
  largestSpecs: [...report.files]
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file))
    .slice(0, options.limit)
    .map((entry) => {
      const subject = entry.subject.resolved;
      const subjectLines =
        subject && !subject.endsWith('/')
          ? countLines(readFileSync(join(root, subject), 'utf8'))
          : null;
      return {
        file: entry.file,
        lines: entry.lines,
        tests: entry.tests.length,
        subject,
        subjectLines,
      };
    }),
  parseErrors: report.files
    .filter((entry) => entry.parseErrors > 0)
    .map((entry) => ({ file: entry.file, errors: entry.parseErrors })),
};

/* ---------- human-readable report ---------- */

const out = [];
const print = (line = '') => out.push(line);
const section = (title) => {
  print();
  print(`## ${title}`);
  print();
};
const printList = (items, format, limit = options.limit) => {
  if (items.length === 0) {
    print('(none)');
    return;
  }
  for (const item of items.slice(0, limit)) print(format(item));
  if (items.length > limit) {
    print(`… and ${items.length - limit} more (full list in --json output)`);
  }
};
const printGroups = (groups, describe) => {
  if (groups.length === 0) {
    print('(none)');
    return;
  }
  print(`${groups.length} group(s)`);
  for (const group of groups.slice(0, options.limit)) {
    print(describe(group));
    for (const test of group) print(`    ${location(test)}  ${test.fullName}`);
  }
  if (groups.length > options.limit) {
    print(
      `… and ${groups.length - options.limit} more groups (full list in --json output)`,
    );
  }
};
const testLine = (test) => `${location(test)}  ${test.fullName}`;
const fileCount = (group) => new Set(group.map((test) => test.file)).size;

print('=== REFACTORING AUDIT TEST HEALTH ===');
print(`date: ${report.generatedAt.slice(0, 10)}`);
print(
  `head: ${report.head} (${report.branch}), dirty entries: ${report.dirtyEntries}`,
);
print(
  `scanned: ${report.files.length} test files (${report.files.filter((entry) => entry.untracked).length} untracked, not ignored), ${tests.length} test definitions`,
);
print(
  `excluded test files: ${Object.entries(report.excluded)
    .map(([name, count]) => `${name}=${count}`)
    .join(', ')}`,
);
print(
  `thresholds: merge family <= ${options.mergeMaxLines} lines, duplicate body >= ${options.minDuplicateNodes} AST nodes, clone group >= ${options.minCloneGroup} tests of >= ${MIN_CLONE_NODES} nodes`,
);
print(
  'Every list below is a candidate set. Read each hit before classifying it.',
);

section('Inventory by project (static definitions; a parameterized test = 1)');
printList(
  sections.projects,
  (row) =>
    `${String(row.tests).padStart(6)} tests  ${String(row.files).padStart(4)} files  ${String(row.lines).padStart(7)} lines  skip=${row.skipped} todo=${row.todo} only=${row.focused}  ${row.project}`,
  Infinity,
);

section('Focused tests and suites (.only / fit / fdescribe — must be 0)');
printList(
  sections.focused,
  (item) => `${item.file}:${item.line}  ${item.fullName}`,
);

section('Skipped suites (describe.skip / xdescribe)');
printList(
  sections.skippedSuites,
  (suite) =>
    `${suite.file}:${suite.line}  ${suite.fullName}  (${suite.tests} tests inside)`,
);

section('Skipped tests (it.skip / xit / test.fixme)');
printList(sections.skippedTests, testLine);

section(
  'Conditionally skipped tests (skipIf / runIf — check the condition still applies)',
);
printList(sections.conditionalTests, testLine);

section('Todo tests (it.todo)');
printList(sections.todoTests, testLine);

section('Empty tests (no statements)');
printList(sections.emptyTests, testLine);

section(
  'Tests with no visible assertion (expect/assert/getBy/findBy or a local asserting helper)',
);
printList(sections.noAssertion, testLine);

section('Duplicate test names within one file');
printGroups(
  sections.duplicateNames,
  (group) => `${group.length}x "${group[0].fullName}"`,
);

section(
  'Exact duplicates — identical body, imports and suite setup (delete candidates)',
);
printGroups(
  sections.exactDuplicates,
  (group) =>
    `${group.length}x, ${group[0].nodes} nodes, ${fileCount(group)} file(s)`,
);

section(
  'Same body, different subject or setup (describe.each / shared contract candidates)',
);
printGroups(
  sections.sameBodyOtherContext,
  (group) =>
    `${group.length}x, ${group[0].nodes} nodes, ${fileCount(group)} file(s), ${new Set(group.map((test) => test.context)).size} contexts`,
);

section(
  'Clone groups — same suite, same body shape, different literals (it.each candidates)',
);
printGroups(
  sections.cloneGroups,
  (group) =>
    `${group.length} tests, ${group[0].nodes} nodes each, suite "${group[0].path.join(' > ') || '<file root>'}"`,
);

section(
  `Spec families for one subject, <= ${options.mergeMaxLines} lines combined (merge candidates)`,
);
printList(
  sections.mergeFamilies,
  (family) =>
    `${String(family.lines).padStart(4)} lines  ${family.subject}  <- ${family.files
      .map((entry) => `${entry.label} (${entry.lines}l/${entry.tests}t)`)
      .join(
        ', ',
      )}${family.sharedMocks.length ? `  shared vi.mock: ${family.sharedMocks.length}` : ''}`,
);

section(
  'Specs not named after a source file (no first-party import first: tests of mocks or stale; then behaviour specs or rename drift)',
);
printList(
  sections.missingSubjects,
  (entry) =>
    `${entry.file}  (${entry.tests} tests, ${entry.firstPartyImports} first-party imports; looked for ${entry.lookedFor})`,
);

section('Placement — `.test.*` suffix (repo rule: `.spec.*` only)');
printList(sections.testSuffix, (file) => file);

section(
  'Placement — app/lib unit specs outside a `tests/` folder (counts by project, then files)',
);
printList(
  groupBy(sections.outsideTestsFolder, projectOf).map(
    (files) => `${String(files.length).padStart(4)}  ${projectOf(files[0])}`,
  ),
  (line) => line,
  Infinity,
);
if (sections.outsideTestsFolder.length > 0) print();
printList(sections.outsideTestsFolder, (file) => file);

section('Largest test files (lines, tests, subject lines when found)');
printList(
  sections.largestSpecs,
  (entry) =>
    `${String(entry.lines).padStart(6)} lines  ${String(entry.tests).padStart(4)} tests  ${entry.file}${entry.subjectLines !== null ? `  (subject ${entry.subjectLines} lines)` : ''}`,
);

section(
  'Parse warnings (TypeScript parse diagnostics; results for these files are approximate)',
);
printList(
  sections.parseErrors,
  (entry) => `${entry.file}  (${entry.errors} diagnostics)`,
);

section('Collector status');
for (const failure of report.failures) {
  print(`FAILED ${failure.file}: ${failure.error}`);
}
const status = report.failures.length > 0 ? 'FAILED' : 'OK';
print(`collector-status: ${status}`);

if (options.json) {
  const strip = (item) => {
    if (item === null || typeof item !== 'object') return item;
    const { exact, masked, context, ...rest } = item;
    return rest;
  };
  const serializable = {
    ...report,
    files: report.files.map((entry) => ({
      ...entry,
      tests: entry.tests.map(strip),
    })),
    sections: Object.fromEntries(
      Object.entries(sections).map(([key, value]) => [
        key,
        value.map((item) =>
          Array.isArray(item) ? item.map(strip) : strip(item),
        ),
      ]),
    ),
  };
  writeFileSync(
    resolve(options.json),
    `${JSON.stringify(serializable, null, 2)}\n`,
  );
  print(`json: ${resolve(options.json)}`);
}

console.log(out.join('\n'));
process.exit(status === 'OK' ? 0 : 1);
