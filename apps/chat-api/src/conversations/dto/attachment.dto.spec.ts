import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AttachmentDto } from './attachment.dto';

const makeDto = (overrides: Partial<AttachmentDto> = {}): AttachmentDto => {
  const dto = new AttachmentDto();
  Object.assign(dto, { type: 'image/png', title: 'photo', ...overrides });
  return dto;
};

const isValid = async (dto: AttachmentDto): Promise<boolean> =>
  (await validate(dto)).length === 0;

describe('AttachmentDto', () => {
  describe('type — MIME @Matches validation', () => {
    it.each([
      'image/png',
      'image/jpeg',
      'application/json',
      'text/plain',
      'IMAGE/PNG',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ])('accepts the bare MIME type %s', async (type) => {
      expect(await isValid(makeDto({ type }))).toBe(true);
    });

    it.each([
      'text/plain; charset=utf-8',
      'image/png;charset=utf-8',
      'application/json; charset=utf-8',
      'multipart/form-data; boundary=----WebKitFormBoundary',
    ])('accepts the parameterized MIME type %s', async (type) => {
      expect(await isValid(makeDto({ type }))).toBe(true);
    });

    it('rejects a MIME type containing a comma (corrupts the data: URI data separator)', async () => {
      expect(await isValid(makeDto({ type: 'image/png,text/html' }))).toBe(false);
    });

    it.each([
      '',
      'image/',
      '/png',
      'image png',
    ])('rejects the structurally invalid MIME type %s', async (type) => {
      expect(await isValid(makeDto({ type }))).toBe(false);
    });
  });

  describe('DTO validation boundaries', () => {
    it('accepts a complete valid attachment with an HTTPS URL', async () => {
      expect(await isValid(makeDto({ url: 'https://example.com/img.png' }))).toBe(true);
    });

    it('accepts a DIAL file URL', async () => {
      expect(await isValid(makeDto({ url: 'files/bucket/file.txt' }))).toBe(true);
    });

    it('accepts an attachment with only inline base64 data', async () => {
      expect(await isValid(makeDto({ data: 'abc123' }))).toBe(true);
    });

    it('accepts when neither data nor url is provided (both are optional)', async () => {
      expect(await isValid(makeDto())).toBe(true);
    });

    it('rejects when type is missing', async () => {
      const dto = new AttachmentDto();
      Object.assign(dto, { title: 'photo' });
      expect(await isValid(dto)).toBe(false);
    });

    it('rejects when title is missing', async () => {
      const dto = new AttachmentDto();
      Object.assign(dto, { type: 'image/png' });
      expect(await isValid(dto)).toBe(false);
    });

    it('rejects an HTTP URL (only HTTPS is accepted for remote URLs)', async () => {
      expect(await isValid(makeDto({ url: 'http://example.com/img.png' }))).toBe(false);
    });

    it('rejects a DIAL file path containing a directory traversal segment', async () => {
      expect(await isValid(makeDto({ url: 'files/bucket/../etc/passwd' }))).toBe(false);
    });
  });
});
