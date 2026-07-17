import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const getRenderedCard = (container: HTMLElement): HTMLElement => {
  const card = container.firstElementChild;
  if (!(card instanceof HTMLElement)) {
    throw new Error('Expected attachment card to be rendered');
  }
  return card;
};

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
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('decoding')).toBe('async');
  });

  it('renders remote image url when previewUrl is absent', () => {
    const attachment = makeAttachment({
      contentType: 'image/png',
      type: AttachmentType.Image,
      url: 'https://example.com/image.png',
    });
    const { container } = render(
      <AttachmentCard attachment={attachment} onRemove={vi.fn()} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toBe('https://example.com/image.png');
  });

  it('shows image placeholder until thumbnail has loaded', () => {
    const attachment = makeAttachment({
      contentType: 'image/png',
      type: AttachmentType.Image,
      previewUrl: 'blob:preview',
    });
    const { container } = render(
      <AttachmentCard attachment={attachment} onRemove={vi.fn()} />,
    );
    const img = container.querySelector('img');
    expect(container.querySelector('.absolute.inset-0')).toBeTruthy();
    expect(img?.className).toContain('opacity-0');
    if (!img) {
      throw new Error('Expected image thumbnail to be rendered');
    }

    fireEvent.load(img);

    expect(container.querySelector('.absolute.inset-0')).toBeNull();
    expect(img?.className).toContain('opacity-100');
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

  it('hides retry button when errorReason is UnsupportedType', () => {
    const attachment = makeAttachment({
      status: RequestStatus.Error,
      errorReason: AttachmentErrorReason.UnsupportedType,
    });
    render(
      <AttachmentCard
        attachment={attachment}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Retry upload')).toBeNull();
    expect(screen.getByLabelText('Remove attachment')).toBeTruthy();
  });

  it('shows retry button when errorReason is Network', () => {
    const attachment = makeAttachment({
      status: RequestStatus.Error,
      errorReason: AttachmentErrorReason.Network,
    });
    render(
      <AttachmentCard
        attachment={attachment}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Retry upload')).toBeTruthy();
  });

  it('shows retry button when errorReason is undefined (generic error)', () => {
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
});

describe('AttachmentCard — error card layout', () => {
  it('renders file name in the bottom area in error state', () => {
    const attachment = makeAttachment({ status: RequestStatus.Error });
    const { container } = render(
      <AttachmentCard attachment={attachment} onRemove={vi.fn()} />,
    );
    const nonImageContent = container.querySelector('.flex.flex-col.gap-3.p-3');
    expect(nonImageContent).toBeTruthy();
    const children = Array.from(nonImageContent?.children ?? []);
    // First child: icon+label row; second child (flex-1): filename
    expect(children.length).toBeGreaterThanOrEqual(2);
    const filenameArea = children[1];
    expect(filenameArea?.textContent).toContain('report');
  });

  it('renders file name in the top area in normal (non-error) state', () => {
    const attachment = makeAttachment({ status: RequestStatus.Idle });
    const { container } = render(
      <AttachmentCard attachment={attachment} onRemove={vi.fn()} />,
    );
    const nonImageContent = container.querySelector('.flex.flex-col.gap-3.p-3');
    const children = Array.from(nonImageContent?.children ?? []);
    // First child (flex-1): filename; second child: icon+label row
    const filenameArea = children[0];
    expect(filenameArea?.textContent).toContain('report');
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
    fireEvent.click(getRenderedCard(container));
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
    fireEvent.keyDown(getRenderedCard(container), { key: 'Enter' });
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
    fireEvent.keyDown(getRenderedCard(container), { key: ' ' });
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

describe('AttachmentCard — onClick', () => {
  it('card is inert without onClick: no role, no tabIndex, no cursor-pointer', () => {
    const { container } = render(
      <AttachmentCard attachment={makeAttachment()} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(card.className).not.toContain('cursor-pointer');
  });

  it('card has role="button", tabIndex=0, and cursor-pointer when onClick is provided', () => {
    const { container } = render(
      <AttachmentCard attachment={makeAttachment()} onClick={vi.fn()} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.className).toContain('cursor-pointer');
  });

  it('uses default aria-label "Open attachment" when clickLabel is omitted', () => {
    const { container } = render(
      <AttachmentCard attachment={makeAttachment()} onClick={vi.fn()} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('aria-label')).toBe('Open attachment');
  });

  it('uses provided clickLabel as aria-label', () => {
    const { container } = render(
      <AttachmentCard
        attachment={makeAttachment()}
        onClick={vi.fn()}
        labels={{ clickLabel: 'Download file' }}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('aria-label')).toBe('Download file');
  });

  it('calls onClick with attachment id on card click', () => {
    const onClick = vi.fn();
    const { container } = render(
      <AttachmentCard attachment={makeAttachment()} onClick={onClick} />,
    );
    fireEvent.click(getRenderedCard(container));
    expect(onClick).toHaveBeenCalledWith('a1');
  });

  it('calls onClick on Enter key press', () => {
    const onClick = vi.fn();
    const { container } = render(
      <AttachmentCard attachment={makeAttachment()} onClick={onClick} />,
    );
    fireEvent.keyDown(getRenderedCard(container), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledWith('a1');
  });

  it('calls onClick on Space key press', () => {
    const onClick = vi.fn();
    const { container } = render(
      <AttachmentCard attachment={makeAttachment()} onClick={onClick} />,
    );
    fireEvent.keyDown(getRenderedCard(container), { key: ' ' });
    expect(onClick).toHaveBeenCalledWith('a1');
  });

  it('remove button click does not propagate to onClick', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <AttachmentCard
        attachment={makeAttachment()}
        onClick={onClick}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove attachment'));
    expect(onRemove).toHaveBeenCalledWith('a1');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('onExpand takes precedence over onClick for pasted cards', () => {
    const onClick = vi.fn();
    const onExpand = vi.fn();
    const pasted = makeAttachment({ type: AttachmentType.Pasted });
    const { container } = render(
      <AttachmentCard
        attachment={pasted}
        onClick={onClick}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(getRenderedCard(container));
    expect(onExpand).toHaveBeenCalledWith('a1');
    expect(onClick).not.toHaveBeenCalled();
  });

  describe('click gating by upload status', () => {
    // A loading or failed attachment isn't actually downloadable yet, so
    // the whole card must not look or behave clickable — matches
    it('is not clickable while the attachment is still uploading', () => {
      const onClick = vi.fn();
      const { container } = render(
        <AttachmentCard
          attachment={makeAttachment({ status: RequestStatus.Loading })}
          onClick={onClick}
        />,
      );
      const card = getRenderedCard(container);
      expect(card.getAttribute('role')).toBeNull();
      expect(card.getAttribute('tabindex')).toBeNull();
      fireEvent.click(card);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('is not clickable after a failed upload', () => {
      const onClick = vi.fn();
      const { container } = render(
        <AttachmentCard
          attachment={makeAttachment({ status: RequestStatus.Error })}
          onClick={onClick}
        />,
      );
      const card = getRenderedCard(container);
      expect(card.getAttribute('role')).toBeNull();
      expect(card.getAttribute('tabindex')).toBeNull();
      fireEvent.click(card);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('is clickable again once the attachment is idle', () => {
      const onClick = vi.fn();
      const { container } = render(
        <AttachmentCard
          attachment={makeAttachment({ status: RequestStatus.Idle })}
          onClick={onClick}
        />,
      );
      fireEvent.click(getRenderedCard(container));
      expect(onClick).toHaveBeenCalledWith('a1');
    });
  });

  describe('showHoverDownloadIcon', () => {
    const image = makeAttachment({
      type: AttachmentType.Image,
      contentType: 'image/png',
      previewUrl: 'https://example.com/a.png',
    });

    it('is hidden by default even when onClick is provided', () => {
      const { container } = render(
        <AttachmentCard attachment={image} onClick={vi.fn()} />,
      );
      expect(container.querySelector('svg.tabler-icon-download')).toBeNull();
    });

    it('renders a decorative download icon with no accessible name when enabled', () => {
      const { container } = render(
        <AttachmentCard
          attachment={image}
          onClick={vi.fn()}
          showHoverDownloadIcon
        />,
      );
      const icon = container.querySelector('svg.tabler-icon-download');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });

    it('does not render the decorative icon alongside the remove button', () => {
      const { container } = render(
        <AttachmentCard
          attachment={image}
          onClick={vi.fn()}
          onRemove={vi.fn()}
          showHoverDownloadIcon
        />,
      );
      expect(container.querySelector('svg.tabler-icon-download')).toBeNull();
    });

    it('renders an interactive download button when onDownload is provided', () => {
      render(
        <AttachmentCard
          attachment={image}
          showHoverDownloadIcon
          onDownload={vi.fn()}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Download attachment' }),
      ).toBeTruthy();
    });

    it('calls onDownload with attachment id when the download button is clicked', async () => {
      const onDownload = vi.fn();
      render(
        <AttachmentCard
          attachment={image}
          showHoverDownloadIcon
          onDownload={onDownload}
        />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Download attachment' }),
      );
      expect(onDownload).toHaveBeenCalledWith('a1');
    });

    it('does not propagate the download button click to the card', async () => {
      const onClick = vi.fn();
      const onDownload = vi.fn();
      render(
        <AttachmentCard
          attachment={image}
          onClick={onClick}
          showHoverDownloadIcon
          onDownload={onDownload}
        />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Download attachment' }),
      );
      expect(onDownload).toHaveBeenCalledWith('a1');
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
