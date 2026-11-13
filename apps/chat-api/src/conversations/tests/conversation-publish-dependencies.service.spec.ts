import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceDependencyType } from '../../publish/dto/resource-dependency.dto';
import { ConversationPublishDependenciesService } from '../conversation-publish-dependencies.service';

const BUCKET = 'bucket-1';

describe('ConversationPublishDependenciesService', () => {
  let getConversation: ReturnType<typeof vi.fn>;
  let service: ConversationPublishDependenciesService;
  let warn: ReturnType<typeof vi.spyOn>;

  const withConversation = (data: unknown) =>
    getConversation.mockResolvedValue({ data, response: { status: 200 } });

  const attachment = (url: string) => ({
    custom_content: { attachments: [{ url, title: 't' }] },
  });

  beforeEach(() => {
    getConversation = vi.fn();
    service = new ConversationPublishDependenciesService({
      client: { getConversation },
    } as never);
    warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists a private application the conversation uses as its model', async () => {
    withConversation({
      model: { id: 'applications/bucket-1/Research%20agent__2.0.0' },
      messages: [],
    });

    const result = await service.getDependencies('t', BUCKET, 'gpt__Plan__1');

    expect(result.dependencies).toEqual([
      {
        id: 'applications/bucket-1/Research%20agent__2.0.0',
        name: 'Research agent',
        version: '2.0.0',
        type: ResourceDependencyType.Application,
        location: '',
      },
    ]);
    expect(getConversation).toHaveBeenCalledWith(
      BUCKET,
      'gpt__Plan__1',
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it('lists the assistant model and an add-on besides the model', async () => {
    withConversation({
      model: { id: 'applications/bucket-1/Agent__1.0.0' },
      assistantModelId: 'toolsets/bucket-1/Tools__1.0.0',
      selectedAddons: ['applications/bucket-1/Addon__1.0.0', 'gpt-4o'],
      messages: [],
    });

    const result = await service.getDependencies('t', BUCKET, 'p');

    expect(result.dependencies.map((dependency) => dependency.name)).toEqual([
      'Agent',
      'Tools',
      'Addon',
    ]);
  });

  it('ignores a built-in model and a public application', async () => {
    withConversation({
      model: { id: 'gpt-4o' },
      selectedAddons: ['applications/public/Shared__1.0.0'],
      messages: [],
    });

    expect(
      (await service.getDependencies('t', BUCKET, 'p')).dependencies,
    ).toEqual([]);
  });

  it('lists a private skill a message uses', async () => {
    withConversation({
      messages: [
        {
          custom_content: {
            skills: [{ url: 'skills/bucket-1/Docs%20helper' }],
          },
        },
      ],
    });

    const result = await service.getDependencies('t', BUCKET, 'p');

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: 'Docs helper',
        type: ResourceDependencyType.Skill,
      }),
    ]);
  });

  it('lists a file from another user and skips own-bucket and public files', async () => {
    withConversation({
      messages: [
        attachment('files/other-bucket/docs/report.pdf#page=2'),
        attachment('files/bucket-1/docs/own.pdf'),
        attachment('files/public/Org/shared.pdf'),
        attachment('https://example.com/x.png'),
      ],
    });

    const result = await service.getDependencies('t', BUCKET, 'p');

    expect(result.dependencies).toEqual([
      {
        id: 'files/other-bucket/docs/report.pdf',
        name: 'report.pdf',
        type: ResourceDependencyType.File,
        location: 'docs',
      },
    ]);
  });

  it('lists a foreign folder attachment as one entry', async () => {
    withConversation({
      messages: [attachment('metadata/files/other-bucket/docs/')],
    });

    const result = await service.getDependencies('t', BUCKET, 'p');

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toMatchObject({
      name: 'docs',
      type: ResourceDependencyType.File,
    });
  });

  it('ignores a file referenced only from the replay stack', async () => {
    withConversation({
      messages: [],
      replay: {
        replayUserMessagesStack: [attachment('files/other-bucket/a.txt')],
      },
    });

    expect(
      (await service.getDependencies('t', BUCKET, 'p')).dependencies,
    ).toEqual([]);
  });

  it('lists a repeated reference once', async () => {
    withConversation({
      messages: [
        attachment('files/other-bucket/a.txt'),
        attachment('files/other-bucket/a.txt#page=3'),
      ],
    });

    expect(
      (await service.getDependencies('t', BUCKET, 'p')).dependencies,
    ).toHaveLength(1);
  });

  it('returns an empty list and warns without the token when the conversation cannot be read', async () => {
    getConversation.mockResolvedValue({ error: {}, response: { status: 500 } });

    const result = await service.getDependencies('secret-token', BUCKET, 'p');

    expect(result).toEqual({ dependencies: [] });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).not.toContain('secret-token');
  });

  it('returns an empty list when the read throws', async () => {
    getConversation.mockRejectedValue(new Error('network down'));

    expect(await service.getDependencies('t', BUCKET, 'p')).toEqual({
      dependencies: [],
    });
  });
});
