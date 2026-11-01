import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import {
  createDeploymentLookup,
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

describe.each([
  ['linear', findDeploymentByIdOrReference],
  [
    'indexed',
    (deployments: DeploymentItemDto[], id: string | null | undefined) =>
      createDeploymentLookup(deployments)(id),
  ],
])('deployment lookup (%s)', (_, findDeploymentByIdOrReference) => {
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

  it('matches an id regardless of percent-encoding', () => {
    const loopAgent = {
      id: 'applications/bucket/My%20Loop__1.0',
    } as DeploymentItemDto;
    expect(
      findDeploymentByIdOrReference(
        [gpt4o, loopAgent],
        'applications/bucket/My Loop__1.0',
      ),
    ).toBe(loopAgent);
  });

  it('prefers an exact reference match over an encoding-insensitive id match', () => {
    const encodedItem = { id: 'a%20b' } as DeploymentItemDto;
    const referencedItem = {
      id: 'other',
      reference: 'a b',
    } as DeploymentItemDto;
    expect(
      findDeploymentByIdOrReference([encodedItem, referencedItem], 'a b'),
    ).toBe(referencedItem);
  });

  it('returns undefined for null, undefined, or empty input', () => {
    expect(findDeploymentByIdOrReference(deployments, null)).toBeUndefined();
    expect(
      findDeploymentByIdOrReference(deployments, undefined),
    ).toBeUndefined();
    expect(findDeploymentByIdOrReference(deployments, '')).toBeUndefined();
  });
});

describe('createDeploymentLookup', () => {
  it('keeps the first match for duplicate ids, references and normalized ids', () => {
    const first = { id: 'a%20b', reference: 'ref' } as DeploymentItemDto;
    const duplicate = { id: 'a%20b', reference: 'ref' } as DeploymentItemDto;
    const raw = { id: 'a b' } as DeploymentItemDto;
    const lookup = createDeploymentLookup([first, duplicate, raw]);
    expect(lookup('a%20b')).toBe(first);
    expect(lookup('ref')).toBe(first);
    expect(lookup('a b')).toBe(raw);
    expect(lookup('a%20%62')).toBe(first);
  });

  it('does not scan deployment ids again for repeated missing or normalized lookups', () => {
    const readId = vi.fn(() => 'applications/bucket/My%20App__1.0');
    const deployment = {
      get id() {
        return readId();
      },
    } as DeploymentItemDto;
    const lookup = createDeploymentLookup([deployment]);
    readId.mockClear();

    expect(lookup('missing')).toBeUndefined();
    expect(lookup('applications/bucket/My App__1.0')).toBe(deployment);
    expect(lookup('another/missing')).toBeUndefined();
    expect(readId).not.toHaveBeenCalled();
  });

  it('uses the replacement deployment data when rebuilt for a changed list', () => {
    const original = { id: 'model', isHidden: false } as DeploymentItemDto;
    const replacement = { id: 'model', isHidden: true } as DeploymentItemDto;
    const lookup = createDeploymentLookup([original]);
    const nextLookup = createDeploymentLookup([replacement]);
    expect(lookup('model')).toBe(original);
    expect(nextLookup('model')).toBe(replacement);
  });
});
