import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptsPersonalService } from '../personal/prompts-personal.service';
import { PromptsPublicService } from '../public/prompts-public.service';
import { isHiddenPromptPath, PUBLIC_BUCKET } from '../utils/prompt-mapper.util';

const BUCKET = 'my-bucket';

const metadataItem = (url: string) => ({ nodeType: 'ITEM', url });

/* Mirrors the fields `mapPromptToResponse` produces, keyed by path. */
const promptDto = (id: string) => ({
  id,
  name: id.split('/').pop(),
  content: 'body',
  folderId: id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '',
  createdAt: 1,
  updatedAt: 2,
});

describe('isHiddenPromptPath', () => {
  it('matches a DIAL Core folder marker at any depth', () => {
    expect(isHiddenPromptPath('.dial_folder')).toBe(true);
    expect(isHiddenPromptPath('Work/.dial_folder')).toBe(true);
    expect(isHiddenPromptPath('Work/AI/.dial_folder')).toBe(true);
  });

  it('does not match a prompt whose name merely contains the marker text', () => {
    expect(isHiddenPromptPath('Work/my.dial_folder-notes')).toBe(false);
    expect(isHiddenPromptPath('Work/summarize')).toBe(false);
  });
});

describe('PromptsPersonalService.listPrompts', () => {
  const makeService = (urls: string[], sharedUrls: string[] = []) => {
    const resourceService = {
      listPromptMetadataItems: vi
        .fn()
        .mockResolvedValue(urls.map(metadataItem)),
      readPromptByPath: vi
        .fn()
        .mockImplementation((_token, _bucket, path) =>
          Promise.resolve(promptDto(path)),
        ),
    };
    const dialClient = {
      client: {
        getSharedResources: vi.fn().mockResolvedValue({
          data: {
            resources: sharedUrls.map((url) => ({ nodeType: 'ITEM', url })),
          },
        }),
      },
    };

    const service = new PromptsPersonalService(
      dialClient as never,
      resourceService as never,
    );
    return { service, resourceService };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops hidden .dial_folder markers from the prompt list', async () => {
    const { service, resourceService } = makeService([
      `prompts/${BUCKET}/Work/.dial_folder`,
      `prompts/${BUCKET}/Work/summarize`,
    ]);

    const result = await service.listPrompts('token', BUCKET);

    expect(result.prompts.map((p) => p.id)).toEqual(['Work/summarize']);
    /* The marker must not even be read — it is not a prompt resource. */
    expect(resourceService.readPromptByPath).toHaveBeenCalledOnce();
    expect(resourceService.readPromptByPath).toHaveBeenCalledWith(
      'token',
      BUCKET,
      'Work/summarize',
      expect.anything(),
    );
  });

  it('drops hidden markers from sharedWithMe', async () => {
    const { service } = makeService(
      [],
      [
        `prompts/owner-bucket/Shared/.dial_folder`,
        `prompts/owner-bucket/Shared/review`,
      ],
    );

    const result = await service.listPrompts('token', BUCKET);

    expect(result.sharedWithMe.map((p) => p.id)).toEqual(['Shared/review']);
  });

  it('keeps folders derived from surviving prompts', async () => {
    const { service } = makeService([
      `prompts/${BUCKET}/Work/AI/.dial_folder`,
      `prompts/${BUCKET}/Work/AI/summarize`,
    ]);

    const result = await service.listPrompts('token', BUCKET);

    expect(result.folders.map((f) => f.id)).toEqual(['Work', 'Work/AI']);
  });
});

describe('PromptsPublicService.listPublicPrompts', () => {
  const makeService = (urls: string[]) => {
    const resourceService = {
      listPromptMetadataItems: vi
        .fn()
        .mockResolvedValue(urls.map(metadataItem)),
      readPromptByPath: vi
        .fn()
        .mockImplementation((_token, _bucket, path) =>
          Promise.resolve(promptDto(path)),
        ),
    };

    const service = new PromptsPublicService(
      { client: {} } as never,
      resourceService as never,
    );
    return { service, resourceService };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops hidden .dial_folder markers from the public prompt list', async () => {
    const { service, resourceService } = makeService([
      `prompts/${PUBLIC_BUCKET}/.dial_folder`,
      `prompts/${PUBLIC_BUCKET}/Templates/.dial_folder`,
      `prompts/${PUBLIC_BUCKET}/Templates/tone-of-voice`,
    ]);

    const result = await service.listPublicPrompts('token');

    expect(result.prompts.map((p) => p.id)).toEqual([
      'Templates/tone-of-voice',
    ]);
    expect(resourceService.readPromptByPath).toHaveBeenCalledOnce();
  });
});
