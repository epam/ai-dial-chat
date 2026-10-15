import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ATTACHMENT_INPUT_CLASS } from '../../../constants/public-class-names';
import { AttachmentCard } from '../AttachmentCard';

const failedAttachment: DisplayAttachment = {
  id: 'a1',
  name: 'sample-doc.txt',
  contentType: 'text/plain',
  type: AttachmentType.File,
  status: RequestStatus.Error,
  errorReason: AttachmentErrorReason.Network,
};

describe('AttachmentCard — corner actions in the error state', () => {
  it('names retry and remove distinctly', () => {
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Retry upload')).toBeTruthy();
    expect(screen.getByLabelText('Remove attachment')).toBeTruthy();
    expect(screen.getAllByLabelText('Retry upload')).toHaveLength(1);
  });

  it('hides retry for a file-too-large error, keeping remove', () => {
    render(
      <AttachmentCard
        attachment={{
          ...failedAttachment,
          errorReason: AttachmentErrorReason.FileTooLarge,
        }}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Retry upload')).toBeNull();
    expect(screen.getByLabelText('Remove attachment')).toBeTruthy();
  });

  it('uses the host-supplied labels for both actions', () => {
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
        labels={{ retryLabel: 'Повторить', removeLabel: 'Удалить' }}
      />,
    );

    expect(screen.getByLabelText('Повторить')).toBeTruthy();
    expect(screen.getByLabelText('Удалить')).toBeTruthy();
  });

  /*
   * Both actions used to position themselves at the same corner coordinates,
   * so they stacked and the one rendered last swallowed every click aimed at
   * the other. They must share one laid-out row instead.
   */
  it('lays both actions out in a single row instead of stacking them', () => {
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const retry = screen.getByLabelText('Retry upload');
    const remove = screen.getByLabelText('Remove attachment');

    /*
     * jsdom does no layout, so the stacking itself is not observable; assert
     * the structure that prevents it instead — one shared flex row, with
     * neither button positioning itself out of that row.
     */
    /* eslint-disable-next-line testing-library/no-node-access */
    const row = retry.parentElement;
    expect(row?.className).toContain('flex');
    /* eslint-disable-next-line testing-library/no-node-access */
    expect(remove.parentElement).toBe(row);
    expect(retry.className).not.toContain('absolute');
    expect(remove.className).not.toContain('absolute');
  });

  it('calls only the clicked action', () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={onRetry}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByLabelText('Retry upload'));
    expect(onRetry).toHaveBeenCalledWith('a1');
    expect(onRemove).not.toHaveBeenCalled();
  });

  /*
   * The tile's own Enter/Space handler used to preventDefault() on key events
   * bubbling up from the corner buttons, cancelling their activation and
   * firing the tile action instead.
   */
  it('does not fire the tile action when a corner button handles a key press', () => {
    const onClick = vi.fn();
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
        onClick={onClick}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText('Retry upload'), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText('Retry upload'), { key: ' ' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('still activates the tile itself on Enter', () => {
    const onClick = vi.fn();
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
        onClick={onClick}
      />,
    );

    const tile = screen.getByRole('button', { name: 'Download attachment' });
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledWith('a1');
  });
});

describe('AttachmentCard — upload in progress', () => {
  const uploadingAttachment: DisplayAttachment = {
    id: 'a2',
    name: 'report.pdf',
    contentType: 'application/pdf',
    type: AttachmentType.File,
    status: RequestStatus.Loading,
  };

  it('exposes the in-flight upload as a named, indeterminate progressbar', () => {
    render(<AttachmentCard attachment={uploadingAttachment} />);

    const progress = screen.getByRole('progressbar', { name: 'Uploading' });
    expect(progress.hasAttribute('aria-valuenow')).toBe(false);
  });

  it('uses the host-supplied uploading label', () => {
    render(
      <AttachmentCard
        attachment={uploadingAttachment}
        labels={{ uploadingLabel: 'Загрузка' }}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'Загрузка' })).toBeTruthy();
  });

  it('marks the tile busy while uploading and not busy once settled', () => {
    const { rerender } = render(
      <AttachmentCard attachment={uploadingAttachment} onClick={vi.fn()} />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Download attachment' })
        .getAttribute('aria-busy'),
    ).toBe('true');

    rerender(
      <AttachmentCard
        attachment={{ ...uploadingAttachment, status: RequestStatus.Idle }}
        onClick={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Download attachment' })
        .getAttribute('aria-busy'),
    ).toBe('false');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

/*
 * A long filename used to overflow the fixed 84px tile and get clipped by its
 * `overflow-hidden` with no ellipsis: the name div sits in a column flex
 * container with `items-start`, so it was sized to its min-content width, and
 * `overflow-wrap: break-word` (Tailwind `break-words`) does not shrink
 * min-content.
 */
describe('AttachmentCard — long filename', () => {
  const longNameAttachment: DisplayAttachment = {
    id: 'a3',
    name: 'ARCHITECTUREDECISIONRECORDS.md',
    contentType: 'text/markdown',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
  };

  it('constrains the name to the tile width so it wraps and clamps', () => {
    render(
      <AttachmentCard attachment={longNameAttachment} onDownload={vi.fn()} />,
    );

    /* jsdom does no layout, so assert the classes that make the clamp work. */
    const name = screen.getByTitle('ARCHITECTUREDECISIONRECORDS');
    expect(name.className).toContain('w-full');
    expect(name.className).toContain('break-words');
    expect(name.className).toContain('line-clamp-2');
  });
});

/* eslint-disable testing-library/no-container, testing-library/no-node-access -- the decorative type glyph is aria-hidden, so it has no role or text to query */
describe('AttachmentCard — type glyph', () => {
  const idleFile: DisplayAttachment = {
    ...failedAttachment,
    name: 'report.csv',
    contentType: 'text/csv',
    status: RequestStatus.Idle,
    errorReason: undefined,
  };

  it('renders the kit color file-type icon for a file attachment', () => {
    const { container } = render(<AttachmentCard attachment={idleFile} />);

    expect(container.querySelector('.dial-kit-file-icon')).toBeTruthy();
  });

  it('keeps the outline glyph for a prompt attachment', () => {
    const { container } = render(
      <AttachmentCard
        attachment={{ ...idleFile, type: AttachmentType.Prompt }}
      />,
    );

    expect(container.querySelector('.dial-kit-file-icon')).toBeNull();
    expect(screen.getByText('Prompt')).toBeTruthy();
  });
});

/* eslint-enable testing-library/no-container, testing-library/no-node-access */

describe('AttachmentCard — remove action visibility', () => {
  it('keeps the remove button visible below the desktop breakpoint', () => {
    render(
      <AttachmentCard
        attachment={{ ...failedAttachment, status: RequestStatus.Idle }}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Remove attachment').className).toContain(
      'mobile:opacity-100',
    );
  });
});

describe('AttachmentCard — focus ring', () => {
  /* CSS-module class marking a tile whose ring stands for its lone action's focus. */
  const PROXY_RING = /_proxyFocus_/;
  const idleFile: DisplayAttachment = {
    ...failedAttachment,
    status: RequestStatus.Idle,
    errorReason: undefined,
  };
  const image: DisplayAttachment = {
    id: 'img',
    name: 'cat.png',
    contentType: 'image/png',
    type: AttachmentType.Image,
    status: RequestStatus.Idle,
    url: 'https://example.test/cat.png',
  };
  /* eslint-disable testing-library/no-node-access -- the tile root carries no role or name of its own when it is not interactive */
  const getTileOf = (actionLabel: string) =>
    screen
      .getByLabelText(actionLabel)
      .closest(`.${ATTACHMENT_INPUT_CLASS.tile}`);
  /* eslint-enable testing-library/no-node-access */

  it('rings an interactive tile on its own focus only, 1px clear of the border', () => {
    render(
      <AttachmentCard
        attachment={idleFile}
        onClick={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const tile = screen.getByRole('button', { name: 'Download attachment' });
    expect(tile.className).toContain('focus-visible:outline');
    expect(tile.className).toContain('outline-offset-1');
    expect(tile.className).not.toMatch(PROXY_RING);
  });

  it('rings a non-interactive tile while its only action has focus', () => {
    render(<AttachmentCard attachment={idleFile} onRemove={vi.fn()} />);

    expect(getTileOf('Remove attachment')?.className).toMatch(PROXY_RING);
  });

  it('leaves each action its own ring when a non-interactive tile has several', () => {
    render(
      <AttachmentCard
        attachment={failedAttachment}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(getTileOf('Remove attachment')?.className).not.toMatch(PROXY_RING);
  });

  it('applies the same rule to an image tile', () => {
    render(<AttachmentCard attachment={image} onRemove={vi.fn()} />);

    expect(getTileOf('Remove attachment')?.className).toMatch(PROXY_RING);
  });
});

describe('AttachmentCard — image upload in progress', () => {
  const uploadingImage: DisplayAttachment = {
    id: 'img',
    name: 'cat.png',
    contentType: 'image/png',
    type: AttachmentType.Image,
    status: RequestStatus.Loading,
    previewUrl: 'blob:cat',
  };

  it('announces the upload and keeps remove visible', () => {
    render(
      <AttachmentCard
        attachment={uploadingImage}
        onRemove={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'Uploading' })).toBeTruthy();
    const removeClasses = screen
      .getByLabelText('Remove attachment')
      .className.split(' ');
    expect(removeClasses).toContain('opacity-100');
    expect(removeClasses).not.toContain('opacity-0');
    expect(screen.queryByLabelText('Download attachment')).toBeNull();
  });
});
