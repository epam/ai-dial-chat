import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskItem } from '../../../models/scheduled-task-item';
import { ScheduledTasksProps } from '../../../models/scheduled-tasks-props';
import { ScheduledTasksSortKey } from '../../../types/scheduled-tasks-sort-key';
import { ScheduledTasks } from '../ScheduledTasks';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  Search: ({
    value,
    onChange,
    placeholder,
    clearLabel,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    placeholder?: string;
    clearLabel?: string;
    'aria-label'?: string;
  }) => (
    <>
      <input
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {value && (
        <button aria-label={clearLabel} onClick={() => onChange?.(undefined)} />
      )}
    </>
  ),
  GhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
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
  Spinner: () => <div role="progressbar" />,
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
  DialEllipsisTooltip: ({
    text,
    className,
  }: {
    text: ReactNode;
    className?: string;
  }) => <span className={className}>{text}</span>,
  DialNoDataContent: ({ title, icon }: { title: string; icon?: ReactNode }) => (
    <div>
      {icon}
      <span>{title}</span>
    </div>
  ),
  ButtonDropdown: ({
    label,
    items,
  }: {
    label?: string;
    items: { key: string; label: string; onClick?: () => void }[];
  }) => (
    <div>
      <button>{label}</button>
      {items.map((item) => (
        <button key={item.key} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral' },
  ButtonAppearance: { Ghost: 'ghost', Solid: 'solid' },
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowsSort: () => <svg />,
  IconCalendarTime: () => <svg />,
  IconCheck: () => <svg />,
  IconChevronUp: () => <svg />,
  IconChevronRight: () => <svg />,
  IconDotsVertical: () => <svg />,
  IconEdit: () => <svg />,
  IconFolder: () => <svg />,
  IconPlayerPlay: () => <svg />,
  IconPlus: () => <svg />,
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

const renderScheduledTasks = (overrides?: Partial<ScheduledTasksProps>) =>
  render(
    <ScheduledTasks
      labels={{
        title: 'Scheduled tasks',
        subtitle: 'Automate recurring tasks with scheduled runs.',
        createButtonLabel: 'New task',
        searchPlaceholder: 'Search scheduled tasks...',
        searchAriaLabel: 'Search scheduled tasks by name',
        clearSearchLabel: 'Clear scheduled tasks search',
        sortLabel: 'Sort',
        sortOptions: [
          { key: ScheduledTasksSortKey.FirstToRun, label: 'First to run' },
          { key: ScheduledTasksSortKey.LastToRun, label: 'Last to run' },
        ],
        emptyStateLabel: 'No scheduled tasks yet',
        noResultsLabel: 'No results',
        errorLabel: 'Something went wrong',
        retryLabel: 'Retry',
        loadingMoreLabel: 'Loading more scheduled tasks…',
      }}
      onCreateClick={vi.fn()}
      searchQuery=""
      onSearchQueryChange={vi.fn()}
      sortKey={ScheduledTasksSortKey.FirstToRun}
      onSortChange={vi.fn()}
      items={[]}
      {...overrides}
    />,
  );

describe('ScheduledTasks', () => {
  it('renders the header and toolbar from props', () => {
    renderScheduledTasks();

    expect(
      screen.getByRole('heading', { name: 'Scheduled tasks' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Automate recurring tasks with scheduled runs.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New task' })).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Search scheduled tasks...'),
    ).toBeTruthy();
    expect(
      screen.getByRole('textbox', {
        name: 'Search scheduled tasks by name',
      }),
    ).toBeTruthy();
  });

  it('passes the localized clear-search label to the search control', () => {
    renderScheduledTasks({ searchQuery: 'daily' });

    expect(
      screen.getByRole('button', {
        name: 'Clear scheduled tasks search',
      }),
    ).toBeTruthy();
  });

  it('shows a spinner and no other content when isLoading', () => {
    renderScheduledTasks({ isLoading: true, items: [buildItem()] });

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Competitor Updates')).toBeNull();
  });

  it('shows an error message and calls onRetry when the retry action is activated', async () => {
    const onRetry = vi.fn();
    renderScheduledTasks({ error: new Error('boom'), onRetry });

    expect(screen.getAllByText('Something went wrong').length).toBeGreaterThan(
      0,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the empty state when the source item list is empty', () => {
    renderScheduledTasks({ items: [] });

    expect(
      screen.getAllByText('No scheduled tasks yet').length,
    ).toBeGreaterThan(0);
  });

  it('renders the no-results state, not the empty state, when the server returns zero matches for an active search', () => {
    renderScheduledTasks({
      items: [],
      searchQuery: 'nonexistent',
    });

    expect(screen.getAllByText('No results').length).toBeGreaterThan(0);
    expect(screen.queryByText('No scheduled tasks yet')).toBeNull();
  });

  it('does not re-filter items client-side — an item not matching searchQuery still renders', () => {
    renderScheduledTasks({
      items: [buildItem({ displayName: 'Daily summary' })],
      searchQuery: 'nonexistent',
    });

    expect(screen.getByText('Daily summary')).toBeTruthy();
  });

  it('renders cards for each matching item as a flat grid with no section heading', () => {
    renderScheduledTasks({
      items: [
        buildItem({ id: '1', displayName: 'Daily summary' }),
        buildItem({ id: '2', displayName: 'Weekly digest' }),
      ],
    });

    expect(screen.queryByRole('heading', { name: 'My tasks' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Shared' })).toBeNull();
    expect(screen.getByText('Daily summary')).toBeTruthy();
    expect(screen.getByText('Weekly digest')).toBeTruthy();
  });

  it('renders cards in the order items are received, regardless of sortKey', () => {
    renderScheduledTasks({
      items: [
        buildItem({ id: '1', displayName: 'Zeta' }),
        buildItem({ id: '2', displayName: 'Alpha' }),
      ],
      sortKey: ScheduledTasksSortKey.NameAZ,
    });

    const titles = screen
      .getAllByText(/Zeta|Alpha/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Zeta', 'Alpha']);
  });

  it('calls onCreateClick when the create button is clicked', async () => {
    const onCreateClick = vi.fn();
    renderScheduledTasks({ onCreateClick });

    await userEvent.click(screen.getByRole('button', { name: 'New task' }));

    expect(onCreateClick).toHaveBeenCalledOnce();
  });

  it('calls onSearchQueryChange when typing in the search input', async () => {
    const onSearchQueryChange = vi.fn();
    renderScheduledTasks({ onSearchQueryChange });

    await userEvent.type(
      screen.getByPlaceholderText('Search scheduled tasks...'),
      'a',
    );

    expect(onSearchQueryChange).toHaveBeenCalledWith('a');
  });

  const countSkeletonCards = () =>
    screen
      .queryAllByRole('article', { hidden: true })
      .filter((card) => card.getAttribute('aria-hidden') === 'true').length;

  it('renders exactly 6 skeleton cards below the loaded cards when isLoadingMore', () => {
    renderScheduledTasks({
      items: [buildItem()],
      hasMore: true,
      isLoadingMore: true,
    });

    expect(countSkeletonCards()).toBe(6);
  });

  it('forwards styles.colors.skeletonColor down to every skeleton bar', () => {
    renderScheduledTasks({
      items: [buildItem()],
      hasMore: true,
      isLoadingMore: true,
      styles: { colors: { skeletonColor: '#ff00ff' } },
    });

    const skeletonCards = screen
      .queryAllByRole('article', { hidden: true })
      .filter((card) => card.getAttribute('aria-hidden') === 'true');
    expect(skeletonCards.length).toBeGreaterThan(0);
    skeletonCards.forEach((card) => {
      expect(card.style.getPropertyValue('--stcs-skeleton-bg')).toBe('#ff00ff');
    });
  });

  it('renders a custom skeletonCount of placeholder cards', () => {
    renderScheduledTasks({
      items: [buildItem()],
      hasMore: true,
      isLoadingMore: true,
      skeletonCount: 3,
    });

    expect(countSkeletonCards()).toBe(3);
  });

  it('renders no skeleton cards when isLoadingMore is false', () => {
    renderScheduledTasks({
      items: [buildItem()],
      hasMore: true,
      isLoadingMore: false,
    });

    expect(countSkeletonCards()).toBe(0);
  });

  it('announces the loading-more label via the aria-live status region', () => {
    renderScheduledTasks({
      items: [buildItem()],
      hasMore: true,
      isLoadingMore: true,
    });

    expect(screen.getByRole('status').textContent).toBe(
      'Loading more scheduled tasks…',
    );
  });

  it('renders no skeleton cards during the initial loading state', () => {
    renderScheduledTasks({
      items: [],
      isLoading: true,
      isLoadingMore: true,
    });

    expect(countSkeletonCards()).toBe(0);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  describe('scroll sentinel', () => {
    const mockScrollableAncestor = () => {
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockImplementation(
          (el) =>
            ({
              overflow: 'visible',
              overflowY: el === document.body ? 'visible' : ('auto' as string),
            }) as CSSStyleDeclaration,
        );
      return () => getComputedStyleSpy.mockRestore();
    };

    const mockIntersecting = (isIntersecting: boolean) => {
      const rect = (top: number, bottom: number) =>
        ({ top, bottom }) as DOMRect;
      const isSentinel = (el: Element) =>
        el.tagName === 'DIV' && el.getAttribute('aria-hidden') === 'true';
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
          if (isSentinel(this)) {
            return isIntersecting ? rect(700, 750) : rect(900, 950);
          }
          return rect(0, 800);
        },
      );
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls onLoadMore when the sentinel intersects the scroll container and hasMore is true', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(true);
      const onLoadMore = vi.fn();

      renderScheduledTasks({
        items: [buildItem()],
        hasMore: true,
        isLoadingMore: false,
        onLoadMore,
      });

      expect(onLoadMore).toHaveBeenCalledOnce();
      restoreStyle();
    });

    it('does not call onLoadMore when hasMore is false', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(true);
      const onLoadMore = vi.fn();

      renderScheduledTasks({
        items: [buildItem()],
        hasMore: false,
        onLoadMore,
      });

      expect(onLoadMore).not.toHaveBeenCalled();
      restoreStyle();
    });

    it('does not call onLoadMore while isLoadingMore is true', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(true);
      const onLoadMore = vi.fn();

      renderScheduledTasks({
        items: [buildItem()],
        hasMore: true,
        isLoadingMore: true,
        onLoadMore,
      });

      expect(onLoadMore).not.toHaveBeenCalled();
      restoreStyle();
    });

    it('does not call onLoadMore when the sentinel is not intersecting', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(false);
      const onLoadMore = vi.fn();

      renderScheduledTasks({
        items: [buildItem()],
        hasMore: true,
        onLoadMore,
      });

      expect(onLoadMore).not.toHaveBeenCalled();
      restoreStyle();
    });
  });

  describe('card click navigation', () => {
    it('forwards onCardClick down to the rendered card', async () => {
      const onCardClick = vi.fn();
      renderScheduledTasks({ items: [buildItem()], onCardClick });

      await userEvent.click(
        screen.getByRole('button', { name: 'Competitor Updates' }),
      );

      expect(onCardClick).toHaveBeenCalledWith('sched_1');
    });
  });
});
