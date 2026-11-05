import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import UnpublishConfirmationDialog from '../UnpublishConfirmationDialog';

type Props = ComponentProps<typeof UnpublishConfirmationDialog>;

const UNPUBLISH = 'buttons.unpublish';
const CANCEL = 'buttons.cancel';

const renderDialog = (props: Partial<Props> = {}) => {
  const merged: Props = {
    isOpen: true,
    title: 'Unpublish project?',
    name: 'Sales',
    folders: ['Organization/Data'],
    selectedFolder: null,
    onSelectedFolderChange: vi.fn(),
    isLoading: false,
    confirmMessage: (name, folder) => `Unpublish ${name} from ${folder}?`,
    selectFolderMessage: (name) => `Pick a folder for ${name}`,
    folderGroupAriaLabel: 'Published folders',
    loadingStatusLabel: 'Requesting unpublish',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  render(<UnpublishConfirmationDialog {...merged} />);
  return merged;
};

const dialog = () => within(screen.getByRole('dialog'));

describe('UnpublishConfirmationDialog', () => {
  it('names the single folder and enables confirm immediately', async () => {
    const { onConfirm } = renderDialog();

    expect(dialog().getByText('Unpublish Sales from Data?')).toBeTruthy();
    expect(dialog().queryByRole('radiogroup')).toBeNull();
    await userEvent.click(dialog().getByRole('button', { name: UNPUBLISH }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('labels a root-folder publication as the organization', () => {
    renderDialog({ folders: [''] });

    expect(
      dialog().getByText('Unpublish Sales from basic.organization?'),
    ).toBeTruthy();
  });

  it('requires a folder pick when published to several folders', async () => {
    const { onSelectedFolderChange } = renderDialog({
      folders: ['Organization/Data', 'Organization/Sales'],
    });

    expect(dialog().getByText('Pick a folder for Sales')).toBeTruthy();
    const group = dialog().getByRole('radiogroup', {
      name: 'Published folders',
    });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios.some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
    expect(
      dialog()
        .getByRole('button', { name: UNPUBLISH })
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
        .getByRole('button', { name: UNPUBLISH })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('disables both buttons and announces the status while loading', () => {
    renderDialog({ isLoading: true });

    expect(
      dialog()
        .getByRole('button', { name: UNPUBLISH })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      dialog().getByRole('button', { name: CANCEL }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText('Requesting unpublish')).toBeTruthy();
  });

  it('calls onClose from Cancel without confirming', async () => {
    const { onClose, onConfirm } = renderDialog();

    await userEvent.click(dialog().getByRole('button', { name: CANCEL }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
