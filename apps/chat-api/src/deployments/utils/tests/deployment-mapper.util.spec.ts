import { describe, expect, it } from 'vitest';
import type { RawDeploymentDto } from '../../dto/raw-deployment.dto';
import {
  mapToDeploymentItem,
  mapToolsetAuthSettings,
  redactApplicationFunctionEnv,
} from '../deployment-mapper.util';

const raw = (overrides: Partial<RawDeploymentDto>): RawDeploymentDto =>
  ({ id: 'gpt-4o', ...overrides }) as RawDeploymentDto;

describe('mapToDeploymentItem isFeatured', () => {
  it('marks a deployment featured by its id', () => {
    const item = mapToDeploymentItem(raw({}), new Set(['gpt-4o']), new Set());

    expect(item?.isFeatured).toBe(true);
  });

  it('marks a deployment featured by its reference when the id is not listed', () => {
    const item = mapToDeploymentItem(
      raw({ reference: 'gpt-4o-ref' }),
      new Set(['gpt-4o-ref']),
      new Set(),
    );

    expect(item?.isFeatured).toBe(true);
  });

  it('is not featured when neither id nor reference is listed', () => {
    const item = mapToDeploymentItem(
      raw({ reference: 'gpt-4o-ref' }),
      new Set(['other']),
      new Set(),
    );

    expect(item?.isFeatured).toBe(false);
  });
});

describe('mapToDeploymentItem viewerUrl', () => {
  const map = (overrides: Partial<RawDeploymentDto>) =>
    mapToDeploymentItem(raw(overrides), new Set(), new Set());

  it('exposes viewer_url for an application', () => {
    const item = map({
      object: 'application',
      viewer_url: 'https://viewer.example.com/',
    });

    expect(item?.viewerUrl).toBe('https://viewer.example.com/');
  });

  it('never exposes viewer_url for a model', () => {
    const item = map({ viewer_url: 'https://viewer.example.com/' });

    expect(item?.viewerUrl).toBeUndefined();
  });

  it('omits a missing or empty viewer_url', () => {
    expect(map({ object: 'application' })?.viewerUrl).toBeUndefined();
    expect(
      map({ object: 'application', viewer_url: '' })?.viewerUrl,
    ).toBeUndefined();
  });
});

describe('redactApplicationFunctionEnv', () => {
  it('drops function.env and keeps the other function fields', () => {
    const redacted = redactApplicationFunctionEnv({
      id: 'applications/my-app',
      function: { runtime: 'python3.11', env: { API_KEY: 'secret' } },
    });

    expect(redacted).toEqual({
      id: 'applications/my-app',
      function: { runtime: 'python3.11' },
    });
  });

  it('returns the value unchanged when there is no function.env', () => {
    const value = { id: 'applications/my-app', function: { runtime: 'x' } };

    expect(redactApplicationFunctionEnv(value)).toBe(value);
    expect(redactApplicationFunctionEnv(null)).toBeNull();
  });
});

describe('mapToolsetAuthSettings', () => {
  it('forwards the client secret hint unchanged and never the secret itself', () => {
    const mapped = mapToolsetAuthSettings({
      authentication_type: 'OAUTH',
      client_id: 'client-id',
      client_secret: 'super-secret',
      client_secret_hint: 'd4c6',
      code_verifier: 'verifier',
    });

    expect(mapped?.clientSecretHint).toBe('d4c6');
    expect(mapped).not.toHaveProperty('clientSecret');
    expect(mapped).not.toHaveProperty('codeVerifier');
    expect(JSON.stringify(mapped)).not.toContain('super-secret');
  });

  it('leaves the hint absent when DIAL Core sends none', () => {
    expect(
      mapToolsetAuthSettings({ authentication_type: 'OAUTH' })
        ?.clientSecretHint,
    ).toBeUndefined();
  });
});
