import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublishFooter } from '../PublishFooter';

const renderFooter = (props?: Partial<ComponentProps<typeof PublishFooter>>) =>
  render(
    <PublishFooter
      version="4.0.1"
      hasExistingPublicationInFolder={false}
      isSubmitDisabled={false}
      isSubmitLoading={false}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    />,
  );

describe('PublishFooter', () => {
  it('renders a "Publish" label and disables submit when no folder is selected', () => {
    renderFooter({ isSubmitDisabled: true });
    const button = screen.getByRole('button', { name: 'Publish' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('renders the "Publish" label once a folder is selected, without the folder name', () => {
    renderFooter({ isSubmitDisabled: false });
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  });

  it('renders an "Update version" label when the version already exists in the folder', () => {
    renderFooter({ hasExistingPublicationInFolder: true });
    expect(
      screen.getByRole('button', { name: 'Update version 4.0.1' }),
    ).toBeTruthy();
  });

  it('renders the in-progress label and disables submit while submitting', () => {
    renderFooter({ isSubmitLoading: true, isSubmitDisabled: true });
    const button = screen.getByRole('button', { name: 'Publishing…' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('disables Cancel while submitting so users cannot abandon an in-flight request', () => {
    renderFooter({ isSubmitLoading: true, isSubmitDisabled: true });
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    renderFooter({ onCancel });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onSubmit when the submit button is clicked', async () => {
    const onSubmit = vi.fn();
    renderFooter({ onSubmit });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('gives Publish the same secondary (neutral) style as Cancel, both non-primary', () => {
    renderFooter();
    const publishBtn = screen.getByRole('button', { name: 'Publish' });
    expect(publishBtn.className).toContain('dial-neutral-outlined-button');
    expect(publishBtn.className).not.toContain('dial-primary-solid-button');
  });
});
