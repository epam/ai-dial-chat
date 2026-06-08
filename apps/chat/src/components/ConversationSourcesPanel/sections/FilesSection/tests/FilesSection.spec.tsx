import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilesSection from '../FilesSection';

vi.mock('@epam/ai-dial-conversation-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: DisplayAttachment }) => (
    <div>{attachment.name}</div>
  ),
}));

const makeAttachment = (name: string): DisplayAttachment => ({
  id: name,
  name,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
});

describe('FilesSection', () => {
  it('renders the title', () => {
    render(
      <FilesSection attachments={[]} title="Files" emptyMessage="None." />,
    );
    expect(screen.getByText('Files')).toBeTruthy();
  });

  it('renders empty message when no attachments', () => {
    render(
      <FilesSection attachments={[]} title="Files" emptyMessage="No files." />,
    );
    expect(screen.getByText('No files.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders a card per attachment', () => {
    const attachments = [makeAttachment('a.pdf'), makeAttachment('b.pdf')];
    render(
      <FilesSection
        attachments={attachments}
        title="Files"
        emptyMessage="None."
      />,
    );
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText('b.pdf')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('has role=list grid when attachments present', () => {
    render(
      <FilesSection
        attachments={[makeAttachment('a.pdf')]}
        title="Files"
        emptyMessage="None."
      />,
    );
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
