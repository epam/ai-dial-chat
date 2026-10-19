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

  it('asks before discarding edits on Cancel, and keeps editing when dismissed', async () => {
    const onCancel = vi.fn();
    renderEditor({
      isEditMode: true,
      initialValues: { name: 'summarize', content: 'Summarize:' },
      onCancel,
    });

    await user.type(await screen.findByDisplayValue('Summarize:'), ' the text');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    expect(screen.getByDisplayValue('Summarize: the text')).toBeTruthy();
  });

  it('leaves through Back once discarding edits is confirmed', async () => {
    const onBack = vi.fn();
    renderEditor({
      isEditMode: true,
      initialValues: { name: 'summarize', content: 'Summarize:' },
      onBack,
    });

    await user.type(await screen.findByDisplayValue('Summarize:'), ' the text');
    await user.click(screen.getByRole('button', { name: 'Back to prompts' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('leaves without asking once edits are reverted', async () => {
    const onCancel = vi.fn();
    renderEditor({
      isEditMode: true,
      initialValues: { name: 'summarize', content: 'Summarize:' },
      onCancel,
    });

    const name = screen.getByRole('textbox', { name: /Name/ });
    await user.type(name, 'x');
    await user.type(name, '{Backspace}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  describe('with a host-owned guard (onDirtyChange)', () => {
    const editProps = {
      isEditMode: true,
      initialValues: { name: 'summarize', content: 'Summarize:' },
    };

    it('reports clean on mount', () => {
      const onDirtyChange = vi.fn();
      renderEditor({ ...editProps, onDirtyChange });

      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it('cancels immediately with no confirmation after an edit', async () => {
      const onCancel = vi.fn();
      const onDirtyChange = vi.fn();
      renderEditor({ ...editProps, onCancel, onDirtyChange });

      await user.type(screen.getByRole('textbox', { name: /Name/ }), 'x');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
      expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    });

    it('calls onBack directly after an edit', async () => {
      const onBack = vi.fn();
      renderEditor({ ...editProps, onBack, onDirtyChange: vi.fn() });

      await user.type(screen.getByRole('textbox', { name: /Name/ }), 'x');
      await user.click(screen.getByRole('button', { name: 'Back to prompts' }));

      expect(onBack).toHaveBeenCalledOnce();
      expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    });

    it('reports dirty and then clean across an edit and its revert', async () => {
      const onDirtyChange = vi.fn();
      renderEditor({ ...editProps, onDirtyChange });

      const name = screen.getByRole('textbox', { name: /Name/ });
      await user.type(name, 'x');
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);

      await user.type(name, '{Backspace}');
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it('registers no unload warning while dirty', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      renderEditor({ ...editProps, onDirtyChange: vi.fn() });

      await user.type(screen.getByRole('textbox', { name: /Name/ }), 'x');

      expect(addSpy).not.toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function),
      );
      addSpy.mockRestore();
    });
  });

  it('shows a live description counter without capping the input', async () => {
    renderEditor({ descriptionMaxLength: 5 });

    const description = screen.getByRole('textbox', { name: /Description/ });
    expect(description.getAttribute('maxlength')).toBeNull();
    expect(screen.queryByText(/\/5$/)).toBeNull();

    await user.type(description, 'abc');

    expect(screen.getByText('3/5')).toBeTruthy();

    await user.type(description, 'def');

    expect((description as HTMLTextAreaElement).value).toBe('abcdef');
    expect(screen.getByText('6/5')).toBeTruthy();
  });

  it('reports each edited field through onFieldChange', async () => {
    const onFieldChange = vi.fn();
    renderEditor({ onFieldChange });

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'a');
    await user.type(screen.getByRole('textbox', { name: /Description/ }), 'b');
    await user.type(
      await screen.findByPlaceholderText('Write the prompt instructions'),
      'c',
    );

    expect(onFieldChange).toHaveBeenCalledWith('name', 'a');
    expect(onFieldChange).toHaveBeenCalledWith('description', 'b');
    expect(onFieldChange).toHaveBeenCalledWith('content', 'c');
  });

  it('marks the instructions editor invalid while it has an error', async () => {
    renderEditor({ errors: { content: 'Use 50000 characters or fewer.' } });

    await screen.findByPlaceholderText('Write the prompt instructions');

    expect(screen.getByText('Use 50000 characters or fewer.')).toBeTruthy();
    const instructions = screen.getByRole('group', { name: /Instructions/ });
    expect(
      // eslint-disable-next-line testing-library/no-node-access -- the invalid state is a CSS class on the unlabeled editor wrapper, which has no accessible role or text to query
      instructions.querySelector('[class*="contentInvalid"]'),
    ).toBeTruthy();
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

  describe('instructions refinement', () => {
    const initialValues = {
      name: 'summarize',
      description: 'Draft',
      content: 'Summarize:',
    };

    it('replaces the instructions with the refined text and offers Undo', async () => {
      const refined = '## Summarize\n- Key points';
      const onRefineInstructions = vi.fn().mockResolvedValue(refined);
      const onFieldChange = vi.fn();
      renderEditor({ initialValues, onRefineInstructions, onFieldChange });

      await user.click(
        await screen.findByRole('button', { name: 'Refine with AI' }),
      );

      expect(onRefineInstructions).toHaveBeenCalledWith(
        'Summarize:',
        expect.any(AbortSignal),
      );
      const content = await screen.findByRole<HTMLTextAreaElement>('textbox', {
        name: /Instructions/,
      });
      await waitFor(() => expect(content.value).toBe(refined));
      expect(onFieldChange).toHaveBeenCalledWith('content', refined);

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(content.value).toBe('Summarize:');
    });

    it('blocks the other refinement and submission while instructions refine', async () => {
      const onRefineInstructions = vi.fn(
        () => new Promise<string>(() => undefined),
      );
      const onRefineDescription = vi.fn().mockResolvedValue('Refined');
      const onSubmit = vi.fn();
      renderEditor({
        initialValues,
        onRefineDescription,
        onRefineInstructions,
        onSubmit,
      });

      await screen.findByRole('textbox', { name: /Instructions/ });
      const [descriptionAction, instructionsAction] = screen.getAllByRole(
        'button',
        { name: 'Refine with AI' },
      );
      await user.click(instructionsAction);

      expect(onRefineInstructions).toHaveBeenCalledOnce();
      await waitFor(() =>
        expect(descriptionAction.hasAttribute('disabled')).toBe(true),
      );
      await user.click(screen.getByRole('button', { name: 'Create' }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onRefineDescription).not.toHaveBeenCalled();
    });
  });
});
