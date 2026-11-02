import { describe, expect, it, vi } from 'vitest';
import {
  createProjectsApiClient,
  type ProjectsConfiguredClient,
  splitProjectConversationId,
} from '../projects-api-client';

const PROJECT_ID = 'projects/a1b2c3/q4';
const CHAT_ID = `${PROJECT_ID}/conversations/gpt-4o__Hi__1`;
const PARTS = { id: PROJECT_ID, conversationName: 'gpt-4o__Hi__1' };

const makeClient = () => {
  const generated = {
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    downloadProjectRaw: vi.fn(async () => ({ raw: new Response('zip') })),
    downloadProjectFileRaw: vi.fn(async () => ({ raw: new Response('f') })),
    listProjectConversations: vi.fn(),
    createProjectConversation: vi.fn(),
    getProjectConversation: vi.fn(),
    saveProjectConversation: vi.fn(),
    renameProjectConversation: vi.fn(),
    deleteProjectConversation: vi.fn(),
    attachToProjectGenerationRaw: vi.fn(),
    watchProjectsRaw: vi.fn(),
  };
  return {
    generated,
    client: createProjectsApiClient(
      generated as unknown as ProjectsConfiguredClient,
    ),
  };
};

describe('splitProjectConversationId', () => {
  it('splits an id into the project and the file name', () => {
    expect(splitProjectConversationId(CHAT_ID)).toEqual({
      projectId: PROJECT_ID,
      conversationName: 'gpt-4o__Hi__1',
    });
    expect(
      splitProjectConversationId(
        'projects/a1b2c3/conversations/team/conversations/x',
      ),
    ).toEqual({
      projectId: 'projects/a1b2c3/conversations/team',
      conversationName: 'x',
    });
  });

  it('returns null for any other id', () => {
    expect(splitProjectConversationId('a1b2c3/gpt-4o__Hi__1')).toBeNull();
    expect(
      splitProjectConversationId('projects/a1b2c3/q4/context/x'),
    ).toBeNull();
  });
});

describe('createProjectsApiClient', () => {
  it('passes a signal only when one is given', async () => {
    const { client, generated } = makeClient();
    const signal = new AbortController().signal;

    await client.getProject(PROJECT_ID);
    await client.getProject(PROJECT_ID, signal);

    expect(generated.getProject).toHaveBeenNthCalledWith(1, { id: PROJECT_ID });
    expect(generated.getProject).toHaveBeenNthCalledWith(
      2,
      { id: PROJECT_ID },
      { signal },
    );
  });

  it('sends file names as JSON paired with the files', async () => {
    const { client, generated } = makeClient();
    const file = new File(['%PDF-'], 'retro.pdf');

    await client.createProject(
      { name: 'q4', description: 'd', instructions: 'i' },
      [file],
    );
    await client.updateProject({
      id: PROJECT_ID,
      fields: { name: 'q4', description: 'd', instructions: 'i' },
      newFiles: [file],
      removedFileNames: ['survey.xlsx'],
      contentVersion: '"cv1"',
    });

    expect(generated.createProject).toHaveBeenCalledWith({
      name: 'q4',
      description: 'd',
      instructions: 'i',
      fileNames: '["retro.pdf"]',
      files: [file],
    });
    expect(generated.updateProject).toHaveBeenCalledWith({
      id: PROJECT_ID,
      ifMatch: '"cv1"',
      name: 'q4',
      description: 'd',
      instructions: 'i',
      fileNames: '["retro.pdf"]',
      removedFileNames: '["survey.xlsx"]',
      files: [file],
    });
  });

  it('deletes with the contentVersion and returns the native download response', async () => {
    const { client, generated } = makeClient();

    await client.deleteProject(PROJECT_ID, '"cv1"');
    const archive = await client.downloadProjectArchive(PROJECT_ID);

    expect(generated.deleteProject).toHaveBeenCalledWith({
      id: PROJECT_ID,
      ifMatch: '"cv1"',
    });
    expect(await archive.text()).toBe('zip');
  });

  it('lists a page of project conversations from the given offset', async () => {
    const { client, generated } = makeClient();

    await client.listProjectConversations(PROJECT_ID, undefined, {
      offset: 50,
    });

    expect(generated.listProjectConversations).toHaveBeenCalledWith({
      id: PROJECT_ID,
      offset: 50,
    });
  });

  it('creates a project conversation with the first-message fields of a top-level create', async () => {
    const { client, generated } = makeClient();

    await client.createProjectConversation(PROJECT_ID, {
      firstMessage: 'Hi',
      deploymentId: 'gpt-4o',
      configurationValue: { mode: 'deep' },
    });

    expect(generated.createProjectConversation).toHaveBeenCalledWith({
      id: PROJECT_ID,
      createConversationDto: {
        firstMessage: 'Hi',
        deploymentId: 'gpt-4o',
        custom_content: { configuration_value: { mode: 'deep' } },
      },
    });
  });

  it('addresses a project conversation by project and file name', async () => {
    const { client, generated } = makeClient();
    const body = { id: CHAT_ID } as never;

    await client.saveProjectConversation(CHAT_ID, body);
    await client.renameProjectConversation(CHAT_ID, 'New');
    await client.deleteProjectConversation(CHAT_ID);

    expect(generated.saveProjectConversation).toHaveBeenCalledWith({
      ...PARTS,
      saveConversationBodyDto: { conversation: body },
    });
    expect(generated.renameProjectConversation).toHaveBeenCalledWith({
      ...PARTS,
      renameConversationBodyDto: { newTitle: 'New' },
    });
    expect(generated.deleteProjectConversation).toHaveBeenCalledWith(PARTS);
    expect(() => client.getProjectConversation('a1b2c3/x')).toThrow();
  });

  it('returns the attach stream and rejects an empty body', async () => {
    const { client, generated } = makeClient();
    const body = new ReadableStream<Uint8Array>();
    generated.attachToProjectGenerationRaw
      .mockResolvedValueOnce({ raw: new Response(body) })
      .mockResolvedValueOnce({ raw: new Response(null) });

    await expect(
      client.attachToProjectGeneration(PROJECT_ID, 'a1b2c3/q4/conversations/x'),
    ).resolves.toBeInstanceOf(ReadableStream);
    await expect(
      client.attachToProjectGeneration(PROJECT_ID, 'a1b2c3/q4/conversations/x'),
    ).rejects.toThrow();
    expect(generated.attachToProjectGenerationRaw).toHaveBeenCalledWith({
      id: PROJECT_ID,
      attachGenerationDto: { path: 'a1b2c3/q4/conversations/x' },
    });
  });

  it('returns the watch stream for the ids with the caller signal and rejects an empty body', async () => {
    const { client, generated } = makeClient();
    const signal = new AbortController().signal;
    generated.watchProjectsRaw
      .mockResolvedValueOnce({ raw: new Response(new ReadableStream()) })
      .mockResolvedValueOnce({ raw: new Response(null) });

    await expect(
      client.watchProjects([PROJECT_ID], signal),
    ).resolves.toBeInstanceOf(ReadableStream);
    await expect(client.watchProjects([PROJECT_ID])).rejects.toThrow();
    expect(generated.watchProjectsRaw).toHaveBeenNthCalledWith(
      1,
      { watchProjectsBodyDto: { ids: [PROJECT_ID] } },
      { signal },
    );
  });
});
