import { promisify } from 'node:util';
import { brotliDecompress, gunzip } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  compressCelebrationBody,
  negotiateCelebrationEncoding,
} from '../response-encoding';
import {
  CelebrationContentEncoding,
  CelebrationMediaType,
} from '../types/celebration';

const JSON_TYPE = CelebrationMediaType.Json;

describe('negotiateCelebrationEncoding', () => {
  it.each([
    ['gzip, deflate, br', CelebrationContentEncoding.Brotli],
    ['gzip, br;q=0', CelebrationContentEncoding.Gzip],
    ['GZIP', CelebrationContentEncoding.Gzip],
    ['*', CelebrationContentEncoding.Brotli],
    ['br;q=0, *;q=0.5', CelebrationContentEncoding.Gzip],
    ['identity', undefined],
    ['gzip;q=0, br;q=0', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('chooses %j as %s for JSON', (header, expected) => {
    expect(negotiateCelebrationEncoding(header, JSON_TYPE)).toBe(expected);
  });

  it('compresses SVG', () => {
    expect(negotiateCelebrationEncoding('br', CelebrationMediaType.Svg)).toBe(
      CelebrationContentEncoding.Brotli,
    );
  });

  it.each([CelebrationMediaType.Png, CelebrationMediaType.Webp])(
    'serves %s as identity',
    (mediaType) => {
      expect(negotiateCelebrationEncoding('gzip, br', mediaType)).toBe(
        undefined,
      );
    },
  );
});

describe('compressCelebrationBody', () => {
  const body = Buffer.from(JSON.stringify({ layers: Array(200).fill('x') }));

  it('produces Brotli that decodes to the identity bytes', async () => {
    const encoded = await compressCelebrationBody(
      body,
      CelebrationContentEncoding.Brotli,
      11,
    );
    expect(encoded.length).toBeLessThan(body.length);
    expect((await promisify(brotliDecompress)(encoded)).equals(body)).toBe(
      true,
    );
  });

  it('produces gzip that decodes to the identity bytes', async () => {
    const encoded = await compressCelebrationBody(
      body,
      CelebrationContentEncoding.Gzip,
      11,
    );
    expect((await promisify(gunzip)(encoded)).equals(body)).toBe(true);
  });
});
