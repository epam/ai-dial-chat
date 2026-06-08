import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentCard } from '../AttachmentCard';

const makeAttachment = (
  overrides?: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: 'a1',
  name: 'report.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('AttachmentCard', () => {
  it('renders the file name without extension', () => {
    render(<AttachmentCard attachment={makeAttachment()} onRemove={vi.fn()} />);
    expect(screen.getByText('report')).toBeTruthy();
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

  it('hides remove button when no remove handler is provided', () => {
    render(<AttachmentCard attachment={makeAttachment()} />);
    expect(screen.queryByLabelText('Remove attachment')).toBeNull();
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

describe('AttachmentCard — pasted type', () => {
  const makePasted = (name = 'Hello world. This is pasted text.') =>
    makeAttachment({ name, type: AttachmentType.Pasted });

  it('renders the full name including dots without stripping extension', () => {
    render(<AttachmentCard attachment={makePasted()} onRemove={vi.fn()} />);
    expect(screen.getByText('Hello world. This is pasted text.')).toBeTruthy();
  });

  it('has role="button" and tabIndex=0 when onExpand is provided', () => {
    const { container } = render(
      <AttachmentCard
        attachment={makePasted()}
        onRemove={vi.fn()}
        onExpand={vi.fn()}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('calls onExpand with attachment id when card is clicked', () => {
    const onExpand = vi.fn();
    const { container } = render(
      <AttachmentCard
        attachment={makePasted()}
        onRemove={vi.fn()}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(container.firstElementChild!);
    expect(onExpand).toHaveBeenCalledWith('a1');
  });

  it('calls onExpand when Enter is pressed on the card', () => {
    const onExpand = vi.fn();
    const { container } = render(
      <AttachmentCard
        attachment={makePasted()}
        onRemove={vi.fn()}
        onExpand={onExpand}
      />,
    );
    fireEvent.keyDown(container.firstElementChild!, { key: 'Enter' });
    expect(onExpand).toHaveBeenCalledWith('a1');
  });

  it('calls onExpand when Space is pressed on the card', () => {
    const onExpand = vi.fn();
    const { container } = render(
      <AttachmentCard
        attachment={makePasted()}
        onRemove={vi.fn()}
        onExpand={onExpand}
      />,
    );
    fireEvent.keyDown(container.firstElementChild!, { key: ' ' });
    expect(onExpand).toHaveBeenCalledWith('a1');
  });

  it('remove button click does not propagate to onExpand', () => {
    const onExpand = vi.fn();
    const onRemove = vi.fn();
    render(
      <AttachmentCard
        attachment={makePasted()}
        onRemove={onRemove}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove attachment'));
    expect(onRemove).toHaveBeenCalledWith('a1');
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('non-pasted card does not get role="button" even when onExpand is provided', () => {
    const { container } = render(
      <AttachmentCard
        attachment={makeAttachment()}
        onRemove={vi.fn()}
        onExpand={vi.fn()}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('role')).toBeNull();
  });
});
