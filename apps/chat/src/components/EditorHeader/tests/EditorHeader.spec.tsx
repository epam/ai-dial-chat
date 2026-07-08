import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditorHeader from '../EditorHeader';

const renderHeader = (props?: Partial<Parameters<typeof EditorHeader>[0]>) =>
  render(
    <EditorHeader
      steps={[{ id: 'general', label: 'General' }]}
      currentStep="general"
      navAriaLabel="Editor steps"
      isSaving={false}
      cancelButtonLabel="Cancel"
      saveButtonLabel="Save"
      onChangeStep={vi.fn()}
      onCancel={vi.fn()}
      onSave={vi.fn()}
      {...props}
    />,
  );

describe('EditorHeader', () => {
  it('does not render a preview button when onPreview is not provided', () => {
    renderHeader();

    expect(
      screen.queryByRole('button', { name: /preview/i }),
    ).not.toBeTruthy();
  });

  it('renders the preview button labelled "Preview" when isPreviewing is false', () => {
    renderHeader({
      onPreview: vi.fn(),
      previewButtonLabel: 'Preview',
      exitPreviewButtonLabel: 'Exit preview',
      isPreviewing: false,
    });

    expect(
      screen.getByRole('button', { name: 'Preview' }),
    ).toBeTruthy();
  });

  it('renders the button labelled "Exit preview" when isPreviewing is true', () => {
    renderHeader({
      onPreview: vi.fn(),
      previewButtonLabel: 'Preview',
      exitPreviewButtonLabel: 'Exit preview',
      isPreviewing: true,
    });

    expect(
      screen.getByRole('button', { name: 'Exit preview' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeTruthy();
  });

  it('calls onPreview when the preview button is clicked', async () => {
    const onPreview = vi.fn();
    renderHeader({
      onPreview,
      previewButtonLabel: 'Preview',
      exitPreviewButtonLabel: 'Exit preview',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(onPreview).toHaveBeenCalledOnce();
  });

  it('disables Cancel and Save while previewing', () => {
    renderHeader({
      onPreview: vi.fn(),
      previewButtonLabel: 'Preview',
      exitPreviewButtonLabel: 'Exit preview',
      isPreviewing: true,
    });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
