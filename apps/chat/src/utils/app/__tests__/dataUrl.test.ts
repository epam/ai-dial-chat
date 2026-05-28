import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dataToBlobUrl } from '../dataUrl';

describe('utils/app/dataUrl.ts', () => {
  const originalAtob = globalThis.atob;
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.atob = originalAtob;
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('returns null for data url without separator', () => {
    expect(dataToBlobUrl('data:image/png;base64abc')).toBeNull();
  });

  it('returns null for data url with empty payload', () => {
    expect(dataToBlobUrl('data:image/png;base64,')).toBeNull();
  });

  it('returns null when payload is not valid base64', () => {
    globalThis.atob = vi.fn(() => {
      throw new Error('invalid base64');
    }) as typeof atob;

    expect(dataToBlobUrl('data:image/png;base64,not-base64')).toBeNull();
  });

  it('returns object url for valid base64 payload', () => {
    globalThis.atob = vi.fn(() => 'abc') as typeof atob;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    const result = dataToBlobUrl('data:image/png;base64,YWJj');

    expect(result).toBe('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(globalThis.atob).toHaveBeenCalledWith('YWJj');
  });
});
