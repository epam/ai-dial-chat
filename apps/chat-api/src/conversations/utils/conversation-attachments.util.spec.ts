import { describe, expect, it, vi } from 'vitest';
import { getPublishedAttachmentTargetUrl } from '../../publish/publish-target.util';
import {
  collectConversationAttachmentUrls,
  collectOwnedAttachmentRefs,
  parseFolderAttachmentUrl,
  resolvePublishedFolderAttachments,
  toPublishedFolderUrl,
} from './conversation-attachments.util';

const message = (customContent: Record<string, unknown>) => ({
  role: 'user',
  content: 'hi',
  custom_content: customContent,
});

describe('collectConversationAttachmentUrls', () => {
  it('reads message attachments, stage attachments and citation sources in order', () => {
    const conversation = {
      messages: [
        message({
          attachments: [{ url: 'files/b/a.pdf' }],
          stages: [{ attachments: [{ url: 'files/b/stage.png' }] }],
          annotations: [
            {
              body: {
                source: {
                  attachment: { reference_url: 'files/b/c.pdf#page=2' },
                },
              },
            },
          ],
        }),
      ],
    };

    expect(collectConversationAttachmentUrls(conversation)).toEqual([
      'files/b/a.pdf',
      'files/b/stage.png',
      'files/b/c.pdf#page=2',
    ]);
  });

  it('returns nothing for a conversation without messages', () => {
    expect(collectConversationAttachmentUrls({})).toEqual([]);
    expect(collectConversationAttachmentUrls(null)).toEqual([]);
  });
});

describe('parseFolderAttachmentUrl', () => {
  it('recognises a plain folder url', () => {
    expect(parseFolderAttachmentUrl('files/b/docs/')).toEqual({
      metadataPrefix: '',
      folderUrl: 'files/b/docs/',
    });
  });

  it('recognises the legacy metadata folder form and keeps its prefix', () => {
    expect(parseFolderAttachmentUrl('metadata/files/b/docs/')).toEqual({
      metadataPrefix: 'metadata/',
      folderUrl: 'files/b/docs/',
    });
  });

  it.each(['files/b/a.pdf', 'https://x.test/a/', 'metadata/files/b/a.pdf', 5])(
    'does not treat %s as a folder',
    (url) => {
      expect(parseFolderAttachmentUrl(url)).toBeUndefined();
    },
  );
});

describe('collectOwnedAttachmentRefs', () => {
  it('splits files and folders, drops fragments and duplicates', () => {
    const conversation = {
      messages: [
        message({
          attachments: [
            { url: 'files/b/a.pdf' },
            { url: 'files/b/docs/' },
            { url: 'files/b/a.pdf#page=3' },
          ],
          annotations: [
            {
              body: {
                source: {
                  attachment: { reference_url: 'files/b/a.pdf#page=2' },
                },
              },
            },
          ],
        }),
      ],
    };

    expect(collectOwnedAttachmentRefs(conversation, 'b')).toEqual({
      fileUrls: ['files/b/a.pdf'],
      folderUrls: ['files/b/docs/'],
    });
  });

  it('collects the legacy metadata folder form as a plain folder', () => {
    const conversation = {
      messages: [message({ attachments: [{ url: 'metadata/files/b/docs/' }] })],
    };

    expect(collectOwnedAttachmentRefs(conversation, 'b').folderUrls).toEqual([
      'files/b/docs/',
    ]);
  });

  it('skips other buckets, the public bucket, inline data, external urls and traversal', () => {
    const conversation = {
      messages: [
        message({
          attachments: [
            { url: 'files/other/a.pdf' },
            { url: 'files/other/docs/' },
            { url: 'files/public/a.pdf' },
            { data: 'abc' },
            { url: 'https://example.com/a.pdf' },
            { url: 'files/b/%2E%2E/x.pdf' },
            { url: 'files/b/../x.pdf' },
          ],
        }),
      ],
    };

    expect(collectOwnedAttachmentRefs(conversation, 'b')).toEqual({
      fileUrls: [],
      folderUrls: [],
    });
  });
});

describe('toPublishedFolderUrl', () => {
  const published = 'conversations/public/Org/my-chat';

  it('maps a folder to the same path under the published conversation folder', () => {
    expect(toPublishedFolderUrl('files/b/docs/sub/', published)).toBe(
      'files/public/Org/my-chat/docs/sub/',
    );
  });

  it('maps the bucket root folder to the namespace itself', () => {
    expect(toPublishedFolderUrl('files/b/', published)).toBe(
      'files/public/Org/my-chat/',
    );
  });

  it('leaves a folder already in the public bucket alone', () => {
    expect(toPublishedFolderUrl('files/public/x/', published)).toBeUndefined();
  });
});

describe('published folder round trip', () => {
  it('maps a folder to the folder that publish wrote its files into', () => {
    const file = getPublishedAttachmentTargetUrl(
      'Org/Data Science',
      'my-chat',
      'docs/a.pdf',
    );

    expect(
      toPublishedFolderUrl(
        'files/b/docs/',
        'conversations/public/Org/Data%20Science/my-chat',
      ),
    ).toBe(file.slice(0, file.lastIndexOf('/') + 1));
  });
});

describe('resolvePublishedFolderAttachments', () => {
  const published = 'conversations/public/Org/my-chat';

  interface TestConversation {
    id: string;
    messages: { custom_content: { attachments: { url: string }[] } }[];
  }

  const conversationWith = (attachments: unknown[]) =>
    ({
      id: 'x',
      messages: [message({ attachments })],
    }) as unknown as TestConversation;

  it('rewrites a folder attachment whose published folder exists and keeps it a single attachment', async () => {
    const conversation = conversationWith([
      { type: 'application/octet-stream', title: 'docs', url: 'files/b/docs/' },
    ]);

    const result = await resolvePublishedFolderAttachments(
      conversation,
      published,
      async () => true,
    );

    expect(result.messages[0].custom_content.attachments).toEqual([
      {
        type: 'application/octet-stream',
        title: 'docs',
        url: 'files/public/Org/my-chat/docs/',
      },
    ]);
    expect(
      conversation.messages[0].custom_content.attachments[0],
    ).toMatchObject({ url: 'files/b/docs/' });
  });

  it('keeps the legacy metadata prefix when rewriting', async () => {
    const result = await resolvePublishedFolderAttachments(
      conversationWith([{ url: 'metadata/files/b/docs/' }]),
      published,
      async () => true,
    );

    expect(result.messages[0].custom_content.attachments[0].url).toBe(
      'metadata/files/public/Org/my-chat/docs/',
    );
  });

  it('keeps a folder whose published counterpart does not exist', async () => {
    const conversation = conversationWith([
      { url: 'files/shared-by-third/docs/' },
    ]);

    const result = await resolvePublishedFolderAttachments(
      conversation,
      published,
      async () => false,
    );

    expect(result).toBe(conversation);
  });

  it('does not touch file attachments or public folders', async () => {
    const folderExists = vi.fn().mockResolvedValue(true);
    const conversation = conversationWith([
      { url: 'files/public/Org/my-chat/a.pdf' },
      { url: 'files/public/other/' },
    ]);

    const result = await resolvePublishedFolderAttachments(
      conversation,
      published,
      folderExists,
    );

    expect(result).toBe(conversation);
    expect(folderExists).not.toHaveBeenCalled();
  });

  it('checks each published folder once even when several messages share it', async () => {
    const folderExists = vi.fn().mockResolvedValue(true);
    const conversation = {
      messages: [
        message({ attachments: [{ url: 'files/b/docs/' }] }),
        message({ attachments: [{ url: 'files/b/docs/' }] }),
      ],
    };

    await resolvePublishedFolderAttachments(
      conversation,
      published,
      folderExists,
    );

    expect(folderExists).toHaveBeenCalledOnce();
  });
});
