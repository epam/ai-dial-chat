import { describe, expect, it } from 'vitest';
import {
  getPublicTargetFolder,
  getPublishedTargetUrl,
  getResourceName,
  getResourceTypePrefix,
  stripPublicTargetFolder,
} from '../publish-target.util';

/*
 * `getPublishedTargetUrl` is the single derivation shared by catalog
 * publish/unpublish and conversation publish/unpublish. A DELETE resource
 * whose `targetUrl` does not match the published copy removes nothing and
 * still gets accepted, so these assert the exact strings rather than a shape.
 */
describe('getPublishedTargetUrl', () => {
  it('targets the public root when folderPath is empty', () => {
    expect(getPublishedTargetUrl('toolsets', '', 'tool-abc123__1.2.0')).toBe(
      'toolsets/public/tool-abc123__1.2.0',
    );
  });

  it('percent-encodes a folder name containing spaces', () => {
    expect(
      getPublishedTargetUrl('applications', 'Organization/Data Science', 'app'),
    ).toBe('applications/public/Organization/Data%20Science/app');
  });

  it('percent-encodes a non-ASCII folder name', () => {
    expect(getPublishedTargetUrl('prompts', 'test 14.04/Ünïcode', 'p')).toBe(
      'prompts/public/test%2014.04/%C3%9Cn%C3%AFcode/p',
    );
  });

  it('keeps a nested skill grouping folder intact', () => {
    expect(
      getPublishedTargetUrl(
        'skills',
        'Organization/Data Science/Published models',
        'skill-a',
      ),
    ).toBe(
      'skills/public/Organization/Data%20Science/Published%20models/skill-a',
    );
  });

  /*
   * Issue #8974: the folder's plain name really contains `%20`. The percent
   * sign itself has to be escaped, or Core decodes the target folder back to
   * `test folder` and the published copy lands under the wrong name.
   */
  it('escapes a literal percent escape in a plain folder name', () => {
    expect(getPublishedTargetUrl('skills', 'test%20folder', 'skill-a')).toBe(
      'skills/public/test%2520folder/skill-a',
    );
  });

  it('round-trips a literal percent escape back through stripPublicTargetFolder', () => {
    const folderPath = 'test%20folder/nested%2Fname';

    expect(stripPublicTargetFolder(getPublicTargetFolder(folderPath))).toBe(
      folderPath,
    );
  });

  it('composes the same string publish assembled inline', () => {
    const sourceUrl = 'toolsets/bucket-123/tool-abc123__1.2.0';
    const folderPath = 'Organization/Data Science';

    expect(
      getPublishedTargetUrl(
        getResourceTypePrefix(sourceUrl),
        folderPath,
        getResourceName(sourceUrl),
      ),
    ).toBe(
      `${getResourceTypePrefix(sourceUrl)}/${getPublicTargetFolder(folderPath)}${getResourceName(sourceUrl)}`,
    );
  });
});
