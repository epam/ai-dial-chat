import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../../context/NotificationContext';
import { usePrompts } from '../../../context/PromptsContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useUiFeature } from '../../../hooks/useUiFeature';
import {
  createPrompt,
  createPromptFolder,
  deletePromptFolder,
  getPrompt,
  movePrompt,
  updatePrompt,
} from '../../../server-api/prompts.api';
import PromptEditor from '../PromptEditor';

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../context/PromptsContext', () => ({
  usePrompts: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: vi.fn(),
}));

vi.mock('../../../server-api/prompts.api', () => ({
  createPrompt: vi.fn(),
  createPromptFolder: vi.fn(),
  deletePromptFolder: vi.fn(),
  getPrompt: vi.fn(),
  movePrompt: vi.fn(),
  renamePromptFolder: vi.fn(),
  updatePrompt: vi.fn(),
}));

const promptDto = {
  id: 'Work/AI/summarize',
  bucket: 'my-bucket',
  name: 'summarize',
  description: 'Summarize a document',
  content: 'Summarize the following text:',
  folderId: 'Work/AI',
  createdAt: 1,
  updatedAt: 2,
};

const refetchPrompts = vi.fn().mockResolvedValue(undefined);
const showNotification = vi.fn();

describe('PromptEditor', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature === OverlayFeature.Prompts,
    );
    vi.mocked(usePrompts).mockReturnValue({
      prompts: [],
      folders: [
        { id: 'Work', name: 'Work' },
        { id: 'Work/AI', name: 'AI' },
      ],
      sharedWithMe: [],
      publicPrompts: [],
      publicFolders: [],
      isLoading: false,
      error: null,
      refetchPrompts,
      refetchPublicPrompts: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(createPrompt).mockResolvedValue(promptDto);
    vi.mocked(updatePrompt).mockResolvedValue(promptDto);
    vi.mocked(movePrompt).mockResolvedValue(promptDto);
    vi.mocked(getPrompt).mockResolvedValue(promptDto);
    vi.mocked(createPromptFolder).mockResolvedValue({
      id: 'Drafts',
      name: 'Drafts',
    });
    vi.mocked(deletePromptFolder).mockResolvedValue(undefined);
  });

  const fillRequiredFields = async (name: string, content: string) => {
    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.nameLabel/ }),
      name,
    );
    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.contentLabel/ }),
      content,
    );
  };

  it('redirects to the catalog when the prompts feature is disabled', () => {
    vi.mocked(useUiFeature).mockReturnValue(false);

    render(<PromptEditor />);

    expect(mockNavigate).toHaveBeenCalledWith('/catalog', { replace: true });
    expect(getPrompt).not.toHaveBeenCalled();
  });

  it('opens an empty create form when no id param is present', () => {
    render(<PromptEditor />);

    expect(screen.getByText('promptEditor.createTitle')).toBeTruthy();
    expect(getPrompt).not.toHaveBeenCalled();
  });

  it('loads the prompt into the form in edit mode', async () => {
    mockSearchParams = new URLSearchParams({ id: 'Work/AI/summarize' });

    render(<PromptEditor />);

    await waitFor(() =>
      expect(getPrompt).toHaveBeenCalledWith('Work/AI/summarize'),
    );
    expect(screen.getByText('promptEditor.editTitle')).toBeTruthy();
    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
  });

  it('shows an error state with retry when the prompt cannot be loaded', async () => {
    mockSearchParams = new URLSearchParams({ id: 'Work/AI/summarize' });
    vi.mocked(getPrompt).mockRejectedValue(new Error('404'));

    render(<PromptEditor />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('promptEditor.loadError')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'promptEditor.retryLabel' }),
    ).toBeTruthy();
    /* An error must not silently degrade into an empty create form. */
    expect(screen.queryByText('promptEditor.createTitle')).toBeNull();
  });

  it('creates a root-level prompt', async () => {
    render(<PromptEditor />);

    await fillRequiredFields('summarize', 'Summarize:');
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(createPrompt).toHaveBeenCalledWith({
        name: 'summarize',
        description: undefined,
        content: 'Summarize:',
        folderId: '',
      }),
    );
    expect(refetchPrompts).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
    expect(showNotification).toHaveBeenCalledWith({
      variant: 'success',
      title: 'entityNotifications.prompt.createdTitle',
      message: 'entityNotifications.prompt.created',
    });
  });

  it('blocks submission and shows an inline error for an empty name', async () => {
    render(<PromptEditor />);

    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.contentLabel/ }),
      'Summarize:',
    );
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.required')).toBeTruthy();
  });

  it('blocks submission for a name containing a slash', async () => {
    render(<PromptEditor />);

    await fillRequiredFields('Work/summarize', 'Summarize:');
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.nameInvalid')).toBeTruthy();
  });

  it('blocks submission for content over the length limit', async () => {
    render(<PromptEditor />);

    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.nameLabel/ }),
      'summarize',
    );
    const contentField = screen.getByRole('textbox', {
      name: /promptEditor.contentLabel/,
    });
    await user.click(contentField);
    await user.paste('x'.repeat(50001));
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.contentTooLong')).toBeTruthy();
  });

  it('shows an inline name error on a 409 conflict and stays on the form', async () => {
    /* Shape thrown by the generated client: a ResponseError carrying `response`. */
    vi.mocked(createPrompt).mockRejectedValue({
      response: {
        status: 409,
        json: () => Promise.resolve({ message: 'Prompt already exists' }),
      },
    });

    render(<PromptEditor />);
    await fillRequiredFields('summarize', 'Summarize:');
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(
      await screen.findByText('promptEditor.error.nameConflict'),
    ).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it('keeps entered values and notifies when the save fails', async () => {
    vi.mocked(createPrompt).mockRejectedValue(new Error('502'));

    render(<PromptEditor />);
    await fillRequiredFields('summarize', 'Summarize:');
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      ),
    );
    expect(screen.getByDisplayValue('summarize')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it('updates content only, without dispatching a move', async () => {
    mockSearchParams = new URLSearchParams({ id: 'Work/AI/summarize' });

    render(<PromptEditor />);
    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();

    const contentField = screen.getByRole('textbox', {
      name: /promptEditor.contentLabel/,
    });
    await user.clear(contentField);
    await user.type(contentField, 'Summarize in three bullets:');
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(updatePrompt).toHaveBeenCalledWith('Work/AI/summarize', {
        name: 'summarize',
        description: 'Summarize a document',
        content: 'Summarize in three bullets:',
      }),
    );
    expect(movePrompt).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith({
      variant: 'success',
      title: 'entityNotifications.prompt.editedTitle',
      message: 'entityNotifications.prompt.edited',
    });
  });

  it('updates a writable shared prompt in the owner bucket and locks its folder', async () => {
    mockSearchParams = new URLSearchParams({
      id: 'prompts/owner-bucket/Work/AI/summarize',
    });
    vi.mocked(getPrompt).mockResolvedValue({
      ...promptDto,
      bucket: 'owner-bucket',
      isMy: false,
      canEdit: true,
      sharedWithMe: true,
    });

    render(<PromptEditor />);

    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
    expect(getPrompt).toHaveBeenCalledWith('Work/AI/summarize', 'owner-bucket');
    expect(
      (
        screen.getByRole('combobox', {
          name: /promptEditor.folderLabel/,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(updatePrompt).toHaveBeenCalledWith(
        'Work/AI/summarize',
        {
          name: 'summarize',
          description: 'Summarize a document',
          content: 'Summarize the following text:',
        },
        'owner-bucket',
      ),
    );
  });

  it('creates a folder and refetches so the picker sees it', async () => {
    render(<PromptEditor />);

    await user.click(
      screen.getByRole('button', {
        name: 'promptEditor.folderCreateLabel',
      }),
    );
    const folderForm = screen.getByRole('group', {
      name: 'promptEditor.folderCreateLabel',
    });
    await user.type(
      within(folderForm).getByRole('textbox', {
        name: /promptEditor.folderNameLabel/,
      }),
      'Drafts',
    );
    await user.click(
      within(folderForm).getByRole('button', { name: 'buttons.save' }),
    );

    await waitFor(() =>
      expect(createPromptFolder).toHaveBeenCalledWith({
        name: 'Drafts',
        parentId: undefined,
      }),
    );
    expect(refetchPrompts).toHaveBeenCalled();
  });

  it('shows an inline conflict error when the folder already exists', async () => {
    vi.mocked(createPromptFolder).mockRejectedValue({
      response: {
        status: 409,
        json: () => Promise.resolve({ message: 'Folder already exists' }),
      },
    });

    render(<PromptEditor />);

    await user.click(
      screen.getByRole('button', { name: 'promptEditor.folderCreateLabel' }),
    );
    const folderForm = screen.getByRole('group', {
      name: 'promptEditor.folderCreateLabel',
    });
    await user.type(
      within(folderForm).getByRole('textbox', {
        name: /promptEditor.folderNameLabel/,
      }),
      'Work',
    );
    await user.click(
      within(folderForm).getByRole('button', { name: 'buttons.save' }),
    );

    expect(
      await screen.findByText('promptEditor.error.nameConflict'),
    ).toBeTruthy();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('rejects a folder name the storage contract does not allow, without dispatching', async () => {
    render(<PromptEditor />);

    await user.click(
      screen.getByRole('button', { name: 'promptEditor.folderCreateLabel' }),
    );
    const folderForm = screen.getByRole('group', {
      name: 'promptEditor.folderCreateLabel',
    });
    await user.type(
      within(folderForm).getByRole('textbox', {
        name: /promptEditor.folderNameLabel/,
      }),
      'bad/name',
    );
    await user.click(
      within(folderForm).getByRole('button', { name: 'buttons.save' }),
    );

    expect(createPromptFolder).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.nameInvalid')).toBeTruthy();
  });

  it('navigates to the return url on cancel without dispatching a mutation', async () => {
    mockSearchParams = new URLSearchParams({ returnUrl: '/catalog' });

    render(<PromptEditor />);
    await user.click(screen.getByRole('button', { name: 'buttons.cancel' }));

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
    expect(createPrompt).not.toHaveBeenCalled();
  });
});
