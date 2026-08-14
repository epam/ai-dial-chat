import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentTray } from '../AttachmentTray';

const makeAttachment = (id: string, name = 'file.pdf'): DisplayAttachment => ({
  id,
  name,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
});

describe('AttachmentTray', () => {
  it('returns null when attachments list is empty', () => {
    render(<AttachmentTray attachments={[]} onRemove={vi.fn()} />);
    expect(document.body.textContent).toBe('');
  });

  it('renders a card for each attachment', () => {
    const attachments = [
      makeAttachment('1', 'a.pdf'),
      makeAttachment('2', 'b.pdf'),
    ];
    render(<AttachmentTray attachments={attachments} onRemove={vi.fn()} />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });

  it('renders cards as read-only when no remove handler is provided', () => {
    render(<AttachmentTray attachments={[makeAttachment('1', 'a.pdf')]} />);
    expect(screen.queryByLabelText('Remove attachment')).toBeNull();
  });

  it('cards receive onClick and clickLabel when onAttachmentClick is provided', () => {
    const onAttachmentClick = vi.fn();
    render(
      <AttachmentTray
        attachments={[makeAttachment('1', 'a.pdf')]}
        onAttachmentClick={onAttachmentClick}
        labels={{ clickLabel: 'Download file' }}
      />,
    );
    expect(screen.getByLabelText('Download file')).toBeTruthy();
  });

  it('disappears when last card is removed (empty list passed)', () => {
    const { rerender } = render(
      <AttachmentTray attachments={[makeAttachment('1')]} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('file')).toBeTruthy();
    rerender(<AttachmentTray attachments={[]} onRemove={vi.fn()} />);
    expect(screen.queryByText('file')).toBeNull();
    expect(document.body.textContent).toBe('');
  });
});
