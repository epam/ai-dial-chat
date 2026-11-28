import { describe, expect, it } from 'vitest';
import {
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';

const LOCATOR = 'projects/z9y8x7/research/conversations/gpt-4o__Hi__1';

describe('qualifySessionConversationPath', () => {
  it.each([
    [
      'prefixes a session-relative path with the session bucket',
      { path: 'folder/x', bucket: 'a1b2c3', expected: 'a1b2c3/folder/x' },
    ],
    [
      'keeps a path that already starts with the session bucket',
      { path: 'a1b2c3/x', bucket: 'a1b2c3', expected: 'a1b2c3/x' },
    ],
    [
      'returns a project conversation locator unchanged',
      { path: LOCATOR, bucket: 'a1b2c3', expected: LOCATOR },
    ],
    [
      'still prefixes a path that only looks like a project folder',
      {
        path: 'projects/a/b/conversations/x/y',
        bucket: 'b1',
        expected: 'b1/projects/a/b/conversations/x/y',
      },
    ],
  ])('%s', (_name, { path, bucket, expected }) => {
    expect(qualifySessionConversationPath(path, bucket)).toBe(expected);
  });
});

describe('resolveConversationLocation', () => {
  it('splits a session-qualified path into bucket and sub-path', () => {
    expect(resolveConversationLocation('a1b2c3/folder/x', 'a1b2c3')).toEqual({
      bucket: 'a1b2c3',
      subPath: 'folder/x',
    });
  });

  it('passes a project conversation locator through with its own bucket', () => {
    expect(resolveConversationLocation(LOCATOR, 'a1b2c3')).toEqual({
      bucket: 'z9y8x7',
      subPath: LOCATOR,
    });
  });
});
