import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });

  it('forwards onRemove when a card remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentTray
        attachments={[makeAttachment('1', 'a.pdf')]}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove attachment'));
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('renders cards as read-only when no remove handler is provided', () => {
    render(<AttachmentTray attachments={[makeAttachment('1', 'a.pdf')]} />);
    expect(screen.queryByLabelText('Remove attachment')).toBeNull();
  });

  it('cards have no onClick when onAttachmentClick is not provided', () => {
    render(<AttachmentTray attachments={[makeAttachment('1', 'a.pdf')]} />);
    // no card button (only possible if onClick is absent)
    expect(
      screen.queryByRole('button', { name: 'Open attachment' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
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

  it('activating a card calls onAttachmentClick with the correct attachment', () => {
    const onAttachmentClick = vi.fn();
    const attachment = makeAttachment('att-1', 'report.pdf');
    render(
      <AttachmentTray
        attachments={[attachment]}
        onAttachmentClick={onAttachmentClick}
        labels={{ clickLabel: 'Download file' }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Download file'));
    expect(onAttachmentClick).toHaveBeenCalledWith(attachment);
  });

  it('remove button does not propagate to onAttachmentClick', () => {
    const onAttachmentClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <AttachmentTray
        attachments={[makeAttachment('1', 'a.pdf')]}
        onRemove={onRemove}
        onAttachmentClick={onAttachmentClick}
        labels={{ clickLabel: 'Download file' }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove attachment'));
    expect(onRemove).toHaveBeenCalledWith('1');
    expect(onAttachmentClick).not.toHaveBeenCalled();
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
