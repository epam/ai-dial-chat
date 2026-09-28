import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageSelectionReply } from '../MessageSelectionReply';

describe('MessageSelectionReply', () => {
  it('keeps the action and announcements inside the host portal and supports a deferred destination', () => {
    render(
      <>
        <div role="dialog" aria-label="Chat modal" />
        <div role="region" aria-label="Other chat surface" />
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Chat modal' });
    const otherSurface = screen.getByRole('region', {
      name: 'Other chat surface',
    });
    const props = {
      rect: new DOMRect(10, 100, 80, 20),
      actionRef: { current: null },
      onReply: vi.fn(),
      addedRevision: 0,
      labels: {
        reply: 'Reply',
        selectionAvailable: 'Selection available',
        attachmentAdded: 'Text attached',
      },
    };
    const { rerender } = render(
      <MessageSelectionReply {...props} portalContainer={null} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<MessageSelectionReply {...props} portalContainer={dialog} />);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reply' }));
    expect(props.onReply).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole('status').textContent).toBe(
      'Selection available',
    );
    rerender(
      <MessageSelectionReply {...props} portalContainer={otherSurface} />,
    );
    expect(within(dialog).queryByRole('button')).toBeNull();
    expect(
      within(otherSurface).getByRole('button', { name: 'Reply' }),
    ).toBeTruthy();
    rerender(<MessageSelectionReply {...props} portalContainer={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers a named button and announces availability without exposing the passage', () => {
    const onReply = vi.fn();
    render(
      <MessageSelectionReply
        rect={new DOMRect(10, 100, 80, 20)}
        actionRef={{ current: null }}
        onReply={onReply}
        addedRevision={0}
        labels={{
          reply: 'Reply',
          selectionAvailable: 'Reply to selected text is available',
          attachmentAdded: 'Text attached',
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onReply).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe(
      'Reply to selected text is available',
    );
  });

  it('unmounts the dismissed button and announces only accepted insertion', () => {
    const props = {
      actionRef: { current: null },
      onReply: vi.fn(),
      addedRevision: 0,
      labels: {
        reply: 'Reply',
        selectionAvailable: 'Reply to selected text is available',
        attachmentAdded: 'Text attached',
      },
    };
    const { rerender } = render(
      <MessageSelectionReply {...props} rect={undefined} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
    rerender(
      <MessageSelectionReply {...props} rect={undefined} addedRevision={1} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Text attached');
  });
});
