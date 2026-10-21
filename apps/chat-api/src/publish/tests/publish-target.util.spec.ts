import { describe, expect, it } from 'vitest';
import {
  getPublicTargetFolder,
  getPublishedAttachmentsFolderUrl,
  getPublishedAttachmentTargetUrl,
  getPublishableIconUrl,
  getPublishedIconTargetUrl,
  getPublishedTargetUrl,
  getResourceName,
  getResourceTypePrefix,
  getVersionedTargetResourceName,
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
   * [#8974](https://github.com/epam/ai-dial-chat/issues/8974): the folder's plain name really contains `%20`. The percent
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

describe('getVersionedTargetResourceName', () => {
  it.each([
    ['toolsets', 'my-tool__1.0.0', '1.0.1', 'my-tool__1.0.1'],
    ['applications', 'my-app__0.0.1', '2.0.0-beta.1', 'my-app__2.0.0-beta.1'],
    ['toolsets', 'my-tool__1.0.0', '1.0.0+build.5', 'my-tool__1.0.0%2Bbuild.5'],
  ])(
    'replaces the version suffix of a %s resource name',
    (prefix, name, version, expected) => {
      expect(getVersionedTargetResourceName(prefix, name, version)).toBe(
        expected,
      );
    },
  );

  it.each([
    ['prompts', 'a__b', '1.0.1'],
    ['skills', 'my-skill', '1.0.1'],
    ['toolsets', 'no-suffix', '1.0.1'],
    ['toolsets', 'my-tool__1.0.0', undefined],
    ['toolsets', 'my-tool__1.0.0', '../evil'],
  ])('keeps %s "%s" unchanged for version %s', (prefix, name, version) => {
    expect(getVersionedTargetResourceName(prefix, name, version)).toBe(name);
  });
});

describe('getPublishableIconUrl', () => {
  it('returns an uploaded icon in the app bucket, without query or fragment', () => {
    expect(
      getPublishableIconUrl(
        { iconUrl: 'files/bucket-123/icons/app.png?v=2#x' },
        'bucket-123',
      ),
    ).toBe('files/bucket-123/icons/app.png');
  });

  it('falls back to icon_url', () => {
    expect(
      getPublishableIconUrl(
        { icon_url: 'files/bucket-123/app.png' },
        'bucket-123',
      ),
    ).toBe('files/bucket-123/app.png');
  });

  it('matches a percent-encoded bucket segment', () => {
    expect(
      getPublishableIconUrl(
        { iconUrl: 'files/My%20Bucket/app.png' },
        'My Bucket',
      ),
    ).toBe('files/My%20Bucket/app.png');
  });

  it.each([
    'files/public/icons/app.png',
    'files/other-bucket/app.png',
    'files/bucket-123/../other/app.png',
    'files/bucket-123/..%2Fother%2Fapp.png',
    'https://example.com/app.png',
    'app-theme-icon.svg',
    '',
  ])('returns undefined for %s', (iconUrl) => {
    expect(getPublishableIconUrl({ iconUrl }, 'bucket-123')).toBeUndefined();
  });

  it('returns undefined when the icon is absent or the application is not an object', () => {
    expect(getPublishableIconUrl({}, 'bucket-123')).toBeUndefined();
    expect(
      getPublishableIconUrl({ iconUrl: 42 }, 'bucket-123'),
    ).toBeUndefined();
    expect(getPublishableIconUrl(null, 'bucket-123')).toBeUndefined();
  });
});

describe('getPublishedIconTargetUrl', () => {
  it('nests the icon under the app versioned target name in the public folder', () => {
    expect(
      getPublishedIconTargetUrl(
        'Team A',
        'My%20App__1.0.1',
        'files/bucket-123/icons/app%20icon.png',
      ),
    ).toBe('files/public/Team%20A/My%20App__1.0.1/app%20icon.png');
  });

  it('targets the public root when folderPath is empty', () => {
    expect(
      getPublishedIconTargetUrl('', 'my-app__1.0.0', 'files/b/app.png'),
    ).toBe('files/public/my-app__1.0.0/app.png');
  });
});

/*
 * Publish writes the files to `getPublishedAttachmentTargetUrl`, unpublish lists
 * `getPublishedAttachmentsFolderUrl` and the read path rewrites folder links to
 * it, so these pin the exact strings and that the two derivations agree.
 */
describe('published attachment paths', () => {
  it('nests a file under the published conversation name, keeping its bucket-relative path', () => {
    expect(
      getPublishedAttachmentTargetUrl(
        'Organization/Data Science',
        'my-chat',
        'docs/sub/b.pdf',
      ),
    ).toBe('files/public/Organization/Data%20Science/my-chat/docs/sub/b.pdf');
  });

  it('uses the public root when folderPath is empty', () => {
    expect(getPublishedAttachmentTargetUrl('', 'my-chat', 'a.pdf')).toBe(
      'files/public/my-chat/a.pdf',
    );
  });

  it('percent-encodes a non-ASCII folder name like every other published path', () => {
    expect(
      getPublishedAttachmentTargetUrl('test 14.04/Ünïcode', 'c', 'a.pdf'),
    ).toBe('files/public/test%2014.04/%C3%9Cn%C3%AFcode/c/a.pdf');
  });

  it('derives the attachments folder from the published conversation url', () => {
    expect(
      getPublishedAttachmentsFolderUrl('conversations/public/Org/my-chat'),
    ).toBe('files/public/Org/my-chat/');
  });

  it('is the folder every published attachment file path starts with', () => {
    const folder = getPublishedAttachmentsFolderUrl(
      getPublishedTargetUrl('conversations', 'Org/Chats', 'my-chat'),
    );
    expect(
      getPublishedAttachmentTargetUrl('Org/Chats', 'my-chat', 'docs/a.pdf'),
    ).toBe(`${folder}docs/a.pdf`);
  });
});
