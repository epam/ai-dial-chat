import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { SkillsManifestImportService } from '../skills-manifest-import.service';

const VALID_MANIFEST =
  '---\nname: docs-helper\ndescription: Explains our docs\n---\n\nUse this skill to explain docs.\n';

const withManifestFile = async <T>(
  content: Buffer,
  run: (manifestPath: string) => Promise<T>,
): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'skills-manifest-import-'));
  const manifestPath = join(directory, 'SKILL.md');
  await writeFile(manifestPath, content);
  try {
    return await run(manifestPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const makeService = (
  configOverrides: Record<string, unknown> = {},
): SkillsManifestImportService => {
  const configService = {
    get: (key: string) =>
      key in configOverrides ? configOverrides[key] : undefined,
  } as unknown as ConfigService<EnvironmentVariables>;
  return new SkillsManifestImportService(configService);
};

describe('SkillsManifestImportService', () => {
  it('extracts a valid standalone manifest', async () => {
    const service = makeService();
    const buffer = Buffer.from(VALID_MANIFEST);

    const result = await withManifestFile(buffer, (path) =>
      service.extract(path),
    );

    expect(result.name).toBe('docs-helper');
    expect(result.skillManifest).toBe(VALID_MANIFEST);
    /* SKILL.md travels as skillManifest, not as a filePaths/files entry —
     * SkillsPackageService rejects a SKILL.md entry in filePaths. */
    expect(result.filePaths).toEqual([]);
    expect(result.files).toEqual([]);
  });

  it('rejects an oversized manifest without reading its content', async () => {
    const service = makeService({ SKILL_FILE_UPLOAD_MAX_BYTES: 10 });
    const buffer = Buffer.from(VALID_MANIFEST);

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects invalid UTF-8', async () => {
    const service = makeService();
    const buffer = Buffer.from([0xff, 0xfe, 0xfd]);

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manifest with missing frontmatter', async () => {
    const service = makeService();
    const buffer = Buffer.from('no frontmatter here');

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manifest with malformed YAML frontmatter', async () => {
    const service = makeService();
    const buffer = Buffer.from('---\nname: [unterminated\n---\nbody');

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a blank name', async () => {
    const service = makeService();
    const buffer = Buffer.from('---\nname: "  "\ndescription: y\n---\n\nbody');

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a blank description', async () => {
    const service = makeService();
    const buffer = Buffer.from(
      '---\nname: docs-helper\ndescription: "  "\n---\n\nbody',
    );

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsafe derived name', async () => {
    const service = makeService();
    const buffer = Buffer.from(
      '---\nname: "../escape"\ndescription: y\n---\n\nbody',
    );

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty file', async () => {
    const service = makeService();
    const buffer = Buffer.from('');

    await expect(
      withManifestFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the abort signal is already aborted', async () => {
    const service = makeService();
    const buffer = Buffer.from(VALID_MANIFEST);
    const controller = new AbortController();
    controller.abort();

    await expect(
      withManifestFile(buffer, (path) =>
        service.extract(path, controller.signal),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
