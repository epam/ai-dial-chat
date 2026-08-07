import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ATTACHMENT_COLLAPSE_THRESHOLD } from '../../../constants/attachment-group';
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

    it('shows a wrapping flex row for 2-4 images with no collapsing', () => {
      const images = ['a', 'b', 'c'].map(makeImage);
      render(<AttachmentGroup attachments={images} />);

      expect(screen.getByText('3 attachments')).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      const grid = screen.getByRole('list');
      expect(grid.className).toContain('flex');
      expect(grid.className).toContain('flex-wrap');
      expect(grid.className).not.toContain('grid');
    });

    it('renders every tile in a fixed 5-column grid at the collapse threshold, with no "+N" tile', () => {
      const images = Array.from(
        { length: ATTACHMENT_COLLAPSE_THRESHOLD },
        (_, i) => makeImage(`img${i}`),
      );
      render(<AttachmentGroup attachments={images} />);

      expect(
        screen.getByText(`${ATTACHMENT_COLLAPSE_THRESHOLD} attachments`),
      ).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(
        ATTACHMENT_COLLAPSE_THRESHOLD,
      );
      const grid = screen.getByRole('list');
      expect(grid.className).toContain('grid');
      expect(grid.className).toContain('grid-cols-[repeat(5,83px)]');
      expect(
        screen.queryByRole('button', { name: /show \d+ more/i }),
      ).toBeNull();
      expect(screen.queryByRole('button', { name: /show less/i })).toBeNull();
    });

    it('renders every tile with no hidden subset when well above the collapse threshold', () => {
      const images = Array.from({ length: 13 }, (_, i) => makeImage(`img${i}`));
      render(<AttachmentGroup attachments={images} />);

      expect(screen.getByText('13 attachments')).toBeTruthy();
      // All 13 tiles are present in the DOM, none hidden behind a "+N" tile.
      expect(screen.getAllByRole('listitem')).toHaveLength(13);
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
      // `w-fit` wrapper) treats this group's grid content as its floor and
      // never actually narrows on a real mobile viewport.
      expect(rootClassName).toContain('min-w-0');
    });
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
});
