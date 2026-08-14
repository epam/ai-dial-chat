import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PromptEditor } from '../PromptEditor';

const renderEditor = (props?: Partial<ComponentProps<typeof PromptEditor>>) =>
  render(
    <PromptEditor
      folders={[]}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

describe('PromptEditor', () => {
  const user = userEvent.setup({ delay: null });

  it('renders the create heading by default', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: 'Create prompt' })).toBeTruthy();
  });

  it('renders the edit heading in edit mode', () => {
    renderEditor({ isEditMode: true });

    expect(screen.getByRole('heading', { name: 'Edit prompt' })).toBeTruthy();
  });

  it('seeds the fields from initialValues', () => {
    renderEditor({
      initialValues: {
        name: 'summarize',
        description: 'Summarize a document',
        content: 'Summarize:',
        folderId: 'Work',
      },
      folders: [{ id: 'Work', name: 'Work' }],
    });

    expect(screen.getByDisplayValue('summarize')).toBeTruthy();
    expect(screen.getByDisplayValue('Summarize a document')).toBeTruthy();
    expect(screen.getByDisplayValue('Summarize:')).toBeTruthy();
  });

  it('re-seeds the fields when initialValues arrives later', async () => {
    const { rerender } = render(
      <PromptEditor folders={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.queryByDisplayValue('summarize')).toBeNull();

    rerender(
      <PromptEditor
        folders={[]}
        initialValues={{ name: 'summarize' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('summarize')).toBeTruthy();
  });

  it('submits the entered values, with the root folder as an empty string', async () => {
    const onSubmit = vi.fn();
    renderEditor({ onSubmit });

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'summarize');
    await user.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'Summarize:',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'summarize',
      description: '',
      content: 'Summarize:',
      folderId: '',
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
      folderId: '',
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

  it('announces the characters remaining only near the limit', async () => {
    renderEditor({ contentMaxLength: 12, counterAnnounceThreshold: 4 });

    const content = screen.getByRole('textbox', { name: /Prompt/ });
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
