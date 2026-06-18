import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListFilesQueryDto } from '../dto/list-files.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(ListFilesQueryDto, plain);

const validateDto = async (plain: Record<string, unknown>) => {
  const dto = toDto(plain);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
};

describe('ListFilesQueryDto', () => {
  it('passes with bucket only (all optional fields absent)', async () => {
    const errors = await validateDto({ bucket: 'my-bucket' });
    expect(errors).toHaveLength(0);
  });

  it('passes with empty path', async () => {
    const errors = await validateDto({ bucket: 'my-bucket', path: '' });
    expect(errors).toHaveLength(0);
  });

  it('passes with all optional fields provided', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: 'reports/',
      token: 'cursor-abc',
      limit: '100',
      recursive: 'true',
      permissions: 'false',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects bucket with slash', async () => {
    const errors = await validateDto({ bucket: 'my/bucket' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('bucket');
  });

  it('rejects bucket with colon', async () => {
    const errors = await validateDto({ bucket: 'my:bucket' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('bucket');
  });

  it('passes path with spaces and parentheses', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: 'asdasd (1) (1)/',
    });
    expect(errors).toHaveLength(0);
  });

  it('passes path with percent-encoded spaces', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: 'asdasd%20(1)%20(1)/',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects path with ..', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: '../../etc/passwd',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('path');
  });

  it('rejects path with leading /', async () => {
    const errors = await validateDto({
      bucket: 'my-bucket',
      path: '/folder',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('path');
  });

  it('rejects limit=0', async () => {
    const errors = await validateDto({ bucket: 'my-bucket', limit: '0' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('rejects limit=1001', async () => {
    const errors = await validateDto({ bucket: 'my-bucket', limit: '1001' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('passes limit=1', async () => {
    const errors = await validateDto({ bucket: 'my-bucket', limit: '1' });
    expect(errors).toHaveLength(0);
  });

  it('passes limit=1000', async () => {
    const errors = await validateDto({ bucket: 'my-bucket', limit: '1000' });
    expect(errors).toHaveLength(0);
  });

  it('treats permissions=false as false', async () => {
    const dto = toDto({ bucket: 'my-bucket', permissions: 'false' });
    await validate(dto, { whitelist: true });
    expect(dto.permissions).toBe(false);
  });

  it('treats permissions=true as true', async () => {
    const dto = toDto({ bucket: 'my-bucket', permissions: 'true' });
    await validate(dto, { whitelist: true });
    expect(dto.permissions).toBe(true);
  });

  it('treats permissions=0 as false (not true)', async () => {
    const dto = toDto({ bucket: 'my-bucket', permissions: '0' });
    await validate(dto, { whitelist: true });
    expect(dto.permissions).toBe(false);
  });

  it('strips extra fields (whitelist)', async () => {
    const dto = toDto({
      bucket: 'my-bucket',
      unknownField: 'should-be-stripped',
    });
    await validate(dto, { whitelist: true });
    expect(
      (dto as unknown as Record<string, unknown>)['unknownField'],
    ).toBeUndefined();
  });
});
