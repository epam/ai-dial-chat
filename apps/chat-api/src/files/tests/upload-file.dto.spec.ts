import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UploadFileDto } from '../dto/upload-file.dto';

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(UploadFileDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('UploadFileDto', () => {
  it.each([
    [
      'passes for valid bucket and path',
      { bucket: 'my-bucket', path: 'folder/file.txt' },
    ],
    [
      'accepts bucket with dots and hyphens',
      { bucket: 'my.bucket-01', path: 'file.txt' },
    ],
    [
      'accepts nested path segments',
      { bucket: 'my-bucket', path: 'a/b/c/file.pdf' },
    ],
  ])('%s', async (_name, body) => {
    const errors = await validateDto(body);
    expect(errors).toHaveLength(0);
  });

  it.each([
    [
      'rejects empty bucket',
      { body: { bucket: '', path: 'folder/file.txt' }, property: 'bucket' },
    ],
    [
      'rejects bucket with slash',
      {
        body: { bucket: 'bad/bucket', path: 'folder/file.txt' },
        property: 'bucket',
      },
    ],
    [
      'rejects bucket with colon',
      {
        body: { bucket: 'bad:bucket', path: 'folder/file.txt' },
        property: 'bucket',
      },
    ],
    [
      'rejects path with ..',
      {
        body: { bucket: 'my-bucket', path: '../etc/passwd' },
        property: 'path',
      },
    ],
    [
      'rejects path starting with /',
      { body: { bucket: 'my-bucket', path: '/etc/passwd' }, property: 'path' },
    ],
    [
      'rejects a path containing &',
      {
        body: {
          bucket: 'my-bucket',
          path: 'Metrology&UnitConversionPresentation(1).pptx',
        },
        property: 'path',
      },
    ],
  ])('%s', async (_name, { body, property }) => {
    const errors = await validateDto(body);
    expect(errors.some((e) => e.property === property)).toBe(true);
  });

  it('rejects undeclared fields (forbidNonWhitelisted)', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: 'file.txt',
      admin: true,
    });
    expect(errors.map((e) => e.constraints)).toContainEqual({
      whitelistValidation: 'property admin should not exist',
    });
  });
});
