import {
  BadGatewayException,
  ForbiddenException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../../openapi/openapi-response.dto';
import { ProjectCreateErrorCode } from '../../../projects/types/project-create-error-code.enum';
import {
  hashProjectConversation,
  PROJECT_CONVERSATION_WRITE_ATTEMPTS,
  ProjectConversationStore,
} from '../project-conversation.store';

const LOCATOR = 'projects/a1b2c3/support-quality/conversations/gpt-4o__Hi__1';
const SHARED_LOCATOR = 'projects/z9y8x7/research/conversations/x';

const body = (name = 'Hi') =>
  ({
    id: LOCATOR,
    folderId: 'projects/a1b2c3/support-quality',
    name,
    messages: [],
  }) as unknown as ConversationResponseDto;

const download = (text: string, etag = '"p1"') => ({
  data: text,
  error: undefined,
  response: new Response(null, { status: 200, headers: { etag } }),
});

const metadata = (etag: string) => ({
  data: { nodeType: 'ITEM', etag },
  error: undefined,
  response: new Response(null, { status: 200 }),
});

const status = (code: number) => ({
  data: undefined,
  error: code >= 400 ? {} : undefined,
  response: new Response(null, { status: code }),
});

const makeStore = () => {
  const client = {
    downloadProjectFile: vi.fn(),
    listProjectMetadata: vi.fn(async () => metadata('"p1"')),
    uploadProjectFile: vi.fn(),
    deleteProjectFile: vi.fn(),
  };
  return {
    store: new ProjectConversationStore({
      client,
    } as unknown as DialClientService),
    client,
  };
};

describe('ProjectConversationStore', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the file and returns its content hash as the version', async () => {
    const { store, client } = makeStore();
    const text = JSON.stringify(body());
    client.downloadProjectFile.mockResolvedValue(download(text));

    const stored = await store.readConversationWithEtag(LOCATOR, 'token');

    expect(stored).toEqual({
      conversation: body(),
      etag: hashProjectConversation(text),
    });
    expect(stored?.etag).toMatch(/^"sha256:[\da-f]{64}"$/);
    expect(client.downloadProjectFile).toHaveBeenCalledWith(
      'a1b2c3',
      'support-quality',
      'conversations/gpt-4o__Hi__1',
      expect.objectContaining({ parseAs: 'text' }),
    );
  });

  it('reads a shared project conversation from its own bucket', async () => {
    const { store, client } = makeStore();
    client.downloadProjectFile.mockResolvedValue(download('{}'));

    await store.readConversationWithEtag(SHARED_LOCATOR, 'token');

    expect(client.downloadProjectFile).toHaveBeenCalledWith(
      'z9y8x7',
      'research',
      'conversations/x',
      expect.anything(),
    );
  });

  it('resolves null on a Core 404 and the get methods throw NotFoundException', async () => {
    const { store, client } = makeStore();
    client.downloadProjectFile.mockResolvedValue(status(404));

    await expect(
      store.readConversationWithEtag(LOCATOR, 'token'),
    ).resolves.toBeNull();
    await expect(
      store.getStoredConversation(LOCATOR, 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 502 when the stored body is not a JSON object', async () => {
    const { store, client } = makeStore();
    client.downloadProjectFile.mockResolvedValue(download('[1,2]'));

    await expect(
      store.readConversationWithEtag(LOCATOR, 'token'),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('derives the display name from the file name until naming is done', async () => {
    const { store, client } = makeStore();
    client.downloadProjectFile.mockResolvedValue(
      download(JSON.stringify({ ...body('stale message name') })),
    );

    const { conversation, stored } =
      await store.getConversationWithStoredVersion(LOCATOR, 'token');

    expect(conversation.name).toBe('Hi');
    expect(stored.conversation.name).toBe('stale message name');
  });

  it('saves unconditionally with If-Match: * and stamps the locator identity', async () => {
    const { store, client } = makeStore();
    client.uploadProjectFile.mockResolvedValue(status(200));

    const saved = await store.saveConversation(LOCATOR, 'token', {
      ...body(),
      id: 'other',
      folderId: 'other',
    });

    expect(saved.id).toBe(LOCATOR);
    expect(saved.folderId).toBe('projects/a1b2c3/support-quality');
    const [, , filePath, init] = client.uploadProjectFile.mock.calls[0];
    expect(filePath).toBe('conversations/gpt-4o__Hi__1');
    expect(init.headers['If-Match']).toBe('*');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('retries a write that met a change to another file and saves', async () => {
    const { store, client } = makeStore();
    const text = JSON.stringify(body());
    client.downloadProjectFile.mockResolvedValue(download(text, '"file"'));
    client.listProjectMetadata
      .mockResolvedValueOnce(metadata('"p1"'))
      .mockResolvedValueOnce(metadata('"p2"'));
    client.uploadProjectFile
      .mockResolvedValueOnce(status(412))
      .mockResolvedValueOnce(status(200));

    const result = await store.saveConversationIfMatch(
      LOCATOR,
      'token',
      body('Renamed'),
      hashProjectConversation(text),
    );

    expect(result).toEqual({
      isSaved: true,
      conversation: expect.objectContaining({ name: 'Renamed' }),
    });
    expect(client.uploadProjectFile.mock.calls[0][3].headers['If-Match']).toBe(
      '"p1"',
    );
    expect(client.uploadProjectFile.mock.calls[1][3].headers['If-Match']).toBe(
      '"p2"',
    );
  });

  it('conditions the write on the project metadata ETag, not the file download ETag', async () => {
    const { store, client } = makeStore();
    const text = JSON.stringify(body());
    client.downloadProjectFile.mockResolvedValue(download(text, '"file"'));
    client.listProjectMetadata.mockResolvedValue(metadata('"project"'));
    client.uploadProjectFile.mockResolvedValue(status(200));

    await store.saveConversationIfMatch(
      LOCATOR,
      'token',
      body(),
      hashProjectConversation(text),
    );

    expect(client.uploadProjectFile).toHaveBeenCalledOnce();
    expect(client.uploadProjectFile.mock.calls[0][3].headers['If-Match']).toBe(
      '"project"',
    );
    expect(client.listProjectMetadata.mock.invocationCallOrder[0]).toBeLessThan(
      client.downloadProjectFile.mock.invocationCallOrder[0],
    );
  });

  it('refuses a conditional write when the project metadata has no ETag', async () => {
    const { store, client } = makeStore();
    const text = JSON.stringify(body());
    client.downloadProjectFile.mockResolvedValue(download(text));
    client.listProjectMetadata.mockResolvedValue({
      ...metadata(''),
      data: { nodeType: 'ITEM', etag: '' },
    });

    await expect(
      store.saveConversationIfMatch(
        LOCATOR,
        'token',
        body(),
        hashProjectConversation(text),
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(client.uploadProjectFile).not.toHaveBeenCalled();
  });

  it('resolves isSaved false without writing when the file itself changed', async () => {
    const { store, client } = makeStore();
    client.downloadProjectFile.mockResolvedValue(
      download(JSON.stringify(body('changed elsewhere'))),
    );

    const result = await store.saveConversationIfMatch(
      LOCATOR,
      'token',
      body(),
      hashProjectConversation(JSON.stringify(body())),
    );

    expect(result).toEqual({ isSaved: false });
    expect(client.uploadProjectFile).not.toHaveBeenCalled();
  });

  it('gives up after a bounded number of 412 answers', async () => {
    const { store, client } = makeStore();
    const text = JSON.stringify(body());
    client.downloadProjectFile.mockResolvedValue(download(text));
    client.uploadProjectFile.mockResolvedValue(status(412));

    const result = await store.saveConversationIfMatch(
      LOCATOR,
      'token',
      body(),
      hashProjectConversation(text),
    );

    expect(result).toEqual({ isSaved: false });
    expect(client.uploadProjectFile).toHaveBeenCalledTimes(
      PROJECT_CONVERSATION_WRITE_ATTEMPTS,
    );
  });

  it('maps a Core 413 on a write to project-storage-full', async () => {
    const { store, client } = makeStore();
    client.uploadProjectFile.mockResolvedValue(status(413));

    const error = await store
      .saveConversation(LOCATOR, 'token', body())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PayloadTooLargeException);
    expect((error as PayloadTooLargeException).getResponse()).toMatchObject({
      code: ProjectCreateErrorCode.ProjectStorageFull,
    });
  });

  it('maps a Core 403 to 403', async () => {
    const { store, client } = makeStore();
    client.uploadProjectFile.mockResolvedValue(status(403));

    await expect(
      store.saveConversation(LOCATOR, 'token', body()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes with If-Match: * and maps a missing file to 404', async () => {
    const { store, client } = makeStore();
    client.deleteProjectFile.mockResolvedValueOnce(status(200));

    await store.deleteConversation(LOCATOR, 'token');

    expect(client.deleteProjectFile.mock.calls[0][3].headers['If-Match']).toBe(
      '*',
    );

    client.deleteProjectFile.mockResolvedValueOnce(status(404));
    await expect(
      store.deleteConversation(LOCATOR, 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never logs the project or conversation name', async () => {
    const { store, client } = makeStore();
    const debug = vi.mocked(Logger.prototype.debug);
    client.uploadProjectFile.mockResolvedValue(status(200));

    await store.saveConversation(LOCATOR, 'token', body());

    debug.mock.calls.flat().forEach((message) => {
      expect(String(message)).not.toContain('support-quality');
      expect(String(message)).not.toContain('gpt-4o__Hi__1');
    });
  });
});
