import { crc32 } from 'node:zlib';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { SkillsUploadService } from '../skills-upload.service';

const buildZipBuffer = (
  entries: Array<{ name: string; content?: string; isDirectory?: boolean }>,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const archive = archiver('zip', { store: true });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    for (const entry of entries) {
      if (entry.isDirectory) {
        archive.append('', { name: entry.name });
        continue;
      }
      archive.append(Buffer.from(entry.content ?? 'content'), {
        name: entry.name,
      });
    }
    void archive.finalize();
  });

/*
 * `archiver` sanitizes entry names (strips `..`/leading `/`) before writing,
 * so it cannot produce a zip-slip or duplicate-path fixture. This hand-rolls
 * a minimal, single central-directory-record-per-entry ZIP (stored,
 * uncompressed) with arbitrary raw entry names, mirroring
 * `apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts`'s
 * `buildRawZipBuffer`.
 */
const buildRawZipBuffer = (
  entries: Array<{ name: string; content?: string }>,
): Buffer => {
  const localEntries: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const { name, content = 'content' } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const contentBuf = Buffer.from(content, 'utf8');
    const crc = crc32(contentBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuf.length, 18);
    localHeader.writeUInt32LE(contentBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([localHeader, nameBuf, contentBuf]);
    localEntries.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuf.length, 20);
    centralHeader.writeUInt32LE(contentBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralEntries.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localEntries);
  const centralSection = Buffer.concat(centralEntries);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, eocd]);
};

const makeResponse = (
  status: number,
  headers: Record<string, string> = {},
): Response =>
  ({
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  }) as unknown as Response;

const makeService = (configOverrides: Record<string, unknown> = {}) => {
  const configService = {
    get: vi.fn((key: string) =>
      key in configOverrides ? configOverrides[key] : undefined,
    ),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient = {
    uploadSkillFolder: vi.fn(),
    uploadSkillFile: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;

  const service = new SkillsUploadService(dialClient, configService);
  return { service, sdkClient };
};

const zipFile = (buffer: Buffer) => ({ buffer, mimetype: 'application/zip' });

describe('SkillsUploadService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadSkill', () => {
    it('forwards a valid whole-skill ZIP and returns the new ETag', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"abc123"' }),
      });
      const buffer = await buildZipBuffer([
        { name: 'SKILL.md', content: 'name: test' },
        { name: 'scripts/helper.py' },
      ]);

      const result = await service.uploadSkill(
        'my-bucket',
        'team-a/docs-helper',
        zipFile(buffer),
        'token',
      );

      expect(result).toEqual({ etag: '"abc123"' });
      expect(sdkClient.uploadSkillFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('forwards the If-Match header when supplied', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200),
      });
      const buffer = await buildZipBuffer([{ name: 'SKILL.md' }]);

      await service.uploadSkill(
        'my-bucket',
        'team-a/docs-helper',
        zipFile(buffer),
        'token',
        '"prev-etag"',
      );

      expect(sdkClient.uploadSkillFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-Match': '"prev-etag"' }),
        }),
      );
    });

    it('rejects an archive missing a root SKILL.md', async () => {
      const { service, sdkClient } = makeService();
      const buffer = await buildZipBuffer([{ name: 'scripts/helper.py' }]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('rejects a path-traversal entry', async () => {
      const { service, sdkClient } = makeService();
      const buffer = buildRawZipBuffer([
        { name: 'SKILL.md' },
        { name: '../../etc/passwd' },
      ]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('rejects an entry using a reserved marker name', async () => {
      const { service, sdkClient } = makeService();
      const buffer = await buildZipBuffer([
        { name: 'SKILL.md' },
        { name: '.dial-resource' },
      ]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('rejects duplicate entry paths', async () => {
      const { service, sdkClient } = makeService();
      const buffer = buildRawZipBuffer([
        { name: 'SKILL.md', content: 'a' },
        { name: 'SKILL.md', content: 'b' },
      ]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('rejects an archive exceeding SKILL_UPLOAD_MAX_FILES with 422', async () => {
      const { service, sdkClient } = makeService({
        SKILL_UPLOAD_MAX_FILES: 1,
      });
      const buffer = await buildZipBuffer([
        { name: 'SKILL.md' },
        { name: 'extra.txt' },
      ]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('rejects a malformed ZIP with BadRequestException', async () => {
      const { service, sdkClient } = makeService();

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(Buffer.from('not a zip')),
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('maps a 412 precondition failure', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(412),
      });
      const buffer = await buildZipBuffer([{ name: 'SKILL.md' }]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow('Precondition failed');
    });

    it('maps 403 to ForbiddenException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(403),
      });
      const buffer = await buildZipBuffer([{ name: 'SKILL.md' }]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('maps a network/timeout failure to ServiceUnavailableException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockRejectedValue(
        Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
      );
      const buffer = await buildZipBuffer([{ name: 'SKILL.md' }]);

      await expect(
        service.uploadSkill(
          'my-bucket',
          'team-a/docs-helper',
          zipFile(buffer),
          'token',
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('uploadSkillFile', () => {
    const singleFile = {
      buffer: Buffer.from('print(1)'),
      mimetype: 'text/x-python',
    };

    it('uploads a single file and returns the new ETag', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFile.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"def456"' }),
      });

      const result = await service.uploadSkillFile(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        singleFile,
        'token',
      );

      expect(result).toEqual({ etag: '"def456"' });
      expect(sdkClient.uploadSkillFile).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('rejects an invalid filePath before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      await expect(
        service.uploadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          '../escape.py',
          singleFile,
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFile).not.toHaveBeenCalled();
    });

    it('rejects a file exceeding SKILL_FILE_UPLOAD_MAX_BYTES with 413', async () => {
      const { service, sdkClient } = makeService({
        SKILL_FILE_UPLOAD_MAX_BYTES: 4,
      });

      await expect(
        service.uploadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'scripts/helper.py',
          singleFile,
          'token',
        ),
      ).rejects.toThrow(PayloadTooLargeException);
      expect(sdkClient.uploadSkillFile).not.toHaveBeenCalled();
    });

    it('forwards the If-Match header when supplied', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFile.mockResolvedValue({
        error: undefined,
        response: makeResponse(200),
      });

      await service.uploadSkillFile(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        singleFile,
        'token',
        '"prev-etag"',
      );

      expect(sdkClient.uploadSkillFile).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-Match': '"prev-etag"' }),
        }),
      );
    });

    it('maps 404 to NotFoundException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFile.mockResolvedValue({
        error: true,
        response: makeResponse(404),
      });

      await expect(
        service.uploadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'scripts/helper.py',
          singleFile,
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
