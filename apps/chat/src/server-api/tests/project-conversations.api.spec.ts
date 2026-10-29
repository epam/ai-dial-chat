import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectsApi } from '../api-client';
import {
  attachToProjectGeneration,
  createProjectConversation,
  deleteProjectConversation,
  getProjectConversation,
  listProjectConversations,
  renameProjectConversation,
  saveProjectConversation,
  splitProjectConversationId,
} from '../project-conversations.api';

vi.mock('../api-client', () => ({
  projectsApi: {
    listProjectConversations: vi.fn(),
    createProjectConversation: vi.fn(),
    getProjectConversation: vi.fn(),
    saveProjectConversation: vi.fn(),
    renameProjectConversation: vi.fn(),
    deleteProjectConversation: vi.fn(),
    attachToProjectGenerationRaw: vi.fn(),
  },
}));

const PROJECT_ID = 'projects/a1b2c3/q4';
const ID = `${PROJECT_ID}/conversations/gpt-4o__Hi__1`;
const PARTS = { id: PROJECT_ID, conversationName: 'gpt-4o__Hi__1' };

describe('project conversations adapter', () => {
  beforeEach(() => vi.resetAllMocks());

  it('splits an id into the project and the file name', () => {
    expect(splitProjectConversationId(ID)).toEqual({
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
    expect(splitProjectConversationId('a1b2c3/gpt-4o__Hi__1')).toBeNull();
  });

  it('lists with the caller signal', async () => {
    const signal = new AbortController().signal;

    await listProjectConversations(PROJECT_ID, signal);

    expect(projectsApi.listProjectConversations).toHaveBeenCalledWith(
      { id: PROJECT_ID },
      { signal },
    );
  });

  it('creates with the same first-message fields as a top-level create', async () => {
    await createProjectConversation(
      PROJECT_ID,
      'Hi',
      'gpt-4o',
      [{ type: 'text/csv', title: 'a.csv', url: 'files/a.csv' }],
      { mode: 'deep' },
    );

    expect(projectsApi.createProjectConversation).toHaveBeenCalledWith({
      id: PROJECT_ID,
      createConversationDto: {
        firstMessage: 'Hi',
        deploymentId: 'gpt-4o',
        custom_content: {
          attachments: [
            { type: 'text/csv', title: 'a.csv', url: 'files/a.csv' },
          ],
          configuration_value: { mode: 'deep' },
        },
      },
    });
  });

  it('addresses get, save, rename and delete by project and file name', async () => {
    const body = { id: ID } as never;

    await getProjectConversation(ID);
    await saveProjectConversation(ID, body);
    await renameProjectConversation(ID, 'New');
    await deleteProjectConversation(ID);

    expect(projectsApi.getProjectConversation).toHaveBeenCalledWith(PARTS);
    expect(projectsApi.saveProjectConversation).toHaveBeenCalledWith({
      ...PARTS,
      saveConversationBodyDto: { conversation: body },
    });
    expect(projectsApi.renameProjectConversation).toHaveBeenCalledWith({
      ...PARTS,
      renameConversationBodyDto: { newTitle: 'New' },
    });
    expect(projectsApi.deleteProjectConversation).toHaveBeenCalledWith(PARTS);
  });

  it('rejects an id that is not a project conversation', () => {
    expect(() => getProjectConversation('a1b2c3/x')).toThrow();
  });

  it('attaches through the project endpoint with the stream path', async () => {
    const body = new ReadableStream();
    vi.mocked(projectsApi.attachToProjectGenerationRaw).mockResolvedValue({
      raw: { body },
    } as never);

    await expect(
      attachToProjectGeneration(PROJECT_ID, 'a1b2c3/q4/conversations/x'),
    ).resolves.toBe(body);
    expect(projectsApi.attachToProjectGenerationRaw).toHaveBeenCalledWith({
      id: PROJECT_ID,
      attachGenerationDto: { path: 'a1b2c3/q4/conversations/x' },
    });
  });
});
