import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { SkillsPackageService } from '../skills-package.service';

const makeFile = (content: string, mimetype = 'text/plain') => ({
  buffer: Buffer.from(content),
  mimetype,
});

describe('SkillsPackageService', () => {
  let service: SkillsPackageService;
  let configOverrides: Record<string, unknown>;

  beforeEach(() => {
    configOverrides = {};
    const configService = {
      get: (key: string) => configOverrides[key],
    } as unknown as ConfigService<EnvironmentVariables>;
    service = new SkillsPackageService(configService);
  });

  const manifest = '---\nname: x\ndescription: y\n---\n\nz';

  it('builds one file part per entry with SKILL.md first and exact filenames', async () => {
    const formData = service.validateAndBuildFormData(
      manifest,
      JSON.stringify(['scripts/run.sh', 'assets/icon.png']),
      [makeFile('run'), makeFile('icon', 'image/png')],
    );

    const parts = formData.getAll('file') as File[];
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.name)).toEqual([
      'SKILL.md',
      'scripts/run.sh',
      'assets/icon.png',
    ]);
    expect(await parts[0].text()).toBe(manifest);
    expect(await parts[1].text()).toBe('run');
  });

  it('never includes a ZIP-shaped part — only raw manifest/file bytes', async () => {
    const formData = service.validateAndBuildFormData(
      manifest,
      JSON.stringify(['scripts/run.sh']),
      [makeFile('run')],
    );

    const parts = formData.getAll('file') as File[];
    for (const part of parts) {
      const bytes = new Uint8Array(await part.arrayBuffer());
      // ZIP local file header signature is 0x50 0x4b 0x03 0x04 ("PK\x03\x04").
      expect(
        bytes[0] === 0x50 &&
          bytes[1] === 0x4b &&
          bytes[2] === 0x03 &&
          bytes[3] === 0x04,
      ).toBe(false);
    }
  });

  it('rejects an empty skillManifest', () => {
    expect(() =>
      service.validateAndBuildFormData('', JSON.stringify([]), []),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed filePaths JSON', () => {
    expect(() =>
      service.validateAndBuildFormData(manifest, 'not json', []),
    ).toThrow(BadRequestException);
  });

  it('rejects filePaths that is not an array of strings', () => {
    expect(() =>
      service.validateAndBuildFormData(manifest, JSON.stringify([1, 2]), []),
    ).toThrow(BadRequestException);
  });

  it('rejects a filePaths/files count mismatch', () => {
    expect(() =>
      service.validateAndBuildFormData(
        manifest,
        JSON.stringify(['a.md', 'b.md']),
        [makeFile('a')],
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a path traversal entry', () => {
    expect(() =>
      service.validateAndBuildFormData(manifest, JSON.stringify(['../a.md']), [
        makeFile('a'),
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a reserved marker entry', () => {
    expect(() =>
      service.validateAndBuildFormData(
        manifest,
        JSON.stringify(['.dial-resource']),
        [makeFile('a')],
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a duplicate supporting path', () => {
    expect(() =>
      service.validateAndBuildFormData(
        manifest,
        JSON.stringify(['a.md', 'a.md']),
        [makeFile('a'), makeFile('a')],
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects SKILL.md as a supporting path', () => {
    expect(() =>
      service.validateAndBuildFormData(manifest, JSON.stringify(['SKILL.md']), [
        makeFile('a'),
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects when file count (including the manifest) exceeds the limit', () => {
    configOverrides['SKILL_UPLOAD_MAX_FILES'] = 1;
    expect(() =>
      service.validateAndBuildFormData(manifest, JSON.stringify(['a.md']), [
        makeFile('a'),
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects when a single file exceeds the per-file byte limit', () => {
    configOverrides['SKILL_FILE_UPLOAD_MAX_BYTES'] = 2;
    expect(() =>
      service.validateAndBuildFormData(manifest, JSON.stringify(['a.md']), [
        makeFile('too-long'),
      ]),
    ).toThrow(PayloadTooLargeException);
  });

  it('rejects when total content exceeds the total byte limit', () => {
    configOverrides['SKILL_UPLOAD_MAX_TOTAL_BYTES'] = manifest.length;
    expect(() =>
      service.validateAndBuildFormData(manifest, JSON.stringify(['a.md']), [
        makeFile('a'),
      ]),
    ).toThrow(PayloadTooLargeException);
  });
});
