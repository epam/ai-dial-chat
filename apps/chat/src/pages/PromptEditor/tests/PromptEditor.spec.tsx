import type { EntityEditorProps } from '@epam/ai-dial-builder-form';
import { CatalogCreationType } from '@epam/ai-dial-chat-api-client';
import {
  isResourceCreateAdapter,
  type ResourceSaveAdapter,
  ResourceSaveOutcome,
  type ResourceSaveResult,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../../context/NotificationContext';
import { usePrompts } from '../../../context/PromptsContext';
import {
  resetCatalogCreationState,
  setCatalogCreationState,
} from '../../../context/tests/catalog-creation-state';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { promptsApi } from '../../../server-api/api-client';
import { getPrompt, updatePrompt } from '../../../server-api/prompts.api';
import PromptEditor from '../PromptEditor';

vi.mock('../../../context/AppConfigContext', async () => {
  const { useCatalogCreationState } =
    await import('../../../context/tests/catalog-creation-state');
  return {
    useAppConfig: () => ({
      status: 'ready',
      config: {},
      ...useCatalogCreationState(),
    }),
  };
});
vi.mock('@epam/ai-dial-builder-form', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-builder-form')>();
  /* The real shell renders its actions twice (header + mobile bar); the stub renders them once. */
  return {
    ...actual,
    EntityEditor: ({
      title,
      onBack,
      onCancel,
      onSubmit,
      submitLabel,
      isSubmitting,
      metadata,
      setup,
      labels,
    }: EntityEditorProps) => (
      <div>
        <button
          type="button"
          aria-label={labels?.backAriaLabel}
          onClick={onBack}
        />
        <h1>{title}</h1>
        <button type="button" disabled={isSubmitting} onClick={onCancel}>
          {labels?.cancelLabel}
        </button>
        <button type="button" disabled={isSubmitting} onClick={onSubmit}>
          {submitLabel}
        </button>
        <div>{metadata}</div>
        <div>{setup}</div>
      </div>
    ),
  };
});

vi.mock('@epam/ai-dial-ui-kit/editors', () => ({
  LazyMarkdownEditor: () =>
    Promise.resolve({
      MarkdownEditor: ({
        value,
        onChange,
        placeholder,
      }: {
        value?: string;
        onChange?: (value: string) => void;
        placeholder?: string;
      }) => (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
        />
      ),
    }),
}));

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

/* The router-level guard is covered by its own spec; here only its wiring is. */
const mockAllowNextNavigation = vi.fn();
const mockUseBuilderLeaveGuard = vi.fn((_options: { isDirty: boolean }) => ({
  allowNextNavigation: mockAllowNextNavigation,
}));
vi.mock('../../../hooks/unsaved-changes/useBuilderLeaveGuard', () => ({
  useBuilderLeaveGuard: (options: { isDirty: boolean }) =>
    mockUseBuilderLeaveGuard(options),
}));
const getReportedDirty = () =>
  mockUseBuilderLeaveGuard.mock.lastCall?.[0].isDirty;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../context/PromptsContext', () => ({
  usePrompts: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'light' }),
}));

vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: vi.fn(),
}));

vi.mock('../../../server-api/prompts.api', () => ({
  getPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  listPrompts: vi.fn(),
  movePrompt: vi.fn(),
}));

const mockSavePanelProps = vi.fn();
vi.mock(
  '../../../components/ResourceSavePanelContainer/ResourceSavePanelContainer',
  () => ({
    default: (props: {
      isOpen: boolean;
      adapter: ResourceSaveAdapter;
      onSaved: (result: ResourceSaveResult | { outcome: string }) => void;
    }) => {
      mockSavePanelProps(props);
      const [createError, setCreateError] = useState('');
      /* A create adapter runs the real create into the root folder, the way the panel does. */
      const handleFinish = async () => {
        if (!isResourceCreateAdapter(props.adapter)) {
          props.onSaved({ outcome: 'saved' });
          return;
        }
        try {
          const { id } = await props.adapter.createIn([]);
          props.onSaved({
            outcome: ResourceSaveOutcome.Saved,
            savedId: id,
            isCreated: true,
            isNewVersion: false,
            isPublished: false,
          });
        } catch {
          setCreateError('Create failed');
        }
      };
      return props.isOpen ? (
        <div role="dialog" aria-label="Save panel">
          <button onClick={handleFinish}>Finish save</button>
          <p>{createError}</p>
        </div>
      ) : null;
    },
  }),
);
vi.mock('../../../server-api/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server-api/api-client')>()),
  promptsApi: { createPrompt: vi.fn() },
}));

const promptDto = {
  id: 'prompts/my-bucket/Work/AI/summarize',
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
    resetCatalogCreationState();
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
    vi.mocked(promptsApi.createPrompt).mockResolvedValue(promptDto);
    vi.mocked(updatePrompt).mockResolvedValue(promptDto);
    vi.mocked(getPrompt).mockResolvedValue(promptDto);
  });

  const fillRequiredFields = async (name: string, content: string) => {
    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.nameLabel/ }),
      name,
    );
    await user.type(
      await screen.findByPlaceholderText('promptEditor.contentPlaceholder'),
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
    expect(screen.getByRole('button', { name: 'buttons.create' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'buttons.back' })).toBeTruthy();
    expect(getPrompt).not.toHaveBeenCalled();
  });

  it('loads the prompt into the form in edit mode', async () => {
    mockSearchParams = new URLSearchParams({
      id: 'prompts/my-bucket/Work/AI/summarize',
    });

    render(<PromptEditor />);

    await waitFor(() =>
      expect(getPrompt).toHaveBeenCalledWith(
        'prompts/my-bucket/Work/AI/summarize',
      ),
    );
    expect(screen.getByText('promptEditor.editTitle')).toBeTruthy();
    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'buttons.save' })).toBeTruthy();
  });

  it('shows an error state with retry when the prompt cannot be loaded', async () => {
    mockSearchParams = new URLSearchParams({
      id: 'prompts/my-bucket/Work/AI/summarize',
    });
    vi.mocked(getPrompt).mockRejectedValue(new Error('404'));

    render(<PromptEditor />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('promptEditor.loadError')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'buttons.tryAgain' }),
    ).toBeTruthy();
    /* An error must not silently degrade into an empty create form. */
    expect(screen.queryByText('promptEditor.createTitle')).toBeNull();
  });

  /* Create opens the Save panel; the stub's Finish save runs the create adapter. */
  const createThroughPanel = async () => {
    await user.click(screen.getByRole('button', { name: 'buttons.create' }));
    await screen.findByRole('dialog', { name: 'Save panel' });
    await user.click(screen.getByRole('button', { name: 'Finish save' }));
  };

  it('creates a root-level prompt through the Save panel and leaves for the catalog', async () => {
    render(<PromptEditor />);

    await fillRequiredFields('summarize', 'Summarize:');
    await user.click(screen.getByRole('button', { name: 'buttons.create' }));

    expect(
      await screen.findByRole('dialog', { name: 'Save panel' }),
    ).toBeTruthy();
    expect(promptsApi.createPrompt).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Finish save' }));

    await waitFor(() =>
      expect(promptsApi.createPrompt).toHaveBeenCalledWith({
        createPromptDto: {
          name: 'summarize',
          description: undefined,
          content: 'Summarize:',
        },
      }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/catalog'));
    expect(refetchPrompts).toHaveBeenCalled();
    /* The panel confirms the create; the editor adds no second notification. */
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an inline error for an empty name', async () => {
    render(<PromptEditor />);

    await user.type(
      await screen.findByPlaceholderText('promptEditor.contentPlaceholder'),
      'Summarize:',
    );
    await user.click(screen.getByRole('button', { name: 'buttons.create' }));

    expect(promptsApi.createPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.required')).toBeTruthy();
  });

  it('blocks submission for a name containing a slash', async () => {
    render(<PromptEditor />);

    await fillRequiredFields('Work/summarize', 'Summarize:');
    await user.click(screen.getByRole('button', { name: 'buttons.create' }));

    expect(promptsApi.createPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.nameInvalid')).toBeTruthy();
  });

  it('blocks submission for content over the length limit', async () => {
    render(<PromptEditor />);

    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.nameLabel/ }),
      'summarize',
    );
    const contentField = await screen.findByPlaceholderText(
      'promptEditor.contentPlaceholder',
    );
    await user.click(contentField);
    await user.paste('x'.repeat(50001));
    await user.click(screen.getByRole('button', { name: 'buttons.create' }));

    expect(promptsApi.createPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('promptEditor.error.contentTooLong')).toBeTruthy();
  });

  it('shows an over-long name error while typing and clears it once shortened', async () => {
    render(<PromptEditor />);

    const nameField = screen.getByRole('textbox', {
      name: /promptEditor.nameLabel/,
    });
    await user.click(nameField);
    await user.paste('x'.repeat(257));

    expect(screen.getByText('promptEditor.error.nameTooLong')).toBeTruthy();

    await user.type(nameField, '{Backspace}');

    expect(screen.queryByText('promptEditor.error.nameTooLong')).toBeNull();
  });

  it('keeps an over-long pasted description, flags it while typing and blocks create', async () => {
    render(<PromptEditor />);

    await user.type(
      screen.getByRole('textbox', { name: /promptEditor.nameLabel/ }),
      'summarize',
    );
    const descriptionField = screen.getByRole('textbox', {
      name: /promptEditor.descriptionLabel/,
    });
    await user.click(descriptionField);
    await user.paste(`${'a'.repeat(1996)}12345`);

    expect((descriptionField as HTMLTextAreaElement).value).toHaveLength(2001);
    expect(
      screen.getByText('promptEditor.error.descriptionTooLong'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'buttons.create' }));

    expect(promptsApi.createPrompt).not.toHaveBeenCalled();

    await user.type(descriptionField, '{Backspace}');

    expect(
      screen.queryByText('promptEditor.error.descriptionTooLong'),
    ).toBeNull();
  });

  it('shows an over-long instructions error while typing', async () => {
    render(<PromptEditor />);

    await user.click(
      await screen.findByPlaceholderText('promptEditor.contentPlaceholder'),
    );
    await user.paste('x'.repeat(50001));

    expect(screen.getByText('promptEditor.error.contentTooLong')).toBeTruthy();
  });

  it('does not flag an emptied name as required until submit', async () => {
    render(<PromptEditor />);

    const nameField = screen.getByRole('textbox', {
      name: /promptEditor.nameLabel/,
    });
    await user.type(nameField, 'a');
    await user.clear(nameField);

    expect(screen.queryByText('promptEditor.error.required')).toBeNull();
  });

  it('leaves a 409 create conflict to the panel and shows no inline name error', async () => {
    /* Shape thrown by the generated client: a ResponseError carrying `response`. */
    vi.mocked(promptsApi.createPrompt).mockRejectedValue({
      response: {
        status: 409,
        json: () => Promise.resolve({ message: 'Prompt already exists' }),
      },
    });

    render(<PromptEditor />);
    await fillRequiredFields('summarize', 'Summarize:');
    await createThroughPanel();

    expect(await screen.findByText('Create failed')).toBeTruthy();
    expect(screen.queryByText('promptEditor.error.nameConflict')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it('keeps entered values and the panel open when the create fails', async () => {
    vi.mocked(promptsApi.createPrompt).mockRejectedValue(new Error('502'));

    render(<PromptEditor />);
    await fillRequiredFields('summarize', 'Summarize:');
    await createThroughPanel();

    expect(await screen.findByText('Create failed')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Save panel' })).toBeTruthy();
    expect(screen.getByDisplayValue('summarize')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
    expect(refetchPrompts).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('updates the prompt in place', async () => {
    mockSearchParams = new URLSearchParams({
      id: 'prompts/my-bucket/Work/AI/summarize',
    });

    render(<PromptEditor />);
    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();

    const contentField = await screen.findByPlaceholderText(
      'promptEditor.contentPlaceholder',
    );
    await user.clear(contentField);
    await user.click(contentField);
    await user.paste('Summarize in three bullets:');
    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(updatePrompt).toHaveBeenCalledWith(
        'prompts/my-bucket/Work/AI/summarize',
        {
          name: 'summarize',
          description: 'Summarize a document',
          content: 'Summarize in three bullets:',
        },
      ),
    );
    expect(showNotification).toHaveBeenCalledWith({
      variant: 'success',
      title: 'entityNotifications.prompt.editedTitle',
      message: 'entityNotifications.prompt.edited',
    });
  });

  describe('Save panel for an own prompt', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams({ id: promptDto.id });
      vi.mocked(getPrompt).mockResolvedValue({ ...promptDto, isMy: true });
    });

    const openPanel = async () => {
      render(<PromptEditor />);
      expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'buttons.save' }));
      return screen.findByRole('dialog', { name: 'Save panel' });
    };

    it('opens the Save panel at the prompt folder instead of updating in place', async () => {
      await openPanel();
      expect(updatePrompt).not.toHaveBeenCalled();
      expect(mockSavePanelProps).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOpen: true,
          resourceId: promptDto.id,
          currentFolderPath: ['Work', 'AI'],
          adapter: expect.objectContaining({ isVersioned: false }),
        }),
      );
    });

    it('refetches prompts and leaves for the catalog once the panel has saved', async () => {
      await openPanel();
      await user.click(screen.getByRole('button', { name: 'Finish save' }));
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/catalog'),
      );
      expect(refetchPrompts).toHaveBeenCalled();
      expect(mockAllowNextNavigation).toHaveBeenCalled();
    });
  });

  it('updates a writable shared prompt using the owner-bucket-qualified id', async () => {
    mockSearchParams = new URLSearchParams({
      id: 'prompts/owner-bucket/Work/AI/summarize',
    });
    vi.mocked(getPrompt).mockResolvedValue({
      ...promptDto,
      id: 'prompts/owner-bucket/Work/AI/summarize',
      isMy: false,
      canEdit: true,
      sharedWithMe: true,
    });

    render(<PromptEditor />);

    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
    expect(getPrompt).toHaveBeenCalledWith(
      'prompts/owner-bucket/Work/AI/summarize',
    );

    await user.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(updatePrompt).toHaveBeenCalledWith(
        'prompts/owner-bucket/Work/AI/summarize',
        {
          name: 'summarize',
          description: 'Summarize a document',
          content: 'Summarize the following text:',
        },
      ),
    );
  });
  it('navigates to the catalog on cancel without dispatching a mutation', async () => {
    render(<PromptEditor />);
    await user.click(screen.getByRole('button', { name: 'buttons.cancel' }));

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
    expect(promptsApi.createPrompt).not.toHaveBeenCalled();
  });

  describe('creation permissions', () => {
    const denyPrompts = () =>
      setCatalogCreationState({
        allowedTypes: Object.values(CatalogCreationType).filter(
          (type) => type !== CatalogCreationType.Prompt,
        ),
        restrictedSchemaIds: [],
      });

    it('shows the denied state on a direct create route and mounts no form', () => {
      denyPrompts();
      render(<PromptEditor />);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'catalog.creation.denied',
        }),
      ).toBeTruthy();
      expect(screen.queryByText('promptEditor.createTitle')).toBeNull();
      expect(promptsApi.createPrompt).not.toHaveBeenCalled();
    });

    it('creates a prompt when prompt creation is allowed', async () => {
      setCatalogCreationState({
        allowedTypes: [CatalogCreationType.Prompt],
        restrictedSchemaIds: [],
      });
      render(<PromptEditor />);

      await fillRequiredFields('summarize', 'Summarize:');
      await createThroughPanel();

      await waitFor(() => expect(promptsApi.createPrompt).toHaveBeenCalled());
    });

    it('blocks the create request when permission is lost while the form is open', async () => {
      render(<PromptEditor />);
      await fillRequiredFields('summarize', 'Summarize:');

      act(() => denyPrompts());
      await user.click(screen.getByRole('button', { name: 'buttons.create' }));

      expect(promptsApi.createPrompt).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'catalog.creation.denied' }),
      );
    });

    it('still loads and saves an existing prompt when creation is denied', async () => {
      denyPrompts();
      mockSearchParams = new URLSearchParams({ id: promptDto.id });
      render(<PromptEditor />);

      expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'buttons.save' }));

      await waitFor(() => expect(updatePrompt).toHaveBeenCalled());
      expect(promptsApi.createPrompt).not.toHaveBeenCalled();
    });

    it('treats an empty id parameter as edit mode, as before', async () => {
      denyPrompts();
      mockSearchParams = new URLSearchParams({ id: '' });
      render(<PromptEditor />);

      expect(screen.queryByText('catalog.creation.denied')).toBeNull();
      await waitFor(() => expect(getPrompt).toHaveBeenCalledWith(''));
    });

    it('keeps the failed-load error state rather than offering creation', async () => {
      denyPrompts();
      mockSearchParams = new URLSearchParams({ id: promptDto.id });
      vi.mocked(getPrompt).mockRejectedValue(new Error('404'));
      render(<PromptEditor />);

      expect(await screen.findByText('promptEditor.loadError')).toBeTruthy();
      expect(screen.queryByText('promptEditor.createTitle')).toBeNull();
    });
  });

  describe('leave guard wiring', () => {
    it('reports the form dirty state to the leave guard', async () => {
      render(<PromptEditor />);
      expect(getReportedDirty()).toBe(false);

      await fillRequiredFields('summarize', 'Summarize:');

      expect(getReportedDirty()).toBe(true);
    });

    it('leaves through a plain navigation on a dirty Cancel, with no dialog of its own', async () => {
      render(<PromptEditor />);
      await fillRequiredFields('summarize', 'Summarize:');

      await user.click(screen.getByRole('button', { name: 'buttons.cancel' }));

      expect(mockNavigate).toHaveBeenCalledWith('/catalog');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('allows the next navigation before the post-save exit', async () => {
      render(<PromptEditor />);
      await fillRequiredFields('summarize', 'Summarize:');

      await createThroughPanel();

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/catalog'),
      );
      expect(mockAllowNextNavigation).toHaveBeenCalledOnce();
      expect(mockAllowNextNavigation.mock.invocationCallOrder[0]).toBeLessThan(
        mockNavigate.mock.invocationCallOrder[0],
      );
    });
  });
});
