import { describe, expect, it, vi } from 'vitest';
import { withApiErrorMapping } from '../map-api-error';

describe('withApiErrorMapping', () => {
  it('passes the arguments through and resolves with the result', async () => {
    const operation = vi.fn().mockResolvedValue('done');
    const mapError = vi.fn();

    await expect(
      withApiErrorMapping(operation, mapError)('a', 1),
    ).resolves.toBe('done');
    expect(operation).toHaveBeenCalledWith('a', 1);
    expect(mapError).not.toHaveBeenCalled();
  });

  it('rejects with the replacement the mapper builds', async () => {
    const replacement = new Error('typed');
    const wrapped = withApiErrorMapping(
      vi.fn().mockRejectedValue(new Error('raw')),
      async () => replacement,
    );

    await expect(wrapped()).rejects.toBe(replacement);
  });

  it('rethrows the original rejection when the mapper has no replacement', async () => {
    const original = new Error('raw');
    const wrapped = withApiErrorMapping(
      vi.fn().mockRejectedValue(original),
      async () => undefined,
    );

    await expect(wrapped()).rejects.toBe(original);
  });
});
