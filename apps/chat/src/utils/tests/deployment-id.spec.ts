import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  encodeDeploymentId,
  findDeploymentByIdOrReference,
} from '../deployment-id';

describe('encodeDeploymentId', () => {
  it('percent-encodes spaces within a segment', () => {
    expect(encodeDeploymentId('applications/bucket/My App__1.0')).toBe(
      'applications/bucket/My%20App__1.0',
    );
  });

  it('leaves already-safe segments unchanged', () => {
    expect(encodeDeploymentId('applications/bucket/my-app__1.0')).toBe(
      'applications/bucket/my-app__1.0',
    );
  });

  it('keeps `/` as a literal path separator', () => {
    const result = encodeDeploymentId('applications/bucket/My App__1.0');
    expect(result.split('/')).toHaveLength(3);
  });

  it('encodes special characters within a segment', () => {
    expect(encodeDeploymentId('applications/bucket/Q&A App__1.0')).toBe(
      'applications/bucket/Q%26A%20App__1.0',
    );
  });
});

describe('findDeploymentByIdOrReference', () => {
  const gpt4o = { id: 'gpt-4o' } as DeploymentItemDto;
  const gemini = {
    id: 'gemini-3.1-flash-lite',
    reference: 'ref-gemini-3-1-flash-lite',
  } as DeploymentItemDto;
  const deployments = [gpt4o, gemini];

  it('resolves by id', () => {
    expect(findDeploymentByIdOrReference(deployments, 'gpt-4o')).toBe(gpt4o);
  });

  it('falls back to reference when id does not match', () => {
    expect(
      findDeploymentByIdOrReference(deployments, 'ref-gemini-3-1-flash-lite'),
    ).toBe(gemini);
  });

  it('returns undefined when neither id nor reference matches', () => {
    expect(
      findDeploymentByIdOrReference(deployments, 'unknown-value'),
    ).toBeUndefined();
  });

  it('prefers an id match over a reference match on a different item', () => {
    const itemWithReferenceX = {
      id: 'other',
      reference: 'x',
    } as DeploymentItemDto;
    const itemWithIdX = { id: 'x' } as DeploymentItemDto;
    expect(
      findDeploymentByIdOrReference([itemWithReferenceX, itemWithIdX], 'x'),
    ).toBe(itemWithIdX);
  });

  it('returns undefined for null, undefined, or empty input', () => {
    expect(findDeploymentByIdOrReference(deployments, null)).toBeUndefined();
    expect(
      findDeploymentByIdOrReference(deployments, undefined),
    ).toBeUndefined();
    expect(findDeploymentByIdOrReference(deployments, '')).toBeUndefined();
  });
});
