import { ShareFilesDtoPermissionEnum } from '@epam/chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShareFileModal from '../ShareFileModal';

const renderModal = (props?: Partial<ComponentProps<typeof ShareFileModal>>) =>
  render(
    <ShareFileModal
      targetName="report.pdf"
      isSubmitting={false}
      getTitle={(name) => `Share "${name}"`}
      readPermissionLabel="Can view"
      readWritePermissionLabel="Can edit"
      createLinkButtonLabel="Create link"
      copyLinkButtonLabel="Copy link"
      linkCopiedConfirmation="Link copied"
      cancelLabel="Cancel"
      errorMessage="Failed to create the share link"
      onCreateLink={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('ShareFileModal', () => {
  it('renders the target name and permission options', () => {
    renderModal();

    expect(screen.getByText('Share "report.pdf"')).toBeTruthy();
    expect(screen.getByText('Can view')).toBeTruthy();
    expect(screen.getByText('Can edit')).toBeTruthy();
  });

  it('calls onCreateLink with the selected permission on submit', async () => {
    const onCreateLink = vi
      .fn()
      .mockResolvedValue('https://chat.example.com/share/abc');

    renderModal({ onCreateLink });

    await userEvent.click(screen.getByText('Can edit'));
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    await waitFor(() =>
      expect(onCreateLink).toHaveBeenCalledWith(
        ShareFilesDtoPermissionEnum.ReadWrite,
      ),
    );
  });

  it('displays the returned link with a working copy-to-clipboard control', async () => {
    const onCreateLink = vi
      .fn()
      .mockResolvedValue('https://chat.example.com/share/abc');

    renderModal({ onCreateLink });

    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    const linkInput = await waitFor(() =>
      screen.getByDisplayValue('https://chat.example.com/share/abc'),
    );
    expect(linkInput).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://chat.example.com/share/abc',
    );
  });

  it('shows an inline error on failure without calling any notification callback', async () => {
    const onCreateLink = vi.fn().mockRejectedValue(new Error('failed'));

    renderModal({ onCreateLink });

    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Failed to create the share link',
      ),
    );
  });
});
