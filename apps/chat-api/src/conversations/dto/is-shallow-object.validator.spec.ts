import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsShallowObject } from './is-shallow-object.validator';

class ShallowObjectTestDto {
  @IsShallowObject({ maxDepth: 2, maxKeys: 3 })
  obj?: Record<string, unknown>;
}

const run = async (value: unknown): Promise<boolean> => {
  const dto = new ShallowObjectTestDto();
  (dto as { obj: unknown }).obj = value;
  const errors = await validate(dto);
  return errors.length === 0;
};

describe('IsShallowObject', () => {
  describe('null and non-object values pass through', () => {
    it('passes for null', async () => {
      expect(await run(null)).toBe(true);
    });

    it('passes for undefined', async () => {
      expect(await run(undefined)).toBe(true);
    });

    it('passes for a number', async () => {
      expect(await run(42)).toBe(true);
    });
  });

  describe('depth bounds (maxDepth: 2)', () => {
    it('passes for a flat object (depth 1)', async () => {
      expect(await run({ a: 1 })).toBe(true);
    });

    it('passes for a one-level-nested object (depth 2, exactly at the limit)', async () => {
      expect(await run({ a: { b: 1 } })).toBe(true);
    });

    it('fails for a two-level-nested object (depth 3, exceeds maxDepth)', async () => {
      expect(await run({ a: { b: { c: 1 } } })).toBe(false);
    });
  });

  describe('key count bounds (maxKeys: 3)', () => {
    it('passes when the total key count is exactly at the limit', async () => {
      expect(await run({ a: 1, b: 2, c: 3 })).toBe(true);
    });

    it('fails when the flat key count exceeds the limit', async () => {
      expect(await run({ a: 1, b: 2, c: 3, d: 4 })).toBe(false);
    });

    it('counts keys at every nesting level toward the total', async () => {
      /* a (1) + b (1) + c nested inside b (1) = 3 — passes */
      expect(await run({ a: 1, b: { c: 1 } })).toBe(true);
      /* a (1) + b (1) + c nested inside b (1) + d (1) = 4 — fails */
      expect(await run({ a: 1, b: { c: 1 }, d: 2 })).toBe(false);
    });
  });

  describe('validation error message', () => {
    it('references both the depth limit and the key limit in the message', async () => {
      const dto = new ShallowObjectTestDto();
      (dto as { obj: unknown }).obj = { a: { b: { c: 1 } } };
      const errors = await validate(dto);
      const message = errors[0]?.constraints?.['isShallowObject'] ?? '';
      expect(message).toMatch(/2/);
      expect(message).toMatch(/3/);
    });
  });
});
