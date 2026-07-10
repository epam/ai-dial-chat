import { describe, expect, it } from 'vitest';
import { encodeDeploymentId } from '../deployment-id';

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
