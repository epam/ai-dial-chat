import { describe, expect, it } from 'vitest';
import type { RawDeploymentDto } from '../../dto/raw-deployment.dto';
import {
  mapToDeploymentItem,
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
