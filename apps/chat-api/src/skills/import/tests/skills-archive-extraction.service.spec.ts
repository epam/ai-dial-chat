import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import { describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { SkillsArchiveExtractionService } from '../skills-archive-extraction.service';

const VALID_MANIFEST =
  '---\nname: docs-helper\ndescription: Explains our docs\n---\n\nUse this skill to explain docs.\n';

interface ZipEntry {
  name: string;
  content?: string;
  symlinkTarget?: string;
}

const buildZipBuffer = (entries: ZipEntry[]): Promise<Buffer> =>
  new Promise((resolvePromise, reject) => {
    const archive = archiver('zip', { store: true, zlib: { level: 0 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end', () => resolvePromise(Buffer.concat(chunks)));
    for (const entry of entries) {
      if (entry.symlinkTarget != null) {
        archive.symlink(entry.name, entry.symlinkTarget);
      } else {
        archive.append(Buffer.from(entry.content ?? 'content'), {
          name: entry.name,
        });
      }
    }
    void archive.finalize();
  });

/**
 * Flips the encrypted bit (bit 0 of the general-purpose bit flag) in the
 * central directory header only — `SkillsArchiveExtractionService` rejects
 * encrypted entries purely from central-directory metadata, before ever
 * opening a read stream, so patching just that copy (and leaving the local
 * file header's actual compressed bytes untouched) exercises the rejection
 * without producing a stream yauzl would fail to decode.
 */
const markFirstEntryEncrypted = (buffer: Buffer): Buffer => {
  const patched = Buffer.from(buffer);
  const CENTRAL_SIGNATURE = 0x02014b50;
  for (let offset = 0; offset < patched.length - 4; offset += 1) {
    if (patched.readUInt32LE(offset) === CENTRAL_SIGNATURE) {
      const flagOffset = offset + 8;
      patched.writeUInt16LE(patched.readUInt16LE(flagOffset) | 0x1, flagOffset);
      break;
    }
  }
  return patched;
};

const withArchiveFile = async <T>(
  buffer: Buffer,
  run: (archivePath: string) => Promise<T>,
): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'skills-archive-import-'));
  const archivePath = join(directory, 'archive.zip');
  await writeFile(archivePath, buffer);
  try {
    return await run(archivePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const makeService = (
  configOverrides: Record<string, unknown> = {},
): SkillsArchiveExtractionService => {
  const configService = {
    get: (key: string) =>
      key in configOverrides ? configOverrides[key] : undefined,
  } as unknown as ConfigService<EnvironmentVariables>;
  return new SkillsArchiveExtractionService(configService);
};

describe('SkillsArchiveExtractionService', () => {
  it('extracts a well-formed archive', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'scripts/run.sh', content: '#!/bin/sh\necho hi\n' },
    ]);

    const result = await withArchiveFile(buffer, (path) =>
      service.extract(path),
    );

    expect(result.name).toBe('docs-helper');
    expect(result.skillManifest).toBe(VALID_MANIFEST);
    expect(result.filePaths).toEqual(['scripts/run.sh']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].buffer.toString()).toBe('#!/bin/sh\necho hi\n');
  });

  it('strips a single common wrapper directory', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'docs-helper/SKILL.md', content: VALID_MANIFEST },
      { name: 'docs-helper/scripts/run.sh', content: 'echo hi' },
    ]);

    const result = await withArchiveFile(buffer, (path) =>
      service.extract(path),
    );

    expect(result.filePaths).toEqual(['scripts/run.sh']);
  });

  it('rejects a corrupted archive', async () => {
    const service = makeService();
    const buffer = Buffer.from('this is not a zip file');

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a truncated archive', async () => {
    const service = makeService();
    const fullBuffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
    ]);
    const truncated = fullBuffer.subarray(0, fullBuffer.length - 10);

    await expect(
      withArchiveFile(truncated, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an archive with too many entries', async () => {
    const service = makeService({ SKILL_UPLOAD_MAX_FILES: 1 });
    const entries: ZipEntry[] = [{ name: 'SKILL.md', content: VALID_MANIFEST }];
    for (let i = 0; i < 20; i += 1) {
      entries.push({ name: `file-${i}.txt`, content: 'x' });
    }
    const buffer = await buildZipBuffer(entries);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects an archive with no SKILL.md', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'README.md', content: 'not a manifest' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an archive with multiple ambiguous top-level Skills', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'a/SKILL.md', content: VALID_MANIFEST },
      { name: 'b/SKILL.md', content: VALID_MANIFEST },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a mixed layout where files fall outside the wrapper', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'docs-helper/SKILL.md', content: VALID_MANIFEST },
      { name: 'outside.txt', content: 'stray file' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects duplicate normalized paths', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'SKILL.md', content: VALID_MANIFEST },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a path-traversal entry', async () => {
    const service = makeService();
    // archiver strips a *leading* `../` when writing an entry name, so the
    // traversal segment is placed after a safe first segment instead.
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'a/../../etc/passwd', content: 'evil' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reserved-segment path', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'files/x.txt', content: 'x' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a .dial-resource segment', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: '.dial-resource', content: 'x' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes directory entries from the file set', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'assets/' },
      { name: 'assets/icon.png', content: 'binarydata' },
    ]);

    const result = await withArchiveFile(buffer, (path) =>
      service.extract(path),
    );

    expect(result.filePaths).toEqual(['assets/icon.png']);
  });

  it('rejects an encrypted entry', async () => {
    const service = makeService();
    // Deflate (not `store`) compression, since yauzl's stored-file
    // size-consistency check (`compressedSize === uncompressedSize`) would
    // otherwise reject this synthetically-flagged entry for the wrong
    // reason before the encryption check is ever reached.
    const buffer = await new Promise<Buffer>((resolvePromise, reject) => {
      const archive = archiver('zip');
      const chunks: Buffer[] = [];
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('error', reject);
      archive.on('end', () => resolvePromise(Buffer.concat(chunks)));
      archive.append(Buffer.from(VALID_MANIFEST), { name: 'SKILL.md' });
      void archive.finalize();
    });
    const encryptedBuffer = markFirstEntryEncrypted(buffer);

    await expect(
      withArchiveFile(encryptedBuffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a symbolic link entry', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'link.txt', symlinkTarget: '/etc/passwd' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a per-file size over the configured limit', async () => {
    const service = makeService({ SKILL_FILE_UPLOAD_MAX_BYTES: 10 });
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'big.txt', content: 'x'.repeat(1000) },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects a total decompressed size over the configured limit', async () => {
    const service = makeService({
      SKILL_FILE_UPLOAD_MAX_BYTES: 10_000,
      SKILL_UPLOAD_MAX_TOTAL_BYTES: 100,
    });
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: VALID_MANIFEST },
      { name: 'a.txt', content: 'x'.repeat(80) },
      { name: 'b.txt', content: 'x'.repeat(80) },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects invalid UTF-8 in the manifest', async () => {
    const service = makeService();
    const invalidBuffer = await new Promise<Buffer>(
      (resolvePromise, reject) => {
        const archive = archiver('zip', { store: true, zlib: { level: 0 } });
        const chunks: Buffer[] = [];
        archive.on('data', (chunk: Buffer) => chunks.push(chunk));
        archive.on('error', reject);
        archive.on('end', () => resolvePromise(Buffer.concat(chunks)));
        archive.append(Buffer.from([0xff, 0xfe, 0xfd]), { name: 'SKILL.md' });
        void archive.finalize();
      },
    );

    await expect(
      withArchiveFile(invalidBuffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manifest with missing frontmatter', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      { name: 'SKILL.md', content: 'no frontmatter here' },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manifest with an empty name', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      {
        name: 'SKILL.md',
        content: '---\nname: ""\ndescription: Explains docs\n---\n\nBody',
      },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manifest with an empty description', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      {
        name: 'SKILL.md',
        content: '---\nname: docs-helper\ndescription: ""\n---\n\nBody',
      },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manifest name that is not a safe single path segment', async () => {
    const service = makeService();
    const buffer = await buildZipBuffer([
      {
        name: 'SKILL.md',
        content:
          '---\nname: "team/docs-helper"\ndescription: Explains docs\n---\n\nBody',
      },
    ]);

    await expect(
      withArchiveFile(buffer, (path) => service.extract(path)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
