import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthAdditionalParamsExchangeBody } from '../auth-additional-params';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/src/utils/server/logger', () => ({
  logger: mockLogger,
}));

describe('getAuthAdditionalParamsExchangeBody', () => {
  const originalValue = process.env.AUTH_ADDITIONAL_PARAMS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTH_ADDITIONAL_PARAMS;
  });

  afterAll(() => {
    process.env.AUTH_ADDITIONAL_PARAMS = originalValue;
  });

  it('returns undefined when AUTH_ADDITIONAL_PARAMS is not set', () => {
    expect(getAuthAdditionalParamsExchangeBody()).toBeUndefined();
  });

  it('merges the array of key/value objects into one exchange body', () => {
    process.env.AUTH_ADDITIONAL_PARAMS =
      '[{"organization_id":"org-1"},{"tenant_id":"tenant-1"}]';

    expect(getAuthAdditionalParamsExchangeBody()).toEqual({
      organization_id: 'org-1',
      tenant_id: 'tenant-1',
    });
  });

  it('stringifies number and boolean values', () => {
    process.env.AUTH_ADDITIONAL_PARAMS =
      '[{"feature_flag":true},{"retry_count":3}]';

    expect(getAuthAdditionalParamsExchangeBody()).toEqual({
      feature_flag: 'true',
      retry_count: '3',
    });
  });

  it('returns undefined and logs a warning when the parsed value is not an array', () => {
    process.env.AUTH_ADDITIONAL_PARAMS = '{"organization_id":"org-1"}';

    expect(getAuthAdditionalParamsExchangeBody()).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'AUTH_ADDITIONAL_PARAMS must be a JSON array of key/value objects',
    );
  });

  it('ignores invalid entries and keeps valid ones', () => {
    process.env.AUTH_ADDITIONAL_PARAMS =
      '[null,{"organization_id":"org-1"},{"nested":{"bad":true}},{"tenant_id":"tenant-1"}]';

    expect(getAuthAdditionalParamsExchangeBody()).toEqual({
      organization_id: 'org-1',
      tenant_id: 'tenant-1',
    });
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('returns undefined when the JSON is invalid', () => {
    process.env.AUTH_ADDITIONAL_PARAMS = '[{"organization_id":"org-1"}';

    expect(getAuthAdditionalParamsExchangeBody()).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('returns undefined when the array is empty', () => {
    process.env.AUTH_ADDITIONAL_PARAMS = '[]';

    expect(getAuthAdditionalParamsExchangeBody()).toBeUndefined();
  });

  it('parses escaped quotes from env var format', () => {
    process.env.AUTH_ADDITIONAL_PARAMS =
      '[{\\"organization_id\\":\\"org-1\\"}]';

    expect(getAuthAdditionalParamsExchangeBody()).toEqual({
      organization_id: 'org-1',
    });
  });

  it('returns undefined when all entries are invalid', () => {
    process.env.AUTH_ADDITIONAL_PARAMS = '[null,{"nested":{"bad":true}}]';

    expect(getAuthAdditionalParamsExchangeBody()).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('skips empty keys and keeps valid ones', () => {
    process.env.AUTH_ADDITIONAL_PARAMS =
      '[{"":"bad"},{"organization_id":"org-1"}]';

    expect(getAuthAdditionalParamsExchangeBody()).toEqual({
      organization_id: 'org-1',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'AUTH_ADDITIONAL_PARAMS entry at index 0 contains an empty key',
    );
  });

  it('uses the last value when duplicate keys appear across entries', () => {
    process.env.AUTH_ADDITIONAL_PARAMS =
      '[{"tenant_id":"first"},{"tenant_id":"second"}]';

    expect(getAuthAdditionalParamsExchangeBody()).toEqual({
      tenant_id: 'second',
    });
  });
});
