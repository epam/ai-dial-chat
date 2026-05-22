import type { Attachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentTray } from '../AttachmentTray.js';

const makeAttachment = (id: string, name = 'file.pdf'): Attachment => ({
  id,
  name,
  contentType: 'application/pdf',
  file: new File([''], name, { type: 'application/pdf' }),
  type: AttachmentType.File,
  status: RequestStatus.Idle,
});

describe('AttachmentTray', () => {
  it('returns null when attachments list is empty', () => {
    const { container } = render(
      <AttachmentTray attachments={[]} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a card for each attachment', () => {
    const attachments = [
      makeAttachment('1', 'a.pdf'),
      makeAttachment('2', 'b.pdf'),
    ];
    render(<AttachmentTray attachments={attachments} onRemove={vi.fn()} />);
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText('b.pdf')).toBeTruthy();
  });

  it('forwards onRemove when a card remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentTray
        attachments={[makeAttachment('1', 'a.pdf')]}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(
      screen.getByLabelText('conversationInput.attachment.remove'),
    );
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('disappears when last card is removed (empty list passed)', () => {
    const { rerender, container } = render(
      <AttachmentTray attachments={[makeAttachment('1')]} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).not.toBeNull();
    rerender(<AttachmentTray attachments={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
