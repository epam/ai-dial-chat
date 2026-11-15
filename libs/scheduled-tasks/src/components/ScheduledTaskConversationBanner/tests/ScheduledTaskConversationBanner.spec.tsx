import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  ScheduledTaskConversationBannerDetailsLinkProps,
  ScheduledTaskConversationBannerProps,
} from '../../../models/scheduled-task-conversation-banner-props';
import { ScheduledTaskConversationBanner } from '../ScheduledTaskConversationBanner';

/* Stand-in for a host router link. */
const renderDetailsLink = ({
  className,
  'aria-label': ariaLabel,
  children,
}: ScheduledTaskConversationBannerDetailsLinkProps) => (
  <a href="/tasks/schedule-1" className={className} aria-label={ariaLabel}>
    {children}
  </a>
);

const renderBanner = (props?: Partial<ScheduledTaskConversationBannerProps>) =>
  render(
    <ScheduledTaskConversationBanner
      displayName="Weekly digest"
      renderDetailsLink={renderDetailsLink}
      {...props}
    />,
  );

const getUnavailableRegion = () =>
  screen
    .getAllByRole('status')
    .find((region) => region.tagName === 'P') as HTMLElement;

describe('ScheduledTaskConversationBanner', () => {
  it('shows the task name, the run time and the host details link', () => {
    renderBanner({ timestampLabel: 'today at 9:01 AM' });

    expect(screen.getByText('Weekly digest')).toBeTruthy();
    expect(screen.getByText('today at 9:01 AM')).toBeTruthy();
    const link = screen.getByRole('link', {
      name: 'View task details for Weekly digest',
    });
    expect(link.getAttribute('href')).toBe('/tasks/schedule-1');
    expect(link.textContent).toBe('Task details');
    expect(link.className).toMatch(/detailsLink/);
  });

  it('shows only the task name when no run time is known', () => {
    renderBanner();

    expect(screen.getByText('Weekly digest').textContent).toBe('Weekly digest');
  });

  it('replaces the details link with the deleted note for a deleted task', () => {
    renderBanner({ isTaskDeleted: true });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Task was deleted')).toBeTruthy();
  });

  it('announces loading in a region that stays mounted, without the task name', () => {
    const { rerender } = renderBanner({ isLoading: true });
    const [loadingRegion] = screen.getAllByRole('status');

    expect(loadingRegion.textContent).toBe('Loading task details…');
    expect(screen.queryByText('Weekly digest')).toBeNull();

    rerender(
      <ScheduledTaskConversationBanner
        displayName="Weekly digest"
        renderDetailsLink={renderDetailsLink}
      />,
    );

    expect(screen.getAllByRole('status')[0]).toBe(loadingRegion);
    expect(loadingRegion.textContent).toBe('');
  });

  it('announces an unavailable task in the region that was mounted while loading', () => {
    const { rerender } = renderBanner({ isLoading: true });
    const region = getUnavailableRegion();
    expect(region.textContent).toBe('');

    rerender(
      <ScheduledTaskConversationBanner
        isUnavailable
        displayName=""
        renderDetailsLink={renderDetailsLink}
      />,
    );

    expect(getUnavailableRegion()).toBe(region);
    expect(region.textContent).toBe('Task details are unavailable');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers a retry only when onRetry is set', async () => {
    const onRetry = vi.fn();
    const { rerender } = renderBanner({ isUnavailable: true });
    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <ScheduledTaskConversationBanner
        isUnavailable
        displayName=""
        renderDetailsLink={renderDetailsLink}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('uses the host labels', () => {
    renderBanner({
      labels: {
        taskDetailsLabel: 'Détails',
        taskDetailsAriaLabel: (name) => `Détails de ${name}`,
      },
    });

    expect(
      screen.getByRole('link', { name: 'Détails de Weekly digest' })
        .textContent,
    ).toBe('Détails');
  });

  it('sets the color overrides as CSS custom properties', () => {
    const { container } = renderBanner({
      colors: { surface: 'red', detailsLink: 'blue' },
    });
    // eslint-disable-next-line testing-library/no-node-access -- asserting a CSS custom property on the root element
    const card = container.firstElementChild as HTMLElement;

    expect(card.style.getPropertyValue('--stcb-surface')).toBe('red');
    expect(card.style.getPropertyValue('--stcb-details-link')).toBe('blue');
  });
});
