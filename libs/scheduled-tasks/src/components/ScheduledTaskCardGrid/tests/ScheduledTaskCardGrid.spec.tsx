import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskItem } from '../../../models/scheduled-task-item';
import { ScheduledTaskCardGrid } from '../ScheduledTaskCardGrid';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  FolderPath: ({ segments }: { segments: string[] }) => (
    <>{segments.join(' / ')}</>
  ),
  Highlight: ({ text }: { text: string }) => <>{text}</>,
  CardShell: ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) => (
    <article {...rest}>{children}</article>
  ),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Skeleton: ({ color }: { color?: string }) => (
    <div data-skeleton data-color={color} />
  ),
  SkeletonVariant: { Default: 'default', Rectangular: 'rectangular' },
  Dropdown: ({ children }: { children: ReactNode }) => <>{children}</>,
  IconButton: ({
    icon,
    ...rest
  }: { icon: ReactNode } & Record<string, unknown>) => (
    <button {...rest}>{icon}</button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconDotsVertical: () => <svg />,
  IconEdit: () => <svg />,
  IconPlayerPlay: () => <svg />,
  IconTrash: () => <svg />,
}));

const buildItem = (
  overrides?: Partial<ScheduledTaskItem>,
): ScheduledTaskItem => ({
  id: 'sched_1',
  displayName: 'Competitor Updates',
  scheduleLabel: 'Every Monday 12:00',
  ...overrides,
});

describe('ScheduledTaskCardGrid', () => {
  it('renders trailing skeleton cards inside the same grid container as the real cards, not a separate one', () => {
    const { container } = render(
      <ScheduledTaskCardGrid
        items={[buildItem({ id: '1' }), buildItem({ id: '2' })]}
        trailingSkeletonCount={4}
      />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifying the grid wrapper's CSS class, which has no accessible role/name
    const grids = container.querySelectorAll('.grid');
    expect(grids).toHaveLength(1);

    const [grid] = grids;
    // eslint-disable-next-line testing-library/no-node-access -- counting real vs skeleton cards by DOM structure; both share the "article" role so aria-hidden is the only distinguishing CSS-level attribute
    expect(grid.querySelectorAll('article').length).toBe(6);
    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(grid.querySelectorAll('article[aria-hidden="true"]').length).toBe(4);
  });

  it('renders no skeleton cards when trailingSkeletonCount is omitted', () => {
    render(<ScheduledTaskCardGrid items={[buildItem()]} />);

    expect(
      screen
        .queryAllByRole('article', { hidden: true })
        .filter((card) => card.getAttribute('aria-hidden') === 'true'),
    ).toHaveLength(0);
  });

  it('forwards onCardClick to each card without transformation', async () => {
    const onCardClick = vi.fn();
    render(
      <ScheduledTaskCardGrid
        items={[buildItem({ id: '1' })]}
        onCardClick={onCardClick}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Competitor Updates' }),
    );

    expect(onCardClick).toHaveBeenCalledWith('1');
  });

  it('forwards skeletonStyles to every trailing skeleton card', () => {
    render(
      <ScheduledTaskCardGrid
        items={[buildItem()]}
        trailingSkeletonCount={2}
        skeletonStyles={{ colors: { skeletonColor: '#ff00ff' } }}
      />,
    );

    const skeletonCards = screen
      .getAllByRole('article', { hidden: true })
      .filter((card) => card.getAttribute('aria-hidden') === 'true');
    expect(skeletonCards.length).toBeGreaterThan(0);
    skeletonCards.forEach((card) => {
      expect(card.style.getPropertyValue('--stcs-skeleton-bg')).toBe('#ff00ff');
    });
  });
});
