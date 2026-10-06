import type { EntityEditorProps } from '@epam/ai-dial-builder-form';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PromptEditor } from '../PromptEditor';

vi.mock('@epam/ai-dial-builder-form', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-builder-form')>();
  /* The real shell renders its actions twice (header + mobile bar); the stub
     renders them once, keeps the real MetadataForm, and stamps the section
     classes it is handed. */
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
      metadataTitle,
      setup,
      setupTitle,
      metadataSectionClassName,
      setupSectionClassName,
      labels,
    }: EntityEditorProps) => (
      <div>
        <button
          type="button"
          aria-label={labels?.backAriaLabel}
          onClick={onBack}
        />
        <h1>{title}</h1>
        <span role="status">
          {isSubmitting ? labels?.savingStatusLabel : ''}
        </span>
        <button type="button" disabled={isSubmitting} onClick={onCancel}>
          {labels?.cancelLabel}
        </button>
        <button type="button" disabled={isSubmitting} onClick={onSubmit}>
          {submitLabel}
        </button>
        <section className={metadataSectionClassName}>
          {metadataTitle !== null && (
            <h2>{metadataTitle ?? labels?.metadataTitle}</h2>
          )}
          {metadata}
        </section>
        {setup != null && (
          <section className={setupSectionClassName}>
            <h2>{setupTitle ?? labels?.setupTitle}</h2>
            {setup}
          </section>
        )}
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
        id,
      }: {
        value?: string;
        onChange?: (value: string) => void;
        placeholder?: string;
        id?: string;
      }) => (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
        />
      ),
    }),
}));

const renderEditor = (props?: Partial<ComponentProps<typeof PromptEditor>>) =>
  render(<PromptEditor onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);

describe('PromptEditor', () => {
  const user = userEvent.setup({ delay: null });

  it('renders the create heading by default', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: 'Create prompt' })).toBeTruthy();
  });

  it('renders Name, Description and Instructions in one column, without section headings, version, avatar, tags, or folder', () => {
    renderEditor();

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.getByRole('group', { name: /Instructions/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Description/ })).toBeTruthy();
    expect(screen.queryByText('Avatar')).toBeNull();
    expect(screen.queryByText('Tags')).toBeNull();
    expect(screen.queryByText('Version')).toBeNull();
    expect(screen.queryByText('Folder')).toBeNull();
  });

  it('renders the edit heading in edit mode', () => {
    renderEditor({ isEditMode: true });

    expect(screen.getByRole('heading', { name: 'Edit prompt' })).toBeTruthy();
  });

  it('seeds the fields from initialValues', async () => {
    renderEditor({
      initialValues: {
        name: 'summarize',
        description: 'Summarize a document',
        content: 'Summarize:',
      },
    });

    expect(screen.getByDisplayValue('summarize')).toBeTruthy();
    expect(screen.getByDisplayValue('Summarize a document')).toBeTruthy();
    expect(await screen.findByDisplayValue('Summarize:')).toBeTruthy();
  });

  it('re-seeds the fields when initialValues arrives later', async () => {
    const { rerender } = render(
      <PromptEditor onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.queryByDisplayValue('summarize')).toBeNull();

    rerender(
      <PromptEditor
        initialValues={{ name: 'summarize' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
  });

  it('submits the entered values', async () => {
    const onSubmit = vi.fn();
    renderEditor({ onSubmit });

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'summarize');
    await user.type(
      await screen.findByPlaceholderText('Write the prompt instructions'),
      'Summarize:',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'summarize',
      description: '',
      content: 'Summarize:',
    });
  });

  it('does not validate on its own â€” the host owns the storage contract', async () => {
    const onSubmit = vi.fn();
    renderEditor({ onSubmit });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: '',
      description: '',
      content: '',
    });
  });

  it('renders host-supplied inline errors', () => {
    renderEditor({
      errors: { name: 'Name is required', content: 'Prompt is too long' },
    });

    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Prompt is too long')).toBeTruthy();
  });

  it('moves focus to Instructions when it is the only invalid field', async () => {
    const { rerender } = renderEditor();
    const instructions = await screen.findByRole('textbox', {
      name: /Instructions/,
    });

    rerender(
      <PromptEditor
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        errors={{ content: 'Prompt is required' }}
      />,
    );

    await waitFor(() => expect(instructions.matches(':focus')).toBe(true));
  });

  it('leaves focus to the metadata form when Name is invalid too', async () => {
    const { rerender } = renderEditor();
    const instructions = await screen.findByRole('textbox', {
      name: /Instructions/,
    });

    rerender(
      <PromptEditor
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        errors={{ name: 'Name is required', content: 'Prompt is required' }}
      />,
    );

    expect(instructions.matches(':focus')).toBe(false);
  });

  it('blocks submission and announces status while saving', async () => {
    const onSubmit = vi.fn();
    renderEditor({ isSaving: true, onSubmit });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('status').map((status) => status.textContent),
    ).toContain('Saving');
  });

  it('renders a labelled spinner instead of the form while loading', () => {
    renderEditor({ isEditMode: true, isLoading: true });

    expect(screen.getByRole('status', { name: 'Loading prompt' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /Name/ })).toBeNull();
  });

  it('renders an error state with retry instead of an empty form on load failure', async () => {
    const onRetry = vi.fn();
    renderEditor({ isEditMode: true, hasLoadError: true, onRetry });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /Name/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('omits the retry button when the host cannot retry', () => {
    renderEditor({ isEditMode: true, hasLoadError: true });

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('calls onCancel without submitting', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderEditor({ onSubmit, onCancel });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls the dedicated back callback from the header', async () => {
    const onBack = vi.fn();
    renderEditor({ onBack });

    await user.click(screen.getByRole('button', { name: 'Back to prompts' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('announces the characters remaining only near the limit', async () => {
    renderEditor({ contentMaxLength: 12, counterAnnounceThreshold: 4 });

    const content = await screen.findByPlaceholderText(
      'Write the prompt instructions',
    );
    await user.type(content, 'abcd');
    expect(screen.queryByText(/characters remaining/)).toBeNull();

    await user.type(content, 'efghi');
    expect(screen.getByText('3 characters remaining')).toBeTruthy();
  });

  it('applies label overrides', () => {
    renderEditor({
      labels: {
        createTitle: 'Neuer Prompt',
        createLabel: 'Erstellen',
      },
    });

    expect(screen.getByRole('heading', { name: 'Neuer Prompt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeTruthy();
  });

  it('labels the primary button Create in create mode and Save in edit mode', () => {
    const { unmount } = renderEditor();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    unmount();

    renderEditor({ isEditMode: true, labels: { saveLabel: 'OK' } });
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });
  it('names the Instructions editor through its label', () => {
    renderEditor();

    expect(screen.getByRole('textbox', { name: /Instructions/ })).toBeTruthy();
  });

  describe('description refinement', () => {
    const initialValues = {
      name: 'summarize',
      description: 'Draft',
      content: 'Summarize:',
    };

    it('hides the Refine with AI action when the host supplies no callback', () => {
      renderEditor({ initialValues });

      expect(
        screen.queryByRole('button', { name: 'Refine with AI' }),
      ).toBeNull();
    });

    it('replaces the description with the refined text and offers Undo', async () => {
      const onRefineDescription = vi.fn().mockResolvedValue('Refined draft');
      renderEditor({ initialValues, onRefineDescription });

      await user.click(
        await screen.findByRole('button', { name: 'Refine with AI' }),
      );

      expect(onRefineDescription).toHaveBeenCalledWith(
        'Draft',
        expect.any(AbortSignal),
      );
      const description = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: /Description/,
      });
      await waitFor(() => expect(description.value).toBe('Refined draft'));

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(description.value).toBe('Draft');
    });
  });
});
