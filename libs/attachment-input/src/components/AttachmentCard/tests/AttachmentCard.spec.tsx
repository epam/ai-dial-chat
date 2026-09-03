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
      <AttachmentCard attachment={uploadingAttachment} />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Download attachment' })
        .getAttribute('aria-busy'),
    ).toBe('true');

    rerender(
      <AttachmentCard
        attachment={{ ...uploadingAttachment, status: RequestStatus.Idle }}
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
