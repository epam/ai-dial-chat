import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskSectionKey,
  type ScheduledTaskItem,
} from '../../../models/scheduled-task-item';
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
  sectionKey: ScheduledTaskSectionKey.MyTasks,
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

    const grids = container.querySelectorAll('.grid');
    expect(grids).toHaveLength(1);

    const grid = grids[0];
    expect(grid.querySelectorAll('article').length).toBe(6);
    expect(grid.querySelectorAll('article[aria-hidden="true"]').length).toBe(4);
  });

  it('renders no skeleton cards when trailingSkeletonCount is omitted', () => {
    const { container } = render(
      <ScheduledTaskCardGrid items={[buildItem()]} />,
    );

    expect(
      container.querySelectorAll('article[aria-hidden="true"]'),
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
    const { container } = render(
      <ScheduledTaskCardGrid
        items={[buildItem()]}
        trailingSkeletonCount={2}
        skeletonStyles={{ colors: { skeletonColor: '#ff00ff' } }}
      />,
    );

    const skeletonCards = container.querySelectorAll(
      'article[aria-hidden="true"]',
    );
    expect(skeletonCards.length).toBeGreaterThan(0);
    skeletonCards.forEach((card) => {
      expect(
        (card as HTMLElement).style.getPropertyValue('--stcs-skeleton-bg'),
      ).toBe('#ff00ff');
    });
  });
});
