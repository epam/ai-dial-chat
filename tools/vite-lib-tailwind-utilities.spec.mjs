// Unit tests for the utilities stylesheet `vite-lib-tailwind-utilities.mjs`
// appends to every publishable lib's dist/index.css.
// Run: node --test tools/vite-lib-tailwind-utilities.spec.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildUtilities } from './vite-lib-tailwind-utilities.mjs';

const writeFixture = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'lib-tw-utilities-'));
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
};

const withFixture = async (files, check) => {
  const root = writeFixture(files);
  try {
    await check(await buildUtilities(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/* Removes Tailwind's own `@layer properties { … }` fallback block. */
const withoutPropertiesLayer = (css) => {
  const start = css.indexOf('@layer properties');
  if (start === -1) return css;
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      return css.slice(0, start) + css.slice(i + 1);
    }
  }
  return css;
};

test('emits the utilities a component references, with theme token values', async () => {
  await withFixture(
    {
      'src/Card.tsx':
        'export const Card = () => <div className="flex bg-layer-raised text-primary rounded" />;',
    },
    (css) => {
      assert.match(css, /\.flex\{display:flex\}/);
      assert.match(
        css,
        /\.bg-layer-raised\{background-color:var\(--bg-layer-raised,#fcfcfc\)\}/,
      );
      assert.match(
        css,
        /\.text-primary\{color:var\(--text-primary,#161b2d\)\}/,
      );
      assert.match(css, /\.rounded\{border-radius:4px\}/);
    },
  );
});

test('leaves out classes that only specs, tests and stories use', async () => {
  await withFixture(
    {
      'src/Card.tsx': 'export const Card = () => <div className="flex" />;',
      'src/Card.spec.tsx': 'render(<div className="bg-error" />);',
      'src/tests/helpers.tsx': 'render(<div className="bg-warning" />);',
      'src/Card.stories.tsx':
        'export const S = () => <div className="bg-info" />;',
      'src/stories/Fixture.tsx':
        'export const F = () => <div className="bg-success" />;',
    },
    (css) => {
      assert.match(css, /\.flex\{/);
      for (const cls of ['bg-error', 'bg-warning', 'bg-info', 'bg-success']) {
        assert.ok(!css.includes(`.${cls}`), `${cls} must not be emitted`);
      }
    },
  );
});

test('wraps nothing in a cascade layer except Tailwind’s properties fallback', async () => {
  await withFixture(
    {
      'src/Card.tsx':
        'export const Card = () => <div className="shadow-sm hover:bg-layer-sunken" />;',
    },
    (css) => {
      assert.ok(!/@layer\b/.test(withoutPropertiesLayer(css)));
    },
  );
});

test('emits no preflight reset', async () => {
  await withFixture(
    {
      'src/Card.tsx': 'export const Card = () => <button className="flex" />;',
    },
    (css) => {
      const rules = withoutPropertiesLayer(css);
      assert.ok(!rules.includes('box-sizing:border-box'));
      assert.ok(!/(^|[},])(html|body|button|\*)[,{]/.test(rules));
    },
  );
});

test('does not publish a container rule for the word in a comment', async () => {
  await withFixture(
    {
      'src/Card.tsx':
        '/* the scroll container */\nexport const Card = () => <div className="flex" />;',
    },
    (css) => {
      assert.ok(!css.includes('.container'));
    },
  );
});

test('compiles the mobile variant to the 1279px media query', async () => {
  await withFixture(
    {
      'src/Card.tsx':
        'export const Card = () => <div className="mobile:hidden" />;',
    },
    (css) => {
      assert.match(
        css,
        /@media \(max-width:1279px\)\{\.mobile\\:hidden\{display:none\}\}/,
      );
    },
  );
});
