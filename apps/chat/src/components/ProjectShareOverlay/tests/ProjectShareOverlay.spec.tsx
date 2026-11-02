import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectShareOverlay from '../ProjectShareOverlay';

const { mockContainer } = vi.hoisted(() => ({
  mockContainer: vi.fn(
    ({
      onClose,
    }: {
      itemId: string;
      canEditAccess: boolean;
      onClose: () => void;
    }) => (
      <div role="dialog" aria-label="Share">
        <button onClick={onClose}>Close share</button>
      </div>
    ),
  ),
}));

vi.mock('../../SharePopoverContainer/SharePopoverContainer', () => ({
  default: mockContainer,
}));

describe('ProjectShareOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a view-only share popover for the project', () => {
    render(<ProjectShareOverlay projectId="projects/b/q4" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Share' })).toBeTruthy();
    expect(mockContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'projects/b/q4',
        canEditAccess: false,
      }),
      undefined,
    );
  });

  it('closes on a backdrop click but not on a click inside the popover', () => {
    const onClose = vi.fn();
    render(<ProjectShareOverlay projectId="projects/b/q4" onClose={onClose} />);

    fireEvent.click(screen.getByRole('dialog', { name: 'Share' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('returns focus to the element focused before it opened', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <ProjectShareOverlay projectId="projects/b/q4" onClose={vi.fn()} />,
    );
    screen.getByRole('button', { name: 'Close share' }).focus();
    unmount();

    // eslint-disable-next-line testing-library/no-node-access -- focus restoration has no query; the focused element is the assertion
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
