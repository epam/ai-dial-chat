import {
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPublishAttachmentsService } from '../conversation-publish-attachments.service';
import { ConversationErrorCode } from '../types/conversation-error-code.enum';
import type {
  AttachmentRef,
  ConversationAttachmentView,
} from '../utils/conversation-attachments.util';

const BUCKET = 'bucket-123';

const conversationWith = (
  attachments: AttachmentRef[],
): ConversationAttachmentView => ({
  messages: [{ custom_content: { attachments } }],
});

const expanded = (...paths: string[]) =>
  paths.map((path) => ({
    bucket: BUCKET,
    path,
    name: path.split('/').at(-1) ?? path,
    size: 1,
    archivePath: path,
  }));

const makeService = (maxFiles?: number) => {
  const filesListingService = {
    expandFolderContents: vi.fn().mockResolvedValue([]),
    getFileMetadata: vi.fn().mockResolvedValue({}),
  };
  const configService = {
    get: vi.fn().mockReturnValue(maxFiles),
  };
  const service = new ConversationPublishAttachmentsService(
    filesListingService as never,
    configService as never,
  );
  return { service, filesListingService, configService };
};

const buildAdd = (
  service: ConversationPublishAttachmentsService,
  conversation: ConversationAttachmentView,
) =>
  service.buildAddResources(
    'token',
    BUCKET,
    conversation,
    'Organization/Data Science',
    'my-chat',
  );

describe('ConversationPublishAttachmentsService.buildAddResources', () => {
  it('returns nothing for a conversation without attachments and makes no Core call', async () => {
    const { service, filesListingService } = makeService();

    const result = await buildAdd(service, conversationWith([]));

    expect(result).toEqual([]);
    expect(filesListingService.getFileMetadata).not.toHaveBeenCalled();
    expect(filesListingService.expandFolderContents).not.toHaveBeenCalled();
  });

  it('publishes an attached file under the conversation namespace', async () => {
    const { service } = makeService();

    const result = await buildAdd(
      service,
      conversationWith([{ url: `files/${BUCKET}/docs/report.pdf` }]),
    );

    expect(result).toEqual([
      {
        action: 'ADD',
        sourceUrl: `files/${BUCKET}/docs/report.pdf`,
        targetUrl:
          'files/public/Organization/Data%20Science/my-chat/bucket-123/docs/report.pdf',
      },
    ]);
  });

  it('expands an attached folder into its files, keeping nested structure', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded('docs/a.pdf', 'docs/sub/b c.pdf'),
    );

    const result = await buildAdd(
      service,
      conversationWith([{ url: `files/${BUCKET}/docs/` }]),
    );

    expect(filesListingService.expandFolderContents).toHaveBeenCalledWith(
      BUCKET,
      `files/${BUCKET}/docs/`,
      '',
      'token',
    );
    expect(result).toEqual([
      {
        action: 'ADD',
        sourceUrl: `files/${BUCKET}/docs/a.pdf`,
        targetUrl:
          'files/public/Organization/Data%20Science/my-chat/bucket-123/docs/a.pdf',
      },
      {
        action: 'ADD',
        sourceUrl: `files/${BUCKET}/docs/sub/b%20c.pdf`,
        targetUrl:
          'files/public/Organization/Data%20Science/my-chat/bucket-123/docs/sub/b%20c.pdf',
      },
    ]);
  });

  it('expands a legacy metadata folder attachment the same way', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded('docs/a.pdf'),
    );

    const result = await buildAdd(
      service,
      conversationWith([{ url: `metadata/files/${BUCKET}/docs/` }]),
    );

    expect(result).toHaveLength(1);
  });

  it('publishes a file once when it is attached directly and also lies inside an attached folder', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded('docs/a.pdf'),
    );

    const result = await buildAdd(
      service,
      conversationWith([
        { url: `files/${BUCKET}/docs/a.pdf` },
        { url: `files/${BUCKET}/docs/` },
      ]),
    );

    expect(result).toHaveLength(1);
  });

  it('publishes a file once when the stored url and the folder listing encode it differently', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded('docs/b c.pdf'),
    );

    const result = await buildAdd(
      service,
      conversationWith([
        { url: `files/${BUCKET}/docs/b%20c.pdf` },
        { url: `files/${BUCKET}/docs/` },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBe(`files/${BUCKET}/docs/b%20c.pdf`);
  });

  it('ignores files in other buckets and the public bucket', async () => {
    const { service, filesListingService } = makeService();

    const result = await buildAdd(
      service,
      conversationWith([
        { url: 'files/other-bucket/a.pdf' },
        { url: 'files/other-bucket/docs/' },
        { url: 'files/public/a.pdf' },
      ]),
    );

    expect(result).toEqual([]);
    expect(filesListingService.getFileMetadata).not.toHaveBeenCalled();
    expect(filesListingService.expandFolderContents).not.toHaveBeenCalled();
  });

  it('fails with conversationAttachmentMissing naming every deleted file and folder', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.getFileMetadata.mockImplementation(
      async (_bucket: string, path: string) => {
        if (path === 'old.pdf') throw new NotFoundException();
        return {};
      },
    );
    filesListingService.expandFolderContents.mockRejectedValue(
      new NotFoundException(),
    );

    const error = await buildAdd(
      service,
      conversationWith([
        { url: `files/${BUCKET}/old.pdf` },
        { url: `files/${BUCKET}/ok.pdf` },
        { url: `files/${BUCKET}/gone/` },
      ]),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    const body = (error as UnprocessableEntityException).getResponse() as {
      code: string;
      message: string;
      missingFiles: string[];
    };
    expect(body.code).toBe(ConversationErrorCode.AttachmentMissing);
    expect(body.missingFiles).toEqual([
      `files/${BUCKET}/old.pdf`,
      `files/${BUCKET}/gone/`,
    ]);
    expect(body.message).toContain(`files/${BUCKET}/old.pdf`);
  });

  it('propagates a non-404 failure while checking a file', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.getFileMetadata.mockRejectedValue(new Error('boom'));

    await expect(
      buildAdd(service, conversationWith([{ url: `files/${BUCKET}/a.pdf` }])),
    ).rejects.toThrow('boom');
  });

  it('rejects with 413 when the attachments expand beyond the configured maximum', async () => {
    const { service, filesListingService } = makeService(2);
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded('docs/a.pdf', 'docs/b.pdf', 'docs/c.pdf'),
    );

    await expect(
      buildAdd(service, conversationWith([{ url: `files/${BUCKET}/docs/` }])),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('allows exactly the maximum', async () => {
    const { service, filesListingService } = makeService(2);
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded('docs/a.pdf', 'docs/b.pdf'),
    );

    const result = await buildAdd(
      service,
      conversationWith([{ url: `files/${BUCKET}/docs/` }]),
    );

    expect(result).toHaveLength(2);
  });

  it('defaults the maximum to 1000 files when it is not configured', async () => {
    const { service, filesListingService } = makeService(undefined);
    filesListingService.expandFolderContents.mockResolvedValue(
      expanded(...Array.from({ length: 1001 }, (_, i) => `docs/${i}.pdf`)),
    );

    await expect(
      buildAdd(service, conversationWith([{ url: `files/${BUCKET}/docs/` }])),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('checks the existence of many files in bounded parallel batches', async () => {
    const { service, filesListingService } = makeService();
    let running = 0;
    let peak = 0;
    filesListingService.getFileMetadata.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
      return {};
    });

    await buildAdd(
      service,
      conversationWith(
        Array.from({ length: 20 }, (_, i) => ({
          url: `files/${BUCKET}/f${i}.pdf`,
        })),
      ),
    );

    expect(filesListingService.getFileMetadata).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(8);
  });
});

describe('ConversationPublishAttachmentsService.buildDeleteResources', () => {
  const FOLDER = 'files/public/Organization/Data%20Science/my-chat/';

  it('deletes every file that exists in the published folder', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockResolvedValue([
      {
        bucket: 'public',
        path: 'Organization/Data Science/my-chat/docs/a b.pdf',
        name: 'a b.pdf',
        size: 1,
        archivePath: 'x',
      },
    ]);

    const result = await service.buildDeleteResources('token', FOLDER);

    expect(filesListingService.expandFolderContents).toHaveBeenCalledWith(
      'public',
      'files/public/Organization/Data Science/my-chat/',
      '',
      'token',
    );
    expect(result).toEqual([
      {
        action: 'DELETE',
        targetUrl:
          'files/public/Organization/Data%20Science/my-chat/docs/a%20b.pdf',
      },
    ]);
  });

  it('returns nothing when the conversation published no files', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(
      service.buildDeleteResources('token', FOLDER),
    ).resolves.toEqual([]);
  });

  it('propagates other listing failures', async () => {
    const { service, filesListingService } = makeService();
    filesListingService.expandFolderContents.mockRejectedValue(
      new Error('listing down'),
    );

    await expect(service.buildDeleteResources('token', FOLDER)).rejects.toThrow(
      'listing down',
    );
  });
});
