import { describe, expect, it } from 'vitest';
import { decodeJsonFromBase64, encodeJsonToBase64 } from '../base64-json';

describe('encodeJsonToBase64 / decodeJsonFromBase64', () => {
  it('round-trips a plain object', () => {
    const value = { toolsetId: 'toolsets/public/t1', state: 'flow-1' };
    expect(
      decodeJsonFromBase64<typeof value>(encodeJsonToBase64(value)),
    ).toEqual(value);
  });

  it('round-trips arrays and nested values', () => {
    const value = {
      scopes: ['openid', 'offline_access'],
      nested: { retry: 2, enabled: true },
    };
    expect(
      decodeJsonFromBase64<typeof value>(encodeJsonToBase64(value)),
    ).toEqual(value);
  });

  it('round-trips non-Latin1 text that btoa alone cannot encode', () => {
    /*
     * `btoa` throws on characters above U+00FF; the UTF-8 path keeps any
     * user-named value encodable — a plain wrap would strand a caller that
     * already opened a popup or navigated.
     */
    const value = {
      toolsetId: 'инструменты/публичные/задача',
      label: '定期タスク',
    };
    expect(() => encodeJsonToBase64(value)).not.toThrow();
    expect(
      decodeJsonFromBase64<typeof value>(encodeJsonToBase64(value)),
    ).toEqual(value);
  });

  it('throws on a malformed stored value', () => {
    expect(() => decodeJsonFromBase64('not base64!')).toThrow();
  });

  it('throws on valid base64 that is not JSON', () => {
    expect(() => decodeJsonFromBase64(btoa('not json'))).toThrow();
  });
});
