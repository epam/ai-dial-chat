import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractSkillArchive } from '../skill-archive';

const zipFile = (entries: Record<string, Uint8Array>): File =>
  new File([zipSync(entries) as BlobPart], 'bundle.zip', {
    type: 'application/zip',
  });

describe('extractSkillArchive', () => {
  it('returns one entry per file with the archive folder structure', async () => {
    const entries = await extractSkillArchive(
      zipFile({
        'refs/a.md': strToU8('# A'),
        'b.py': strToU8('print(1)'),
      }),
    );

    expect(entries.map((entry) => entry.path).sort()).toEqual([
      'b.py',
      'refs/a.md',
    ]);
    const nested = entries.find((entry) => entry.path === 'refs/a.md');
    expect(nested?.file.name).toBe('a.md');
    expect(await nested?.file.text()).toBe('# A');
  });

  it('infers the MIME type from the entry extension', async () => {
    const [entry] = await extractSkillArchive(
      zipFile({ 'notes.md': strToU8('x') }),
    );

    expect(entry.file.type).toBe('text/markdown');
  });

  it('skips directory, macOS metadata, .DS_Store and empty-folder marker entries', async () => {
    const entries = await extractSkillArchive(
      zipFile({
        'a.md': strToU8('a'),
        'dir/': new Uint8Array(0),
        '__MACOSX/._a.md': strToU8('meta'),
        '.DS_Store': strToU8('meta'),
        'dir/.DS_Store': strToU8('meta'),
        'docs/.dial_folder': new Uint8Array(0),
      }),
    );

    expect(entries.map((entry) => entry.path)).toEqual(['a.md']);
  });

  it('returns unsafe paths as-is so batch validation can reject them', async () => {
    const entries = await extractSkillArchive(
      zipFile({ '../evil.sh': strToU8('rm -rf') }),
    );

    expect(entries.map((entry) => entry.path)).toEqual(['../evil.sh']);
  });

  it('rejects a file that is not a zip archive', async () => {
    await expect(
      extractSkillArchive(new File(['not a zip'], 'bundle.zip')),
    ).rejects.toThrow();
  });
});
