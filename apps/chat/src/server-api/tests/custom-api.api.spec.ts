import { afterEach, describe, expect, it, vi } from 'vitest';
import { customApiApi } from '../api-client';
import { callCustomApiOperation } from '../custom-api.api';

const rawResponse = (body: unknown) =>
  ({
    raw: { json: async () => body },
  }) as unknown as Awaited<
    ReturnType<typeof customApiApi.getCustomApiOperationRaw>
  >;

describe('callCustomApiOperation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the generated Raw method with just the operation id', async () => {
    const spy = vi
      .spyOn(customApiApi, 'getCustomApiOperationRaw')
      .mockResolvedValue(rawResponse({ data: null }));

    await callCustomApiOperation('data-products');

    expect(spy).toHaveBeenCalledWith({ id: 'data-products' }, undefined);
  });

  it('forwards an AbortSignal for cancellation', async () => {
    const spy = vi
      .spyOn(customApiApi, 'getCustomApiOperationRaw')
      .mockResolvedValue(rawResponse({ data: null }));
    const controller = new AbortController();

    await callCustomApiOperation('data-products', controller.signal);

    expect(spy).toHaveBeenCalledWith(
      { id: 'data-products' },
      { signal: controller.signal },
    );
  });

  it.each([
    ['array', [1, 2, 3]],
    ['object', { id: '1', display_name: 'Display name' }],
    ['string', 'plain value'],
    ['number', 42],
    ['boolean', true],
    ['null', null],
  ])(
    'preserves a %s data value as unknown, unmodified',
    async (_label, value) => {
      vi.spyOn(customApiApi, 'getCustomApiOperationRaw').mockResolvedValue(
        rawResponse({ data: value }),
      );

      const result = await callCustomApiOperation('data-products');

      expect(result).toEqual(value);
    },
  );

  it('throws when the response has no data envelope', async () => {
    vi.spyOn(customApiApi, 'getCustomApiOperationRaw').mockResolvedValue(
      rawResponse({ notData: true }),
    );

    await expect(callCustomApiOperation('data-products')).rejects.toThrow(
      'Custom API response did not contain a data envelope',
    );
  });

  it('throws when the response body is not an object', async () => {
    vi.spyOn(customApiApi, 'getCustomApiOperationRaw').mockResolvedValue(
      rawResponse('not-an-object'),
    );

    await expect(callCustomApiOperation('data-products')).rejects.toThrow(
      'Custom API response did not contain a data envelope',
    );
  });

  it('propagates an unauthorized rejection from the generated client without retrying', async () => {
    const error = new Error('Unauthorized');
    const spy = vi
      .spyOn(customApiApi, 'getCustomApiOperationRaw')
      .mockRejectedValue(error);

    await expect(callCustomApiOperation('data-products')).rejects.toThrow(
      error,
    );
    expect(spy).toHaveBeenCalledOnce();
  });
});
