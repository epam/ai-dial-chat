import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskStatus } from '../../../types/scheduled-task-status';
import { ScheduledTaskStatusPill } from '../ScheduledTaskStatusPill';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlayerPause: () => <svg data-icon="pause" />,
  IconCheck: ({ 'aria-hidden': ariaHidden }: { 'aria-hidden'?: boolean }) => (
    <svg data-icon="check" aria-hidden={ariaHidden} />
  ),
}));

describe('ScheduledTaskStatusPill', () => {
  it('renders the schedule pill without an icon for the scheduled status', () => {
    const { container } = render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Scheduled}
        text="Every Monday 12:00"
      />,
    );

    expect(screen.getByText('Every Monday 12:00')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting icon absence, which carries no accessible role
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders the paused badge with a pause icon', () => {
    const { container } = render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Paused}
        text="Paused"
      />,
    );

    expect(screen.getByText('Paused')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting the icon glyph, which is aria-hidden
    expect(container.querySelector('svg[data-icon="pause"]')).toBeTruthy();
  });

  it('renders the completed badge with a check icon hidden from assistive technology', () => {
    const { container } = render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Completed}
        text="Completed"
      />,
    );

    expect(screen.getByText('Completed')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting the aria-hidden icon glyph
    const checkIcon = container.querySelector('svg[data-icon="check"]');
    expect(checkIcon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the textClassName and className overrides', () => {
    render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Completed}
        text="Completed"
        textClassName="dial-small-text"
        className="extra-class"
      />,
    );

    const badge = screen.getByText('Completed');
    expect(badge.className).toContain('dial-small-text');
    expect(badge.className).toContain('extra-class');
  });

  it('renders the badge shape for completed and paused, the pill shape for scheduled', () => {
    const { unmount } = render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Completed}
        text="Completed"
      />,
    );
    expect(screen.getByText('Completed').className).toContain('rounded-full');
    unmount();

    render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Paused}
        text="Paused"
      />,
    );
    expect(screen.getByText('Paused').className).toContain('rounded-full');
    unmount();

    render(
      <ScheduledTaskStatusPill
        status={ScheduledTaskStatus.Scheduled}
        text="Every Monday 12:00"
      />,
    );
    expect(screen.getByText('Every Monday 12:00').className).toContain(
      'rounded-lg',
    );
  });
});
