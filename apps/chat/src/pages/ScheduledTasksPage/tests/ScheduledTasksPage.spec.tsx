import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import ScheduledTasksPage from '../ScheduledTasksPage';

const useFeatureFlagMock = vi.fn();
const useAppConfigMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
  useAppConfig: () => useAppConfigMock(),
}));

const refetchMock = vi.fn();
const setSearchQueryMock = vi.fn();
const setSortKeyMock = vi.fn();
const loadMoreMock = vi.fn();
const useScheduledTasksMock = vi.fn();
vi.mock('../../../hooks/scheduled-tasks/useScheduledTasks', () => ({
  useScheduledTasks: (enabled: boolean) => useScheduledTasksMock(enabled),
}));

vi.mock('@epam/ai-dial-scheduled-tasks', () => ({
  ScheduledTasksSortKey: {
    FirstToRun: 'firstToRun',
    LastToRun: 'lastToRun',
    Newest: 'newest',
    NameAZ: 'nameAZ',
  },
  ScheduledTasks: ({
    labels,
    onCreateClick,
    items,
    error,
    onRetry,
    searchQuery,
    onSearchQueryChange,
    sortKey,
    hasMore,
    isLoadingMore,
    onLoadMore,
    onCardClick,
  }: {
    labels: { title: string; createButtonLabel: string; retryLabel: string };
    onCreateClick: () => void;
    items: { id: string }[];
    error: Error | null;
    onRetry: () => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    sortKey: string;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
    onCardClick?: (id: string) => void;
  }) => (
    <div>
      {labels.title}
      <span>items:{items.length}</span>
      <span>searchQuery:{searchQuery}</span>
      <span>sortKey:{sortKey}</span>
      <span>hasMore:{String(hasMore)}</span>
      <span>isLoadingMore:{String(isLoadingMore)}</span>
      {error && <button onClick={onRetry}>{labels.retryLabel}</button>}
      <button onClick={onCreateClick}>{labels.createButtonLabel}</button>
      <button onClick={() => onSearchQueryChange('daily')}>set search</button>
      <button onClick={onLoadMore}>load more</button>
      {items.map((item) => (
        <button key={item.id} onClick={() => onCardClick?.(item.id)}>
          card:{item.id}
        </button>
      ))}
    </div>
  ),
}));

const CreatePageStub = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  return (
    <div>
      create page returnUrl={searchParams.get('returnUrl')}
      <button
        onClick={() =>
          navigate(searchParams.get('returnUrl') ?? '/scheduled-tasks', {
            state: { refresh: true },
          })
        }
      >
        submit
      </button>
    </div>
  );
};

const DetailPageStub = () => <div>detail page</div>;
const EditPageStub = () => <div>edit page</div>;

const renderScheduledTasksPage = () =>
  render(
    <MemoryRouter initialEntries={['/scheduled-tasks']}>
      <Routes>
        <Route path="/scheduled-tasks" element={<ScheduledTasksPage />} />
        <Route path="/scheduled-tasks/new" element={<CreatePageStub />} />
        <Route
          path="/scheduled-tasks/:scheduleId/edit"
          element={<EditPageStub />}
        />
        <Route
          path="/scheduled-tasks/:scheduleId"
          element={<DetailPageStub />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ScheduledTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScheduledTasksMock.mockReturnValue({
      items: [],
      searchQuery: '',
      setSearchQuery: setSearchQueryMock,
      sortKey: 'firstToRun',
      setSortKey: setSortKeyMock,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      hasMore: false,
      loadMore: loadMoreMock,
      refetch: refetchMock,
    });
    useAppConfigMock.mockReturnValue({ status: 'ready' });
  });

  it('renders a fallback instead of NotFound while app config is still loading', () => {
    useAppConfigMock.mockReturnValue({ status: 'loading' });
    useFeatureFlagMock.mockReturnValue(false);
    renderScheduledTasksPage();

    expect(
      screen.queryByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeNull();
  });

  it('renders the NotFound page when scheduledTasksEnabled is false', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderScheduledTasksPage();

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
    expect(useScheduledTasksMock).toHaveBeenCalledWith(false);
  });

  it('renders the Scheduled Tasks lib component when scheduledTasksEnabled is true', () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderScheduledTasksPage();

    expect(screen.getByText('scheduledTasks.page.title')).toBeTruthy();
    expect(
      screen.queryByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeNull();
    expect(useScheduledTasksMock).toHaveBeenCalledWith(true);
  });

  it('queries the flag by its short key', () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderScheduledTasksPage();

    expect(useFeatureFlagMock).toHaveBeenCalledWith('scheduledTasksEnabled');
  });

  it('passes the mapped items from the hook into the lib component', () => {
    useFeatureFlagMock.mockReturnValue(true);
    useScheduledTasksMock.mockReturnValue({
      items: [
        { id: '1', displayName: 'Daily summary', trigger: {} },
        { id: '2', displayName: 'Weekly digest', trigger: {} },
      ],
      searchQuery: '',
      setSearchQuery: setSearchQueryMock,
      sortKey: 'firstToRun',
      setSortKey: setSortKeyMock,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      hasMore: false,
      loadMore: loadMoreMock,
      refetch: refetchMock,
    });
    renderScheduledTasksPage();

    expect(screen.getByText('items:2')).toBeTruthy();
  });

  it('calls refetch when the retry action is activated', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    useScheduledTasksMock.mockReturnValue({
      items: [],
      searchQuery: '',
      setSearchQuery: setSearchQueryMock,
      sortKey: 'firstToRun',
      setSortKey: setSortKeyMock,
      isLoading: false,
      isLoadingMore: false,
      error: new Error('boom'),
      hasMore: false,
      loadMore: loadMoreMock,
      refetch: refetchMock,
    });
    renderScheduledTasksPage();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.list.retryLabel',
      }),
    );

    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('binds searchQuery/setSearchQuery from the hook to the lib component', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderScheduledTasksPage();

    expect(screen.getByText('searchQuery:')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'set search' }));

    expect(setSearchQueryMock).toHaveBeenCalledWith('daily');
  });

  it('passes hasMore/isLoadingMore and wires onLoadMore to the hook loadMore', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    useScheduledTasksMock.mockReturnValue({
      items: [],
      searchQuery: '',
      setSearchQuery: setSearchQueryMock,
      sortKey: 'firstToRun',
      setSortKey: setSortKeyMock,
      isLoading: false,
      isLoadingMore: true,
      error: null,
      hasMore: true,
      loadMore: loadMoreMock,
      refetch: refetchMock,
    });
    renderScheduledTasksPage();

    expect(screen.getByText('hasMore:true')).toBeTruthy();
    expect(screen.getByText('isLoadingMore:true')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'load more' }));

    expect(loadMoreMock).toHaveBeenCalledOnce();
  });

  it('navigates to the create route with returnUrl when New task is clicked', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderScheduledTasksPage();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.toolbar.createButtonLabel',
      }),
    );

    expect(
      screen.getByText('create page returnUrl=/scheduled-tasks'),
    ).toBeTruthy();
  });

  it('navigates to the detail route when a card is clicked', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    useScheduledTasksMock.mockReturnValue({
      items: [{ id: 'sched_123', displayName: 'Daily summary', trigger: {} }],
      searchQuery: '',
      setSearchQuery: setSearchQueryMock,
      sortKey: 'firstToRun',
      setSortKey: setSortKeyMock,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      hasMore: false,
      loadMore: loadMoreMock,
      refetch: refetchMock,
    });
    renderScheduledTasksPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'card:sched_123' }),
    );

    expect(screen.getByText('detail page')).toBeTruthy();
  });

  it('refetches when returning from the create flow with a refresh navigation state', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderScheduledTasksPage();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.toolbar.createButtonLabel',
      }),
    );
    refetchMock.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
