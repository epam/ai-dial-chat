import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentCard } from '../AttachmentCard';

const fileAttachment: DisplayAttachment = {
  id: 'f1',
  name: 'report.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
};

const imageAttachment: DisplayAttachment = {
  id: 'i1',
  name: 'photo.png',
  contentType: 'image/png',
  type: AttachmentType.Image,
  status: RequestStatus.Idle,
  url: 'https://example.com/photo.png',
};

const pastedAttachment: DisplayAttachment = {
  id: 'p1',
  name: 'Pasted text',
  contentType: 'text/plain',
  type: AttachmentType.Pasted,
  status: RequestStatus.Idle,
};

/*
 * A tile is a button only when activating it does something. A focusable,
 * unnamed or no-op `role="button"` is announced as a control that does
 * nothing, and adds a dead Tab stop per attachment.
 */
describe('AttachmentCard — tiles without an action are not buttons', () => {
  it.each([
    ['file', fileAttachment],
    ['image', imageAttachment],
    ['pasted', pastedAttachment],
  ])(
    'renders a %s tile with no handler as a plain element',
    async (_, attachment) => {
      const onNextFocus = vi.fn();
      render(
        <>
          <AttachmentCard attachment={attachment} />
          <button type="button" onFocus={onNextFocus}>
            Next control
          </button>
        </>,
      );

      const next = screen.getByRole('button', { name: 'Next control' });
      expect(screen.getAllByRole('button')).toEqual([next]);
      // The first Tab skips the tile and lands on the control after it.
      await userEvent.tab();
      expect(onNextFocus).toHaveBeenCalledOnce();
    },
  );

  it('does not make a still-loading image tile a button', () => {
    render(
      <AttachmentCard
        attachment={{ ...imageAttachment, status: RequestStatus.Loading }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('AttachmentCard — tiles with onClick', () => {
  it.each([
    ['file', fileAttachment, 'Download attachment'],
    ['image', imageAttachment, 'Open attachment'],
    ['pasted', pastedAttachment, 'Download attachment'],
  ])(
    'renders a %s tile as a focusable button named by its default click label',
    (_, attachment, name) => {
      render(<AttachmentCard attachment={attachment} onClick={vi.fn()} />);

      const tile = screen.getByRole('button', { name });
      expect(tile.getAttribute('tabindex')).toBe('0');
      expect(tile.className).toContain('cursor-pointer');
    },
  );

  it.each([
    ['file', fileAttachment],
    ['image', imageAttachment],
  ])(
    'calls onClick from mouse, Enter and Space on a %s tile',
    (_, attachment) => {
      const onClick = vi.fn();
      render(
        <AttachmentCard
          attachment={attachment}
          onClick={onClick}
          labels={{ clickLabel: 'Open it' }}
        />,
      );

      const tile = screen.getByRole('button', { name: 'Open it' });
      fireEvent.click(tile);
      fireEvent.keyDown(tile, { key: 'Enter' });
      fireEvent.keyDown(tile, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(3);
      expect(onClick).toHaveBeenCalledWith(attachment.id);
    },
  );
});

describe('AttachmentCard — expandable pasted tiles', () => {
  it('is named by the expand label, not the click label', () => {
    render(
      <AttachmentCard
        attachment={pastedAttachment}
        onExpand={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Expand pasted text' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Download attachment' }),
    ).toBeNull();
  });

  it('uses the host-supplied expand label', () => {
    render(
      <AttachmentCard
        attachment={pastedAttachment}
        onExpand={vi.fn()}
        labels={{ expandLabel: 'Show pasted text' }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Show pasted text' }),
    ).toBeTruthy();
  });

  it('expands on mouse, Enter and Space instead of calling onClick', () => {
    const onExpand = vi.fn();
    const onClick = vi.fn();
    render(
      <AttachmentCard
        attachment={pastedAttachment}
        onExpand={onExpand}
        onClick={onClick}
      />,
    );

    const tile = screen.getByRole('button', { name: 'Expand pasted text' });
    fireEvent.click(tile);
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });

    expect(onExpand).toHaveBeenCalledTimes(3);
    expect(onExpand).toHaveBeenCalledWith('p1');
    expect(onClick).not.toHaveBeenCalled();
  });
});

/*
 * A file tile that is both clickable and downloadable renders two buttons.
 * Naming the corner download button by `clickLabel` gave both the same
 * accessible name, so assistive tech could not tell them apart.
 */
describe('AttachmentCard — file tile download button', () => {
  it('is named by downloadLabel, distinct from the tile click label', () => {
    const onClick = vi.fn();
    const onDownload = vi.fn();
    render(
      <AttachmentCard
        attachment={fileAttachment}
        onClick={onClick}
        onDownload={onDownload}
        labels={{ clickLabel: 'Open in canvas', downloadLabel: 'Save file' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save file' }));
    expect(onDownload).toHaveBeenCalledWith('f1');
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Open in canvas' })).toBeTruthy();
  });

  it("defaults to 'Download attachment' when no downloadLabel is given", () => {
    render(
      <AttachmentCard
        attachment={fileAttachment}
        onDownload={vi.fn()}
        labels={{ clickLabel: 'Open in canvas' }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Download attachment' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open in canvas' })).toBeNull();
  });
});
