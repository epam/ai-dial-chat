import type { Attachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentCard } from '../AttachmentCard.js';

const makeAttachment = (overrides?: Partial<Attachment>): Attachment => ({
  id: 'a1',
  name: 'report.pdf',
  contentType: 'application/pdf',
  file: new File([''], 'report.pdf', { type: 'application/pdf' }),
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('AttachmentCard', () => {
  it('renders the file name', () => {
    render(<AttachmentCard attachment={makeAttachment()} onRemove={vi.fn()} />);
    expect(screen.getByText('report.pdf')).toBeTruthy();
  });

  it('renders an img thumbnail for image attachments', () => {
    const attachment = makeAttachment({
      contentType: 'image/png',
      type: AttachmentType.Image,
      previewUrl: 'blob:preview',
    });
    const { container } = render(
      <AttachmentCard attachment={attachment} onRemove={vi.fn()} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toContain('blob:preview');
  });

  it('hides remove button during loading state', () => {
    const attachment = makeAttachment({ status: RequestStatus.Loading });
    render(<AttachmentCard attachment={attachment} onRemove={vi.fn()} />);
    expect(screen.queryByLabelText('Remove attachment')).toBeNull();
  });

  it('shows remove button in idle state', () => {
    render(<AttachmentCard attachment={makeAttachment()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText('Remove attachment')).toBeTruthy();
  });

  it('shows retry button in error state', () => {
    const attachment = makeAttachment({ status: RequestStatus.Error });
    render(
      <AttachmentCard
        attachment={attachment}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Retry upload')).toBeTruthy();
  });

  it('calls onRemove with attachment id when remove is clicked', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentCard attachment={makeAttachment()} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByLabelText('Remove attachment'));
    expect(onRemove).toHaveBeenCalledWith('a1');
  });

  it('calls onRemove when remove button is activated via keyboard', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentCard attachment={makeAttachment()} onRemove={onRemove} />,
    );
    const btn = screen.getByLabelText('Remove attachment');
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledWith('a1');
  });

  it('calls onRetry with attachment id when retry is clicked', () => {
    const onRetry = vi.fn();
    const attachment = makeAttachment({ status: RequestStatus.Error });
    render(
      <AttachmentCard
        attachment={attachment}
        onRemove={vi.fn()}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByLabelText('Retry upload'));
    expect(onRetry).toHaveBeenCalledWith('a1');
  });
});
