import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UploadFileDto } from '../dto/upload-file.dto';

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(UploadFileDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('UploadFileDto', () => {
  it('passes for valid bucket and path', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: 'folder/file.txt',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty bucket', async () => {
    const errors = await validateDto({ bucket: '', path: 'folder/file.txt' });
    expect(errors.some((e) => e.property === 'bucket')).toBe(true);
  });

  it('rejects bucket with slash', async () => {
    const errors = await validateDto({
      bucket: 'bad/bucket',
      path: 'folder/file.txt',
    });
    expect(errors.some((e) => e.property === 'bucket')).toBe(true);
  });

  it('rejects bucket with colon', async () => {
    const errors = await validateDto({
      bucket: 'bad:bucket',
      path: 'folder/file.txt',
    });
    expect(errors.some((e) => e.property === 'bucket')).toBe(true);
  });

  it('rejects path with ..', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: '../etc/passwd',
    });
    expect(errors.some((e) => e.property === 'path')).toBe(true);
  });

  it('rejects path starting with /', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: '/etc/passwd',
    });
    expect(errors.some((e) => e.property === 'path')).toBe(true);
  });

  it('strips extra fields (whitelist)', async () => {
    const instance = plainToInstance(UploadFileDto, {
      bucket: 'my-bucket',
      path: 'file.txt',
      admin: true,
    });
    const errors = await validate(instance, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(
      (instance as unknown as Record<string, unknown>)['admin'],
    ).toBeUndefined();
  });

  it('accepts bucket with dots and hyphens', async () => {
    const errors = await validateDto({
      bucket: 'my.bucket-01',
      path: 'file.txt',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts nested path segments', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: 'a/b/c/file.pdf',
    });
    expect(errors).toHaveLength(0);
  });
});
