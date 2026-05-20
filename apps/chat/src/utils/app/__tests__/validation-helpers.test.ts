import { describe, expect, it } from 'vitest';

import { getEntityNameSchema } from '@/src/constants/validation-helpers';

describe('constants/validation-helpers.ts', () => {
  describe('getEntityNameSchema', () => {
    it('validates entity name by UTF-8 bytes', () => {
      const schema = getEntityNameSchema({
        name: 'Name',
        maxBytes: 6,
      });

      expect(schema.safeParse('я'.repeat(3)).success).toBe(true);
      expect(schema.safeParse('я'.repeat(4)).success).toBe(false);
    });

    it('supports byte validation in full segment context', () => {
      const schema = getEntityNameSchema({
        name: 'Name',
        maxBytes: 10,
        buildNameForByteValidation: (value) => `m__${value}`,
      });

      expect(schema.safeParse('тест').success).toBe(false);
      expect(schema.safeParse('ab').success).toBe(true);
    });
  });
});
