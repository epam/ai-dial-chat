import { describe, expect, it } from 'vitest';
import {
  decodeToolsetId,
  encodeToolsetId,
  isPublicToolsetId,
} from '../toolset-id';

describe('encodeToolsetId', () => {
  it('percent-encodes each segment but keeps / as a literal separator', () => {
    expect(encodeToolsetId('toolsets/b/My Toolset__1.0.0')).toBe(
      'toolsets/b/My%20Toolset__1.0.0',
    );
  });

  it('double-encodes an already-percent-encoded id (must only ever be called on the raw id)', () => {
    expect(encodeToolsetId('toolsets/b/My%20Toolset__1.0.0')).toBe(
      'toolsets/b/My%2520Toolset__1.0.0',
    );
  });

  it('is a no-op for an id with no reserved characters', () => {
    expect(encodeToolsetId('toolsets/b/my__1.0.0')).toBe(
      'toolsets/b/my__1.0.0',
    );
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

  it('treats an id in a user bucket as private', () => {
    expect(isPublicToolsetId('toolsets/bucket123/jira__1.0.0')).toBe(false);
  });

  it('returns false for an id that is not a toolset id', () => {
    expect(isPublicToolsetId('applications/public/app')).toBe(false);
  });

  it('returns false for a bucket that merely starts with "public"', () => {
    expect(isPublicToolsetId('toolsets/public-ish/jira')).toBe(false);
  });
});
