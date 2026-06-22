import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileUploadStatus } from '../types/upload';
import UploadProgressModal from '../UploadProgressModal';

describe('UploadProgressModal', () => {
  it('renders legacy-style progress rows, summary, and cancel action', async () => {
    const onCancel = vi.fn();

    render(
      <UploadProgressModal
        batchState={{
          isOpen: true,
          files: [
            {
              id: '1',
              name: 'report.pdf',
              status: FileUploadStatus.Uploading,
              percent: 42,
            },
            {
              id: '2',
              name: 'notes.txt',
              status: FileUploadStatus.Queued,
            },
          ],
        }}
        uploadProgressTitle="Uploading files"
        uploadProgressText="1 of 2 complete"
        cancelLabel="Cancel"
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Uploading files')).toBeTruthy();
    expect(screen.getByText('1 of 2 complete')).toBeTruthy();
    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '42',
    );
    expect(screen.queryByText('Queued')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
