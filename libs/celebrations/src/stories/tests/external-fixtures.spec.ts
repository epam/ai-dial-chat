import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_GIFT_WRAPPING_ASSETS } from '../../test-utils/external-gift-wrapping';

const readFixture = (file: string) =>
  readFileSync(join(import.meta.dirname, '../fixtures/external', file));

describe('pinned external GiftWrapping fixtures', () => {
  it.each(Object.entries(EXTERNAL_GIFT_WRAPPING_ASSETS))(
    'keeps the published %s asset byte for byte',
    (_variant, asset) => {
      const bytes = readFixture(asset.file);

      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        asset.sha256,
      );
      expect(asset.assetId.endsWith(asset.sha256.slice(0, 16))).toBe(true);
    },
  );
});
