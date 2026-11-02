import { describe, expect, it } from 'vitest';
import {
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';

const LOCATOR = 'projects/z9y8x7/research/conversations/gpt-4o__Hi__1';

describe('qualifySessionConversationPath', () => {
  it('prefixes a session-relative path with the session bucket', () => {
    expect(qualifySessionConversationPath('folder/x', 'a1b2c3')).toBe(
      'a1b2c3/folder/x',
    );
  });

  it('keeps a path that already starts with the session bucket', () => {
    expect(qualifySessionConversationPath('a1b2c3/x', 'a1b2c3')).toBe(
      'a1b2c3/x',
    );
  });

  it('returns a project conversation locator unchanged', () => {
    expect(qualifySessionConversationPath(LOCATOR, 'a1b2c3')).toBe(LOCATOR);
  });

  it('still prefixes a path that only looks like a project folder', () => {
    expect(
      qualifySessionConversationPath('projects/a/b/conversations/x/y', 'b1'),
    ).toBe('b1/projects/a/b/conversations/x/y');
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
