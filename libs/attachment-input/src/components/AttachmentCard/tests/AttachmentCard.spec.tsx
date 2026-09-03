import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

/*
 * A long filename used to overflow the fixed 84px tile and get clipped by its
 * `overflow-hidden` with no ellipsis: the name div sits in a column flex
 * container with `items-start`, so it was sized to its min-content width, and
 * `overflow-wrap: break-word` (Tailwind `break-words`) does not shrink
 * min-content.
 */
describe('AttachmentCard — long filename', () => {
  const longNameAttachment: DisplayAttachment = {
    id: 'a2',
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
