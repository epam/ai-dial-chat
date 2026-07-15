import {
  AttachmentErrorReason,
  AttachmentType,
  CodeBlockTheme,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentCard } from '../../AttachmentCard/AttachmentCard';
import { AttachmentFileRow } from '../AttachmentFileRow';

const makeAttachment = (
  overrides: Partial<DisplayAttachment> = {},
): DisplayAttachment => ({
  id: 'file-1',
  name: 'Q3-board-deck.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('AttachmentFileRow', () => {
  it('renders the filename and the same dot-prefixed extension label the composer uses', () => {
    render(
      <AttachmentFileRow attachment={makeAttachment()} onClick={vi.fn()} />,
    );

    expect(screen.getByText('Q3-board-deck.pdf')).toBeTruthy();
    expect(screen.getByText('.pdf')).toBeTruthy();
  });

  it('derives the same label as getAttachmentCardState for an unrecognized content type', () => {
    render(
      <AttachmentFileRow
        attachment={makeAttachment({
          name: 'archive.bin',
          contentType: 'application/octet-stream',
        })}
      />,
    );

    expect(screen.getByText('archive.bin')).toBeTruthy();
    expect(screen.getByText('.octet-stream')).toBeTruthy();
  });

  it('calls onClick (download) when the tile is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const attachment = makeAttachment();

    render(
      <AttachmentFileRow
        attachment={attachment}
        onClick={handleClick}
        labels={{ clickLabel: 'Download attachment' }}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Download attachment' }),
    );

    expect(handleClick).toHaveBeenCalledWith(attachment);
  });

  it('shows an indeterminate progress bar and no download action while uploading', () => {
    render(
      <AttachmentFileRow
        attachment={makeAttachment({ status: RequestStatus.Loading })}
        onClick={vi.fn()}
        labels={{ clickLabel: 'Download attachment' }}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Download attachment' }),
    ).toBeNull();
  });

  it('shows an icon-only Retry action when a retry handler is provided', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    render(
      <AttachmentFileRow
        attachment={makeAttachment({
          status: RequestStatus.Error,
          errorReason: AttachmentErrorReason.Network,
        })}
        onRetry={handleRetry}
        labels={{ retryLabel: 'Retry' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(handleRetry).toHaveBeenCalledWith('file-1');
  });

  it('does not offer a Retry action for an unsupported file type (retrying would just fail again)', () => {
    render(
      <AttachmentFileRow
        attachment={makeAttachment({
          status: RequestStatus.Error,
          errorReason: AttachmentErrorReason.UnsupportedType,
        })}
        onRetry={vi.fn()}
        labels={{ retryLabel: 'Retry' }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('exposes the failure reason as a tooltip on the tile, without a Retry action, when no retry handler is provided', () => {
    const { container } = render(
      <AttachmentFileRow
        attachment={makeAttachment({
          status: RequestStatus.Error,
          errorReason: AttachmentErrorReason.Network,
        })}
      />,
    );

    expect(
      container.querySelector('[title="Upload failed · network error"]'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('is not clickable while in an error or loading state', () => {
    const { rerender } = render(
      <AttachmentFileRow
        attachment={makeAttachment({ status: RequestStatus.Error })}
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Download attachment' }),
    ).toBeNull();

    rerender(
      <AttachmentFileRow
        attachment={makeAttachment({ status: RequestStatus.Loading })}
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Download attachment' }),
    ).toBeNull();
  });

  it('clamps a long filename inside the tile while keeping the full name available via title', () => {
    const longName =
      'quarterly-financial-summary-with-a-very-long-descriptive-filename-2026.pdf';
    render(
      <AttachmentFileRow attachment={makeAttachment({ name: longName })} />,
    );

    const nameEl = screen.getByText(longName);
    expect(nameEl.className).toContain('line-clamp-2');
    expect(nameEl.getAttribute('title')).toBe(longName);
  });

  describe('label parity with the composer', () => {
    // The composer (Input -> AttachmentCard) and a sent message
    // (AttachmentGroup -> AttachmentFileRow) must show the exact same
    // extension label for the same attachment, since both are just
    // different presentations of the same file.
    it.each([
      ['application/pdf', 'report.pdf'],
      ['application/vnd.ms-excel', 'budget.xls'],
      ['text/markdown', 'AI_Update_2026-04-21.md'],
      ['application/octet-stream', 'mystery.xyz'],
      ['', 'noextension'],
    ])('matches AttachmentCard for %s / %s', (contentType, name) => {
      const attachment = makeAttachment({ contentType, name });

      const cardRender = render(
        <AttachmentCard attachment={attachment} onRemove={vi.fn()} />,
      );
      const cardLabel = cardRender.container.querySelector(
        'span[class*="meta"]',
      )?.textContent;
      expect(cardLabel).toBeTruthy();
      cardRender.unmount();

      render(<AttachmentFileRow attachment={attachment} />);
      // getAllByText, not getByText: when there's no derivable extension at
      // all the label falls back to the raw filename (matching
      // AttachmentCard), which can legitimately equal the name text too.
      expect(screen.getAllByText(cardLabel as string).length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('theme', () => {
    // Never plain white — the tile reuses the same light-theme override as
    // the markdown code block (bg-layer-6) instead of falling back to
    // bg-layer-3's near-white light value.
    it('applies the light-theme surface class when theme is Light', () => {
      const { container } = render(
        <AttachmentFileRow
          attachment={makeAttachment()}
          theme={CodeBlockTheme.Light}
        />,
      );
      expect(container.querySelector('[class*="tileLight"]')).toBeTruthy();
    });

    it('does not apply the light-theme surface class by default (dark)', () => {
      const { container } = render(
        <AttachmentFileRow attachment={makeAttachment()} />,
      );
      expect(container.querySelector('[class*="tileLight"]')).toBeNull();
    });

    it('never applies the light surface override to a failed (red) tile', () => {
      const { container } = render(
        <AttachmentFileRow
          attachment={makeAttachment({ status: RequestStatus.Error })}
          theme={CodeBlockTheme.Light}
        />,
      );
      expect(container.querySelector('[class*="tileLight"]')).toBeNull();
      expect(container.querySelector('[class*="tileError"]')).toBeTruthy();
    });
  });
});
