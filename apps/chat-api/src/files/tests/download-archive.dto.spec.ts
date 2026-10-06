import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ArchiveItemNodeType,
  DownloadArchiveDto,
} from '../dto/download-archive.dto';

const validateItemName = async (name: string) => {
  const dto = plainToInstance(DownloadArchiveDto, {
    items: [
      {
        bucket: 'my-bucket',
        path: 'reports/q1.pdf',
        name,
        nodeType: ArchiveItemNodeType.Item,
      },
    ],
  });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
};

describe('DownloadArchiveDto item name', () => {
  it.each(['q1.pdf', 'reports', 'a..b', '.env', 'My report (1).docx'])(
    'accepts the single path segment %s',
    async (name) => {
      expect(await validateItemName(name)).toHaveLength(0);
    },
  );

  it.each([
    '../x',
    '..',
    '.',
    'a/b',
    'a\\b',
    '/etc',
    'bad\u0000name',
    'tab\tname',
  ])(
    'rejects %j, which would escape or split the archive entry',
    async (name) => {
      expect((await validateItemName(name)).length).toBeGreaterThan(0);
    },
  );
});
