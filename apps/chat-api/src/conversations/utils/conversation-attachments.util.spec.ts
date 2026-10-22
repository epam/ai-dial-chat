import { describe, expect, it, vi } from 'vitest';
import { getPublishedAttachmentTargetUrl } from '../../publish/publish-target.util';
import {
  type ConversationAttachmentView,
  type MessageCustomContentView,
  collectConversationAttachmentUrls,
  collectOwnedAttachmentRefs,
  mapConversationAttachmentFields,
  parseFolderAttachmentUrl,
  resolvePublishedAttachments,
  toPublishedAttachmentUrl,
} from './conversation-attachments.util';

const customContent = (
  content: MessageCustomContentView,
): MessageCustomContentView => content;

const conversationOf = (
  contents: MessageCustomContentView[],
): ConversationAttachmentView => ({
  messages: contents.map((content) => ({ custom_content: content })),
});

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

  it('collects a folder reference that carries a fragment as the folder', () => {
    const conversation = conversationOf([
      customContent({ attachments: [{ url: 'files/b/docs/#top' }] }),
    ]);

    expect(collectOwnedAttachmentRefs(conversation, 'b')).toEqual({
      fileUrls: [],
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

describe('toPublishedAttachmentUrl', () => {
  const published = 'conversations/public/Org/my-chat';

  it('keeps the source bucket as a segment of the published folder', () => {
    expect(toPublishedAttachmentUrl('files/b/docs/sub/', published)).toBe(
      'files/public/Org/my-chat/b/docs/sub/',
    );
  });

  it('maps the bucket root folder to the bucket segment itself', () => {
    expect(toPublishedAttachmentUrl('files/b/x', published)).toBe(
      'files/public/Org/my-chat/b/x',
    );
  });

  it('maps the same path of two buckets to different published paths', () => {
    expect(toPublishedAttachmentUrl('files/author/docs/', published)).not.toBe(
      toPublishedAttachmentUrl('files/colleague/docs/', published),
    );
  });

  it.each(['files/public/x/', 'files/b', 'files//a.pdf'])(
    'has no published counterpart for %s',
    (url) => {
      expect(toPublishedAttachmentUrl(url, published)).toBeUndefined();
    },
  );
});

describe('published attachment round trip', () => {
  it('maps a file to exactly the path that publish wrote it to', () => {
    const target = getPublishedAttachmentTargetUrl(
      'Org/Data Science',
      'my-chat',
      'b',
      'docs/a.pdf',
    );

    expect(
      toPublishedAttachmentUrl(
        'files/b/docs/a.pdf',
        'conversations/public/Org/Data%20Science/my-chat',
      ),
    ).toBe(target);
  });
});

describe('mapConversationAttachmentFields', () => {
  it('visits message, stage and citation fields and rewrites only the changed parts', () => {
    const conversation = conversationOf([
      customContent({
        attachments: [{ url: 'files/b/a.pdf', title: 'a' }],
        stages: [{ attachments: [{ url: 'files/b/stage.png' }] }],
        annotations: [
          {
            body: {
              source: { attachment: { reference_url: 'files/b/c.pdf' } },
            },
          },
        ],
      }),
      customContent({ attachments: [{ url: 'https://x.test/a.pdf' }] }),
    ]);

    const result = mapConversationAttachmentFields(conversation, (value) =>
      value.startsWith('files/') ? `P/${value}` : value,
    );

    expect(result.messages?.[0].custom_content).toEqual({
      attachments: [{ url: 'P/files/b/a.pdf', title: 'a' }],
      stages: [{ attachments: [{ url: 'P/files/b/stage.png' }] }],
      annotations: [
        {
          body: {
            source: { attachment: { reference_url: 'P/files/b/c.pdf' } },
          },
        },
      ],
    });
    expect(result.messages?.[1]).toBe(conversation.messages?.[1]);
    expect(conversation.messages?.[0].custom_content?.attachments).toEqual([
      { url: 'files/b/a.pdf', title: 'a' },
    ]);
  });

  it('returns the same object when nothing changes', () => {
    const conversation = conversationOf([
      customContent({ attachments: [{ url: 'files/b/a.pdf' }] }),
    ]);

    expect(mapConversationAttachmentFields(conversation, (v) => v)).toBe(
      conversation,
    );
  });

  it('skips malformed parts of an untrusted payload', () => {
    const malformed = {
      messages: [
        null,
        { custom_content: 'x' },
        {
          custom_content: {
            attachments: 'x',
            stages: [null, 5],
            annotations: [null, {}],
          },
        },
      ],
    } as unknown as ConversationAttachmentView;

    expect(() =>
      mapConversationAttachmentFields(malformed, (v) => v),
    ).not.toThrow();
  });
});

describe('resolvePublishedAttachments', () => {
  const published = 'conversations/public/Org/my-chat';
  const publishedFolder = 'files/public/Org/my-chat/b/docs/';
  const always = async () => true;

  it('rewrites a folder attachment whose published folder exists and keeps it a single attachment', async () => {
    const conversation = conversationOf([
      customContent({
        attachments: [
          {
            type: 'application/octet-stream',
            title: 'docs',
            url: 'files/b/docs/',
          },
        ],
      }),
    ]);

    const result = await resolvePublishedAttachments(
      conversation,
      published,
      always,
    );

    expect(result.messages?.[0].custom_content?.attachments).toEqual([
      {
        type: 'application/octet-stream',
        title: 'docs',
        url: publishedFolder,
      },
    ]);
    expect(conversation.messages?.[0].custom_content?.attachments).toEqual([
      expect.objectContaining({ url: 'files/b/docs/' }),
    ]);
  });

  it('keeps the legacy metadata prefix when rewriting', async () => {
    const result = await resolvePublishedAttachments(
      conversationOf([
        customContent({ attachments: [{ url: 'metadata/files/b/docs/' }] }),
      ]),
      published,
      always,
    );

    expect(result.messages?.[0].custom_content?.attachments?.[0].url).toBe(
      `metadata/${publishedFolder}`,
    );
  });

  it('rewrites only the folder published from the same bucket when two buckets share a path', async () => {
    const exists = vi.fn(async (url: string) => url === publishedFolder);
    const conversation = conversationOf([
      customContent({
        attachments: [
          { url: 'files/b/docs/' },
          { url: 'files/colleague/docs/' },
        ],
      }),
    ]);

    const result = await resolvePublishedAttachments(
      conversation,
      published,
      exists,
    );

    expect(
      result.messages?.[0].custom_content?.attachments?.map((a) => a.url),
    ).toEqual([publishedFolder, 'files/colleague/docs/']);
    expect(exists).toHaveBeenCalledWith(
      'files/public/Org/my-chat/colleague/docs/',
    );
  });

  it('keeps a reference whose published counterpart does not exist', async () => {
    const conversation = conversationOf([
      customContent({ attachments: [{ url: 'files/shared-by-third/docs/' }] }),
    ]);

    const result = await resolvePublishedAttachments(
      conversation,
      published,
      async () => false,
    );

    expect(result).toBe(conversation);
  });

  it('rewrites stage, citation and reference_url references and keeps their fragments', async () => {
    const result = await resolvePublishedAttachments(
      conversationOf([
        customContent({
          attachments: [
            { url: 'files/b/a.pdf', reference_url: 'files/b/a.pdf#page=2' },
          ],
          stages: [{ attachments: [{ url: 'files/b/out/chart.png' }] }],
          annotations: [
            {
              body: {
                source: {
                  attachment: {
                    url: 'files/b/c.pdf#page=7',
                    reference_url: 'files/b/docs/#top',
                  },
                },
              },
            },
          ],
        }),
      ]),
      published,
      always,
    );

    expect(result.messages?.[0].custom_content).toEqual({
      attachments: [
        {
          url: 'files/public/Org/my-chat/b/a.pdf',
          reference_url: 'files/public/Org/my-chat/b/a.pdf#page=2',
        },
      ],
      stages: [
        { attachments: [{ url: 'files/public/Org/my-chat/b/out/chart.png' }] },
      ],
      annotations: [
        {
          body: {
            source: {
              attachment: {
                url: 'files/public/Org/my-chat/b/c.pdf#page=7',
                reference_url: `${publishedFolder}#top`,
              },
            },
          },
        },
      ],
    });
  });

  it('does not touch references already public, external or inline', async () => {
    const exists = vi.fn().mockResolvedValue(true);
    const conversation = conversationOf([
      customContent({
        attachments: [
          { url: 'files/public/Org/my-chat/b/a.pdf' },
          { url: 'files/public/other/' },
          { url: 'https://example.com/a.pdf' },
          { title: 'inline' },
        ],
      }),
    ]);

    const result = await resolvePublishedAttachments(
      conversation,
      published,
      exists,
    );

    expect(result).toBe(conversation);
    expect(exists).not.toHaveBeenCalled();
  });

  it('checks each published url once even when several messages share it', async () => {
    const exists = vi.fn().mockResolvedValue(true);
    const conversation = conversationOf([
      customContent({ attachments: [{ url: 'files/b/docs/' }] }),
      customContent({ attachments: [{ url: 'files/b/docs/' }] }),
    ]);

    await resolvePublishedAttachments(conversation, published, exists);

    expect(exists).toHaveBeenCalledOnce();
  });

  it('looks published copies up in bounded batches', async () => {
    let running = 0;
    let peak = 0;
    const exists = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
      return true;
    };
    const conversation = conversationOf([
      customContent({
        attachments: Array.from({ length: 20 }, (_, i) => ({
          url: `files/b/f${i}.pdf`,
        })),
      }),
    ]);

    await resolvePublishedAttachments(conversation, published, exists);

    expect(peak).toBeLessThanOrEqual(8);
  });

  it('rejects, without returning a partly rewritten conversation, when a lookup fails', async () => {
    const failure = new Error('core is down');
    const conversation = conversationOf([
      customContent({
        attachments: [{ url: 'files/b/docs/' }, { url: 'files/b/a.pdf' }],
      }),
    ]);

    await expect(
      resolvePublishedAttachments(conversation, published, async (url) => {
        if (url.endsWith('a.pdf')) throw failure;
        return true;
      }),
    ).rejects.toBe(failure);
  });
});
