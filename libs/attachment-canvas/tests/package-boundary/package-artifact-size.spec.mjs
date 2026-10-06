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
     * both markdown renderers plus their README rows added ~2.4 KB; measured at 237,788. */
    expect(artifact.unpackedSize).toBeLessThanOrEqual(238_500);
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
