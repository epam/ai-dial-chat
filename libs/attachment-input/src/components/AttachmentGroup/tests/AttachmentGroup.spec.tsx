import {
  AttachmentType,
  CodeBlockTheme,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentGroup } from '../AttachmentGroup';

const makeImage = (id: string): DisplayAttachment => ({
  id,
  name: `${id}.png`,
  contentType: 'image/png',
  type: AttachmentType.Image,
  status: RequestStatus.Idle,
  previewUrl: `https://example.com/${id}.png`,
});

const makeFile = (
  id: string,
  overrides: Partial<DisplayAttachment> = {},
): DisplayAttachment => ({
  id,
  name: `${id}.pdf`,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('AttachmentGroup', () => {
  it('renders nothing for an empty attachment list', () => {
    const { container } = render(<AttachmentGroup attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  describe('images', () => {
    it('renders a single image as a uniform tile, same as any other count', () => {
      render(<AttachmentGroup attachments={[makeImage('a')]} />);

      expect(screen.getByText('1 attachment')).toBeTruthy();
      expect(screen.getByRole('img', { name: 'a.png' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /show less/i })).toBeNull();
    });

    it('shows a simple grid for 2-4 images with no collapsing', () => {
      const images = ['a', 'b', 'c'].map(makeImage);
      render(<AttachmentGroup attachments={images} />);

      expect(screen.getByText('3 attachments')).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('collapses 5+ attachments behind a "+N" tile, with no header toggle until expanded', () => {
      const images = Array.from({ length: 13 }, (_, i) => makeImage(`img${i}`));
      render(<AttachmentGroup attachments={images} />);

      expect(screen.getByText('13 attachments')).toBeTruthy();
      // 4 visible images + the "+N" tile, each wrapped in its own listitem.
      expect(screen.getAllByRole('listitem')).toHaveLength(5);
      expect(
        screen.getByRole('button', { name: 'Show 9 more attachments' }),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: /show less/i })).toBeNull();
    });

    it('expands to show every attachment via the "+N" tile, revealing a "Show less" action', async () => {
      const user = userEvent.setup();
      const images = Array.from({ length: 13 }, (_, i) => makeImage(`img${i}`));
      render(
        <AttachmentGroup
          attachments={images}
          labels={{ showLessLabel: 'Show less' }}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: 'Show 9 more attachments' }),
      );

      // 13 images + the "show less" tile, each wrapped in its own listitem.
      expect(screen.getAllByRole('listitem')).toHaveLength(14);
      expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
    });

    it('collapses again via the "Show less" header action', async () => {
      const user = userEvent.setup();
      const images = Array.from({ length: 13 }, (_, i) => makeImage(`img${i}`));
      render(
        <AttachmentGroup
          attachments={images}
          labels={{ showLessLabel: 'Show less' }}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: 'Show 9 more attachments' }),
      );
      await user.click(screen.getByRole('button', { name: 'Show less' }));

      // Back to 4 visible images + the "+N" tile.
      expect(screen.getAllByRole('listitem')).toHaveLength(5);
      expect(
        screen.getByRole('button', { name: 'Show 9 more attachments' }),
      ).toBeTruthy();
    });

    it('keeps the group width fixed when expanding a collapsible group (only rows are added)', async () => {
      const user = userEvent.setup();
      const images = Array.from({ length: 13 }, (_, i) => makeImage(`img${i}`));
      const { container } = render(<AttachmentGroup attachments={images} />);

      const getWidthClass = () =>
        container.firstElementChild?.className
          .split(' ')
          .find((c) => c.startsWith('max-w-['));

      const collapsedWidthClass = getWidthClass();
      expect(collapsedWidthClass).toBe('max-w-[492px]');

      await user.click(
        screen.getByRole('button', { name: 'Show 9 more attachments' }),
      );

      expect(getWidthClass()).toBe(collapsedWidthClass);
    });

    it('does not force a fixed width on a group below the collapse threshold', () => {
      const images = ['a', 'b'].map(makeImage);
      const { container } = render(<AttachmentGroup attachments={images} />);

      const widthClass = container.firstElementChild?.className
        .split(' ')
        .find((c) => c.startsWith('w-[') || c.startsWith('max-w-['));

      expect(widthClass).toMatch(/^max-w-\[/);
    });

    it('shrinks to fit a narrower parent instead of overflowing it on mobile', () => {
      const images = Array.from({ length: 13 }, (_, i) => makeImage(`img${i}`));
      const { container } = render(<AttachmentGroup attachments={images} />);

      const rootClassName = container.firstElementChild?.className ?? '';
      expect(rootClassName).toContain('w-full');
      expect(rootClassName).toContain('max-w-[492px]');
      // Without min-w-0, a shrink-to-fit ancestor (the message bubble's own
      // `w-fit` wrapper) treats this group's un-scrolled grid content as its
      // floor and never actually narrows on a real mobile viewport.
      expect(rootClassName).toContain('min-w-0');

      const grid = screen.getByRole('list');
      expect(grid.className).toContain('overflow-x-auto');
    });
  });

  describe('files', () => {
    it('renders a single file tile', () => {
      render(<AttachmentGroup attachments={[makeFile('doc1')]} />);
      expect(screen.getByText('1 attachment')).toBeTruthy();
      expect(screen.getByText('doc1.pdf')).toBeTruthy();
    });

    it('renders multiple file tiles', () => {
      const files = ['a', 'b', 'c'].map((id) => makeFile(id));
      render(<AttachmentGroup attachments={files} />);
      expect(screen.getByText('3 attachments')).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('shows a "Download all" header action for 2+ attachments', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const files = [makeFile('a'), makeFile('b')];
      render(
        <AttachmentGroup
          attachments={files}
          onAttachmentClick={handleClick}
          labels={{ downloadAllLabel: 'Download all' }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Download all' }));

      expect(handleClick).toHaveBeenCalledWith(files[0]);
      expect(handleClick).toHaveBeenCalledWith(files[1]);
    });

    it('"Download all" skips attachments that are still uploading or failed', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const ready = makeFile('ready');
      const uploading = makeFile('uploading', {
        status: RequestStatus.Loading,
      });
      const failed = makeFile('failed', { status: RequestStatus.Error });
      render(
        <AttachmentGroup
          attachments={[ready, uploading, failed]}
          onAttachmentClick={handleClick}
          labels={{ downloadAllLabel: 'Download all' }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Download all' }));

      expect(handleClick).toHaveBeenCalledOnce();
      expect(handleClick).toHaveBeenCalledWith(ready);
    });

    it('does not show "Download all" for a single attachment', () => {
      render(
        <AttachmentGroup
          attachments={[makeFile('a')]}
          onAttachmentClick={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /download all/i }),
      ).toBeNull();
    });
  });

  describe('mixed groups', () => {
    it('renders images and files together in one unified grid with a combined count', () => {
      const attachments = [
        makeImage('a'),
        makeImage('b'),
        makeFile('doc'),
        makeFile('sheet'),
      ];
      render(<AttachmentGroup attachments={attachments} />);

      expect(screen.getByText('4 attachments')).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(4);
      expect(screen.getByText('doc.pdf')).toBeTruthy();
      expect(screen.getByText('sheet.pdf')).toBeTruthy();
      expect(screen.getByRole('img', { name: 'a.png' })).toBeTruthy();
    });

    it('shows "Download all" for a mixed group of 2+ attachments and downloads every attachment', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const attachments = [makeImage('a'), makeFile('doc')];
      render(
        <AttachmentGroup
          attachments={attachments}
          onAttachmentClick={handleClick}
          labels={{ downloadAllLabel: 'Download all' }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Download all' }));

      expect(handleClick).toHaveBeenCalledWith(attachments[0]);
      expect(handleClick).toHaveBeenCalledWith(attachments[1]);
    });
  });

  describe('file states', () => {
    it('renders an uploading file with a progress indicator', () => {
      render(
        <AttachmentGroup
          attachments={[makeFile('a', { status: RequestStatus.Loading })]}
        />,
      );
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });

    it('renders a failed file with a retry action', async () => {
      const user = userEvent.setup();
      const handleRetry = vi.fn();
      render(
        <AttachmentGroup
          attachments={[makeFile('a', { status: RequestStatus.Error })]}
          onRetry={handleRetry}
          labels={{ retryLabel: 'Retry' }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(handleRetry).toHaveBeenCalledWith('a');
    });
  });

  it('accepts getSizeLabel without throwing (size is not displayed on the uniform tile)', () => {
    expect(() =>
      render(
        <AttachmentGroup
          attachments={[makeFile('a')]}
          getSizeLabel={() => '2.4 MB'}
        />,
      ),
    ).not.toThrow();
  });

  it('exposes the group as an accessible, labeled region', () => {
    render(
      <AttachmentGroup
        attachments={[makeFile('a')]}
        labels={{ ariaLabel: 'Attachments' }}
      />,
    );
    expect(screen.getByRole('group', { name: 'Attachments' })).toBeTruthy();
  });

  it('forwards theme to file tiles so they use the markdown surface, not white, in light mode', () => {
    const { container } = render(
      <AttachmentGroup
        attachments={[makeFile('a')]}
        theme={CodeBlockTheme.Light}
      />,
    );
    expect(container.querySelector('[class*="tileLight"]')).toBeTruthy();
  });
});
