import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { preparePublishPackageJson } from '../../../../tools/publish-lib-package-json.mjs';

const libRoot = resolve(import.meta.dirname, '../..');
const distDir = resolve(libRoot, 'dist');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'attachment-canvas-pack-'));
const stagingDir = join(temporaryRoot, 'package');
const rawSource = readFileSync(resolve(libRoot, 'package.json'), 'utf-8');
const workspacePackageNames = new Set([
  '@epam/ai-dial-chat-shared',
  '@epam/ai-dial-sidebar',
]);

cpSync(distDir, stagingDir, { recursive: true });
writeFileSync(
  resolve(stagingDir, 'package.json'),
  JSON.stringify(
    preparePublishPackageJson(JSON.parse(rawSource), {
      version: '0.0.0-test.0',
      projectRoot: 'libs/attachment-canvas',
      isWorkspaceLib: (name) => workspacePackageNames.has(name),
      rawSource,
    }),
    null,
    2,
  ) + '\n',
);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packOutput = execFileSync(
  npmCommand,
  ['pack', '--dry-run', '--json', '--ignore-scripts'],
  {
    cwd: stagingDir,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  },
);
const [artifact] = JSON.parse(packOutput);

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe('publish-ready package artifact size', () => {
  it('stays within the OOXML-free compressed size budget', () => {
    expect(artifact.size).toBeLessThanOrEqual(75_000);
  });

  it('stays within the OOXML-free unpacked size budget', () => {
    /* Raised from 231_000: the lazy resolveSourceText "View source" fetch (#9099) added ~100 bytes.
     * Raised from 231_500: the srcdoc host-document postMessage flow (#9193) added ~2.4 KB.
     * Raised from 234_000: visualizer SEND_MESSAGE support added ~2 KB, mostly the
     * README's `onVisualizerSendMessage` section (+1.2 KB); measured at 235,399.
     * Raised from 236_000: translated code-block, formula and table labels threaded to
     * both markdown renderers plus their README rows added ~2.4 KB; measured at 237,788.
     * Raised from 238_500: the Tailwind v4 utilities appended to dist/index.css carry
     * `@property` registrations, the `@layer properties` fallback and Tailwind's license
     * banner (+1 KB over the v3 output); measured at 239,292.
     * Raised from 240_000: `@epam/ai-dial-react-pdf-highlighter` 0.3.0-dev.3 ships a larger
     * stylesheet, inlined into dist/PdfContent.css via pdf-vendor.css; measured at 241,076.
     * Raised from 242_000: provider-scoped useLatestCanvasRequest, its declaration
     * and README add ~1.35 KB; measured at 242,426.
     * Raised from 243_000: the `xlsxFormulaValueClassName` typography field, its README row and the kit
     * `dial-code-text`/`LiveRegion` adoption; measured at 243,014. */
    expect(artifact.unpackedSize).toBeLessThanOrEqual(244_000);
  });

  it('contains no private OOXML renderer or worker chunks', () => {
    const privateOoxmlFiles = artifact.files
      .map(({ path }) => path)
      .filter((path) =>
        /(?:^|\/)(?:docx|xlsx|pptx|render-worker-host|renderer-module-contract|bounded-raw-part-cache)-[\w-]+\.js$/.test(
          path,
        ),
      );

    expect(privateOoxmlFiles).toEqual([]);
  });
});
