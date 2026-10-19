import type { AvatarPickerFileManagerModalProps } from '@epam/ai-dial-builder-form';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AvatarFileManagerModal from '../AvatarFileManagerModal';

interface CapturedProps {
  title: string;
  deleteConfirmTitle?: (names: string[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
}

vi.mock('../../DialFileManagerModal/DialFileManagerModal', () => ({
  default: ({
    title,
    deleteConfirmTitle,
    deleteConfirmBody,
  }: CapturedProps) => (
    <div>
      <span>{title}</span>
      <span>hostTitle:{String(deleteConfirmTitle === undefined)}</span>
      <div>{deleteConfirmBody(['files/bucket/icons/logo.svg'])}</div>
    </div>
  ),
}));

vi.mock('../../FileDeleteConfirmContent/FileDeleteConfirmContent', () => ({
  default: ({ names }: { names: string[] }) => (
    <span>unified:{names.join(',')}</span>
  ),
}));

const renderModal = () =>
  render(
    <AvatarFileManagerModal
      {...({
        isOpen: true,
        title: 'Add avatar',
        deleteConfirmTitle: () => 'Delete item',
        deleteConfirmBody: () => 'Are you sure you want to delete "x"?',
      } as unknown as AvatarPickerFileManagerModalProps)}
    />,
  );

describe('AvatarFileManagerModal', () => {
  it('passes the picker props through to the file manager modal', () => {
    renderModal();

    expect(screen.getByText('Add avatar')).toBeTruthy();
  });

  it('leaves the delete confirmation title to the file manager modal', () => {
    renderModal();

    expect(screen.getByText('hostTitle:true')).toBeTruthy();
    expect(screen.queryByText('Delete item')).toBeNull();
  });

  it('renders the shared delete confirmation body instead of the picker one', () => {
    renderModal();

    expect(
      screen.getByText('unified:files/bucket/icons/logo.svg'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Are you sure you want to delete "x"?'),
    ).toBeNull();
  });
});
