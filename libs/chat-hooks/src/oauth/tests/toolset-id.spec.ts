import { describe, expect, it } from 'vitest';
import {
  decodeToolsetId,
  encodeToolsetId,
  getToolsetFallbackName,
  isPublicToolsetId,
} from '../toolset-id';

describe('encodeToolsetId', () => {
  it.each([
    [
      'percent-encodes each segment but keeps / as a literal separator',
      {
        id: 'toolsets/b/My Toolset__1.0.0',
        expected: 'toolsets/b/My%20Toolset__1.0.0',
      },
    ],
    [
      'double-encodes an already-percent-encoded id (must only ever be called on the raw id)',
      {
        id: 'toolsets/b/My%20Toolset__1.0.0',
        expected: 'toolsets/b/My%2520Toolset__1.0.0',
      },
    ],
    [
      'is a no-op for an id with no reserved characters',
      { id: 'toolsets/b/my__1.0.0', expected: 'toolsets/b/my__1.0.0' },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(encodeToolsetId(id)).toBe(expected);
  });
});

describe('decodeToolsetId', () => {
  it('round-trips a raw id through encodeToolsetId and back', () => {
    const raw = 'toolsets/b/My Toolset__1.0.0';
    expect(decodeToolsetId(encodeToolsetId(raw))).toBe(raw);
  });

  it('passes a malformed percent-encoded segment through unchanged', () => {
    expect(decodeToolsetId('toolsets/b/My%2Toolset')).toBe(
      'toolsets/b/My%2Toolset',
    );
  });
});

describe('isPublicToolsetId', () => {
  it('treats an id in the public bucket as public', () => {
    expect(isPublicToolsetId('toolsets/public/jira__1.0.0')).toBe(true);
  });

  it.each([
    [
      'treats an id in a user bucket as private',
      { id: 'toolsets/bucket123/jira__1.0.0' },
    ],
    [
      'returns false for an id that is not a toolset id',
      { id: 'applications/public/app' },
    ],
    [
      'returns false for a bucket that merely starts with "public"',
      { id: 'toolsets/public-ish/jira' },
    ],
  ])('%s', (_name, { id }) => {
    expect(isPublicToolsetId(id)).toBe(false);
  });
});

describe('getToolsetFallbackName', () => {
  it('returns the decoded last segment without its version suffix', () => {
    expect(getToolsetFallbackName('toolsets/bucket/My%20Toolset__1.0.0')).toBe(
      'My Toolset',
    );
  });

  it('keeps a segment that is not valid percent-encoding as is', () => {
    expect(getToolsetFallbackName('toolsets/bucket/100%__2')).toBe('100%');
  });
});
