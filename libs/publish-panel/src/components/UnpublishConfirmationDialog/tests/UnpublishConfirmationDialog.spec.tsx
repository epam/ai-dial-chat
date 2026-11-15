import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UnpublishConfirmationDialogProps } from '../../../models/unpublish-confirmation-dialog';
import { UnpublishConfirmationDialog } from '../UnpublishConfirmationDialog';

const renderDialog = (
  props: Partial<UnpublishConfirmationDialogProps> = {},
) => {
  const merged: UnpublishConfirmationDialogProps = {
    isOpen: true,
    name: 'Sales',
    folders: ['Organization/Data'],
    selectedFolder: null,
    onSelectedFolderChange: vi.fn(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  render(<UnpublishConfirmationDialog {...merged} />);
  return merged;
};

const dialog = () => within(screen.getByRole('dialog'));

describe('UnpublishConfirmationDialog', () => {
  it('names the single folder with the English defaults and enables confirm immediately', async () => {
    const { onConfirm } = renderDialog();

    expect(dialog().getByText('Unpublish?')).toBeTruthy();
    expect(dialog().getByText('Unpublish "Sales" from "Data"?')).toBeTruthy();
    expect(dialog().queryByRole('radiogroup')).toBeNull();
    await userEvent.click(dialog().getByRole('button', { name: 'Unpublish' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('renders the host copy from labels', () => {
    renderDialog({
      folders: [''],
      labels: {
        title: 'Unpublish project?',
        confirmLabel: 'Remove',
        cancelLabel: 'Keep',
        rootFolderLabel: 'Org',
        confirmMessage: (name: string, folder: string) => `${name} @ ${folder}`,
      },
    });

    expect(dialog().getByText('Unpublish project?')).toBeTruthy();
    expect(dialog().getByText('Sales @ Org')).toBeTruthy();
    expect(dialog().getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(dialog().getByRole('button', { name: 'Keep' })).toBeTruthy();
  });

  it('labels a root-folder publication as the organization by default', () => {
    renderDialog({ folders: [''] });

    expect(
      dialog().getByText('Unpublish "Sales" from "Organization"?'),
    ).toBeTruthy();
  });

  it('requires a folder pick when published to several folders', async () => {
    const { onSelectedFolderChange } = renderDialog({
      folders: ['Organization/Data', 'Organization/Sales'],
      labels: { folderGroupAriaLabel: 'Folders' },
    });

    expect(
      dialog().getByText('Choose which folder to unpublish "Sales" from.'),
    ).toBeTruthy();
    const group = dialog().getByRole('radiogroup', { name: 'Folders' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios.some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
    expect(
      dialog()
        .getByRole('button', { name: 'Unpublish' })
        .hasAttribute('disabled'),
    ).toBe(true);

    await userEvent.click(within(group).getByRole('radio', { name: 'Sales' }));
    expect(onSelectedFolderChange).toHaveBeenCalledWith('Organization/Sales');
  });

  it('enables confirm once a folder is picked', () => {
    renderDialog({
      folders: ['Organization/Data', 'Organization/Sales'],
      selectedFolder: 'Organization/Data',
    });

    expect(
      dialog()
        .getByRole('button', { name: 'Unpublish' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('applies the option typography class and color override', () => {
    renderDialog({
      folders: ['Organization/Data', 'Organization/Sales'],
      optionClassName: 'dial-body-text',
      colors: { optionText: 'red' },
    });

    const group = dialog().getByRole('radiogroup');
    // eslint-disable-next-line testing-library/no-node-access -- the role-less wrapper's inline CSS var is the assertion
    const wrapper = group.closest<HTMLElement>('div[style]');
    expect(wrapper?.style.getPropertyValue('--ucd-option-text')).toBe('red');
    // eslint-disable-next-line testing-library/no-node-access -- the option row has no role of its own; its class is the assertion
    expect(group.querySelector('.dial-body-text')).toBeTruthy();
  });

  it('disables both buttons and announces the status while loading', () => {
    renderDialog({ isLoading: true });

    expect(
      dialog()
        .getByRole('button', { name: 'Unpublish' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      dialog().getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText('Requesting unpublish…')).toBeTruthy();
  });

  it('calls onClose from Cancel without confirming', async () => {
    const { onClose, onConfirm } = renderDialog();

    await userEvent.click(dialog().getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
