import { describe, expect, it } from 'vitest';
import { parseResourceFolderPath } from '../resource-folder';

describe('parseResourceFolderPath', () => {
  it('returns the decoded folder segments between the bucket and the item', () => {
    expect(
      parseResourceFolderPath('applications/b1/My%20Design/Audit/agent__1.0.0'),
    ).toEqual(['My Design', 'Audit']);
  });

  it('returns an empty path for an item at the bucket root', () => {
    expect(parseResourceFolderPath('toolsets/b1/search__1.0.0')).toEqual([]);
  });

  it('returns an empty path for an id that is not a full resource id', () => {
    expect(parseResourceFolderPath('gpt-4')).toEqual([]);
  });

  it('keeps a segment that is not valid percent-encoding', () => {
    expect(parseResourceFolderPath('prompts/b1/100%/Summarize')).toEqual([
      '100%',
    ]);
  });
});
