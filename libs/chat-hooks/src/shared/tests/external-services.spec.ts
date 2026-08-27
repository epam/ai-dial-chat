import { describe, expect, it } from 'vitest';
import {
  buildExternalServiceScopeId,
  getExternalServiceFallbackName,
  parseExternalServiceUrl,
} from '../external-services';

describe('parseExternalServiceUrl', () => {
  it('splits appId and serviceName on /external_services/', () => {
    expect(
      parseExternalServiceUrl(
        'applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2',
      ),
    ).toEqual({
      appId: 'applications/public/finhub-via-openapi__1.0.0',
      serviceName: 'finhub-api2',
    });
  });

  it('returns null when there is no external_services segment', () => {
    expect(
      parseExternalServiceUrl('applications/public/my-app__1.0'),
    ).toBeNull();
  });

  it('returns null when appId or serviceName would be empty', () => {
    expect(parseExternalServiceUrl('/external_services/svc')).toBeNull();
    expect(parseExternalServiceUrl('app/external_services/')).toBeNull();
  });

  it('splits on the first occurrence when the segment name repeats', () => {
    expect(
      parseExternalServiceUrl(
        'applications/external_services/nested/external_services/svc',
      ),
    ).toEqual({
      appId: 'applications',
      serviceName: 'nested/external_services/svc',
    });
  });
});

describe('buildExternalServiceScopeId', () => {
  it('reconstructs the exact original scope id', () => {
    expect(
      buildExternalServiceScopeId(
        'applications/public/finhub-via-openapi__1.0.0',
        'finhub-api2',
      ),
    ).toBe(
      'applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2',
    );
  });
});

describe('getExternalServiceFallbackName', () => {
  it('percent-decodes the service name', () => {
    expect(getExternalServiceFallbackName('finhub%20api')).toBe('finhub api');
  });

  it('returns the raw name when decoding fails', () => {
    expect(getExternalServiceFallbackName('100%')).toBe('100%');
  });
});
