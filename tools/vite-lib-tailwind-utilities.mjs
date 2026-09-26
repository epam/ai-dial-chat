import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const WORKSPACE_ROOT = fileURLToPath(new URL('..', import.meta.url));

/* The workspace Tailwind preset is CommonJS, so it cannot be `import`ed here. */
const requireFromTools = createRequire(import.meta.url);

/* Tailwind hands `content` entries to fast-glob, which only understands "/". */
const toGlob = (...segments) =>
  join(...segments)
    .split(sep)
    .join('/');

/*
 * Utilities are emitted unlayered and appended after the bundled CSS modules,
 * which reproduces how `apps/chat` resolves the same two sources: Vite emits
 * module classes first and the application's own `@tailwind utilities` after,
 * so a utility wins a tie against a module class. Wrapping the output in a
 * cascade layer would invert that, because unlayered rules beat layered ones
 * whatever their specificity, and the published package would then render
 * differently from the application it was extracted from. It would also lose
 * to any element-level reset an unlayered host stylesheet carries, which is
 * the case these utilities exist to serve. `@epam/ai-dial-react-file-manager`
 * ships its utilities unlayered for the same reason.
 *
 * The cost is a host that compiles its own Tailwind: our `.hidden` arriving
 * after its stylesheet outranks its `@media` variant of the same property,
 * since a variant adds no specificity. That is the defect
 * `libs/attachment-canvas/tests/package-boundary/pdf-vendor-style-containment.spec.ts`
 * contains a vendor sheet for — but that sheet is a full Tailwind build with
 * Preflight, where the blast radius is every element rather than the handful
 * of utilities one library names.
 *
 * `preflight` stays off: a library must never reset its host's document.
 */
const buildUtilities = async (root) => {
  const config = {
    presets: [requireFromTools(join(WORKSPACE_ROOT, 'tailwind.config.js'))],
    corePlugins: { preflight: false },
    content: [
      toGlob(root, 'src/**/*.{ts,tsx}'),
      `!${toGlob(root, 'src/**/*.{spec,test}.{ts,tsx}')}`,
      `!${toGlob(root, 'src/**/tests/**')}`,
      /* Stories and their fixtures are not part of the published package. */
      `!${toGlob(root, 'src/**/*.stories.{ts,tsx}')}`,
      `!${toGlob(root, 'src/stories/**')}`,
    ],
  };

  const { css } = await postcss([
    tailwindcss(config),
    autoprefixer,
    cssnano({ preset: 'default' }),
  ]).process('@tailwind utilities;', { from: undefined });

  return css;
};

/**
 * Appends the Tailwind utilities a publishable library's own source references
 * to its built stylesheet, so `import '@epam/<pkg>/styles.css'` carries the
 * layout the components need instead of assuming the host compiles Tailwind
 * over `node_modules`.
 *
 * List this plugin before `createVerifyPublishedStyles`: both run in
 * `closeBundle`, and the verification must read the finished stylesheet.
 */
export const createLibTailwindUtilities = ({
  root,
  cssFileName = 'index.css',
}) => ({
  name: 'lib-tailwind-utilities',
  apply: 'build',
  closeBundle: async () => {
    const utilities = await buildUtilities(root);
    if (!utilities.trim()) {
      return;
    }

    const target = join(root, 'dist', cssFileName);
    const bundled = existsSync(target) ? readFileSync(target, 'utf8') : '';

    writeFileSync(target, `${bundled}${utilities}`);
  },
});
