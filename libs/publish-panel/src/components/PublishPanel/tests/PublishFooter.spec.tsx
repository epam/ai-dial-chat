import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublishPanelView } from '../../../types/publish-panel';
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

  it('keeps the "Publish" label for an existing version when replacing is not allowed', () => {
    renderFooter({ hasExistingPublicationInFolder: true, allowReplace: false });
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Update version 4.0.1' }),
    ).toBeNull();
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

  it('renders Publish as the primary button, not the neutral one', () => {
    renderFooter();
    const publishBtn = screen.getByRole('button', { name: 'Publish' });
    expect(publishBtn.className).toContain('dial-kit-primary-solid-button');
    expect(publishBtn.className).not.toContain('dial-kit-neutral-solid-button');
  });

  describe('folder view', () => {
    it('renders Select in place of the submit action', () => {
      renderFooter({ view: PublishPanelView.ChangeFolder });

      expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    });

    it('calls onSelectFolder when Select is clicked', async () => {
      const onSelectFolder = vi.fn();
      renderFooter({ view: PublishPanelView.ChangeFolder, onSelectFolder });

      await userEvent.click(screen.getByRole('button', { name: 'Select' }));

      expect(onSelectFolder).toHaveBeenCalledOnce();
    });

    it('disables Select while no folder is picked', () => {
      renderFooter({
        view: PublishPanelView.ChangeFolder,
        isSelectFolderDisabled: true,
      });

      expect(
        screen.getByRole('button', { name: 'Select' }).hasAttribute('disabled'),
      ).toBe(true);
    });
  });
});
