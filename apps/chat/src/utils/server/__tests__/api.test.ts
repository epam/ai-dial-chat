import { ServerSlugs } from '@/src/types/slugs-types';

import { decodeModelId, encodeModelId, getOpsApiUrl } from '../api';

describe('decodeModelId and encodeModelId', () => {
  it.each([
    'gpt_4',
    'gpt__4',
    'gpt%5F%5F4',
    `gpt${encodeURI('%5F%5F')}4`,
    'gpt-4o',
  ])('decodeModelId(encodeModelId(%s))', (path: string) => {
    expect(decodeModelId(encodeModelId(path))).toBe(path);
  });
});

describe('getOpsApiUrl', () => {
  it('should generate correct ops api url with single param', () => {
    expect(getOpsApiUrl(ServerSlugs.APPLICATION_DEPLOY, 'test-app')).toBe(
      '/api/ops/application/deploy/test-app',
    );
  });

  it('should generate correct ops api url with multiple params', () => {
    expect(
      getOpsApiUrl(ServerSlugs.PUBLICATION_CREATE, 'test-app', 'v1', 'prod'),
    ).toBe('/api/ops/publication/create/test-app/v1/prod');
  });

  it('should generate correct ops api url with no params', () => {
    expect(getOpsApiUrl(ServerSlugs.PUBLICATION_UPDATE)).toBe(
      '/api/ops/publication/update',
    );
  });

  it('should handle empty string params', () => {
    expect(getOpsApiUrl(ServerSlugs.PUBLICATION_GET, '')).toBe(
      '/api/ops/publication/get',
    );
  });

  it('should handle special characters in params', () => {
    expect(
      getOpsApiUrl(ServerSlugs.PUBLICATION_REJECT, 'test app', 'v1.0.0'),
    ).toBe('/api/ops/publication/reject/test app/v1.0.0');
  });
});
