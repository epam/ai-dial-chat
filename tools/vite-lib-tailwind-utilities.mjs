import { compile, optimize } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = fileURLToPath(new URL('..', import.meta.url));

/* Tailwind resolves `@source` globs with "/" separators only. */
const toGlob = (...segments) =>
  join(...segments)
    .split(sep)
    .join('/');

/*
 * Utilities are emitted unlayered and appended after the bundled CSS modules,
 * which reproduces how `apps/chat` resolves the same two sources: Vite emits
 * module classes first and the application's own unlayered utilities after,
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
 * Preflight is not imported: a library must never reset its host's document.
 * Tailwind v4 does add two things of its own to the output: `@property`
 * registrations for its `--tw-*` custom properties and an `@layer properties`
 * block that gives them initial values where `@property` is unsupported. A
 * host on Tailwind v4, and `@epam/ai-dial-ui-kit/styles.css`, declare the same
 * names with the same definitions, so the duplicates agree.
 *
 * The theme is imported `reference inline`: values are written into the
 * utilities and nothing is declared on `:root`, so this stylesheet cannot
 * replace a host's own Tailwind theme.
 */
export const buildUtilities = async (root) => {
  const input = [
    `@import 'tailwindcss/theme.css' theme(reference inline);`,
    `@import '${toGlob(WORKSPACE_ROOT, 'tools/tailwind/theme.css')}';`,
    `@import 'tailwindcss/utilities.css' source(none);`,
    `@source '${toGlob(root, 'src/**/*.{ts,tsx}')}';`,
    `@source not '${toGlob(root, 'src/**/*.{spec,test}.{ts,tsx}')}';`,
    `@source not '${toGlob(root, 'src/**/tests/**')}';`,
    /* Stories and their fixtures are not part of the published package. */
    `@source not '${toGlob(root, 'src/**/*.stories.{ts,tsx}')}';`,
    `@source not '${toGlob(root, 'src/stories/**')}';`,
    /*
     * v4 reads candidates out of comments too, and "container" is common
     * prose there. No lib uses the class, and a published `.container` rule
     * would size every `class="container"` element on a host page.
     */
    `@source not inline('container');`,
  ].join('\n');

  const compiler = await compile(input, {
    base: WORKSPACE_ROOT,
    onDependency: () => {},
  });
  const scanner = new Scanner({ sources: compiler.sources });
  const css = compiler.build(scanner.scan());

  return optimize(css, { minify: true }).code;
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
