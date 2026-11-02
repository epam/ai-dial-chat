import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UploadFileContentQueryDto } from '../dto/upload-file-content.dto';

const validateDto = async (plain: Record<string, unknown>) => {
  const instance = plainToInstance(UploadFileContentQueryDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('UploadFileContentQueryDto', () => {
  it('passes for a full valid query', async () => {
    const errors = await validateDto({
      bucket: 'Abc123',
      path: 'reports/q3.csv',
      uploadMode: 'create-only',
      contentType: 'text/csv',
    });
    expect(errors).toHaveLength(0);
  });

  it('passes without the optional contentType and uploadMode', async () => {
    const errors = await validateDto({ bucket: 'Abc123', path: 'file.bin' });
    expect(errors).toHaveLength(0);
  });

  it('accepts vendor MIME types with dots and plus signs', async () => {
    const errors = await validateDto({
      bucket: 'Abc123',
      path: 'deck.pptx',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['a parameter', 'text/csv; charset=x'],
    ['CR/LF', 'text/csv\r\nX-Injected: 1'],
    ['a quote', 'text/"csv"'],
    ['no subtype', 'text'],
    ['over 255 characters', `application/${'x'.repeat(250)}`],
  ])('rejects a contentType with %s', async (_label, contentType) => {
    const errors = await validateDto({
      bucket: 'Abc123',
      path: 'file.csv',
      contentType,
    });
    expect(errors.some((e) => e.property === 'contentType')).toBe(true);
  });

  it('rejects an invalid inherited bucket', async () => {
    const errors = await validateDto({
      bucket: 'bad/bucket',
      path: 'file.txt',
    });
    expect(errors.some((e) => e.property === 'bucket')).toBe(true);
  });

  it('rejects an invalid inherited path', async () => {
    const errors = await validateDto({
      bucket: 'Abc123',
      path: '../etc/passwd',
    });
    expect(errors.some((e) => e.property === 'path')).toBe(true);
  });

  it('rejects an unknown inherited uploadMode', async () => {
    const errors = await validateDto({
      bucket: 'Abc123',
      path: 'file.txt',
      uploadMode: 'append',
    });
    expect(errors.some((e) => e.property === 'uploadMode')).toBe(true);
  });

  it('rejects undeclared fields (forbidNonWhitelisted)', async () => {
    const errors = await validateDto({
      bucket: 'Abc123',
      path: 'file.txt',
      admin: true,
    });
    expect(errors.map((e) => e.constraints)).toContainEqual({
      whitelistValidation: 'property admin should not exist',
    });
  });
});
