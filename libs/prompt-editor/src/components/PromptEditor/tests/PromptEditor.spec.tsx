import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PromptEditor } from '../PromptEditor';

vi.mock('@epam/ai-dial-ui-kit', async () => {
  const actual = await vi.importActual<typeof import('@epam/ai-dial-ui-kit')>(
    '@epam/ai-dial-ui-kit',
  );

  return {
    ...actual,
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
  };
});

const renderEditor = (props?: Partial<ComponentProps<typeof PromptEditor>>) =>
  render(<PromptEditor onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);

describe('PromptEditor', () => {
  const user = userEvent.setup({ delay: null });

  it('renders the create heading by default', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: 'Create prompt' })).toBeTruthy();
  });

  it('renders a flat form without section headings, a version field, or a folder picker', () => {
    renderEditor();

    expect(screen.queryByText('Details')).toBeNull();
    expect(screen.queryByText('Configuration')).toBeNull();
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
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'summarize',
      description: '',
      content: 'Summarize:',
    });
  });

  it('does not validate on its own — the host owns the storage contract', async () => {
    const onSubmit = vi.fn();
    renderEditor({ onSubmit });

    await user.click(screen.getByRole('button', { name: 'Save' }));

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

  it('blocks submission and announces status while saving', async () => {
    const onSubmit = vi.fn();
    renderEditor({ isSaving: true, onSubmit });

    await user.click(screen.getByRole('button', { name: 'Save' }));

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
    renderEditor({ labels: { createTitle: 'Neuer Prompt', saveLabel: 'OK' } });

    expect(screen.getByRole('heading', { name: 'Neuer Prompt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });
});
