import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import ScheduledTasksPage from '../ScheduledTasksPage';

const useFeatureFlagMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
}));

const useUserMock = vi.fn();
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => useUserMock(),
}));

const refetchMock = vi.fn();
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
  ScheduledTaskSectionKey: {
    Shared: 'shared',
    MyTasks: 'myTasks',
  },
  ScheduledTasks: ({
    labels,
    onCreateClick,
    items,
    error,
    onRetry,
  }: {
    labels: { title: string; createButtonLabel: string; retryLabel: string };
    onCreateClick: () => void;
    items: { id: string }[];
    error: Error | null;
    onRetry: () => void;
  }) => (
    <div>
      {labels.title}
      <span>items:{items.length}</span>
      {error && <button onClick={onRetry}>{labels.retryLabel}</button>}
      <button onClick={onCreateClick}>{labels.createButtonLabel}</button>
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

const renderScheduledTasksPage = () =>
  render(
    <MemoryRouter initialEntries={['/scheduled-tasks']}>
      <Routes>
        <Route path="/scheduled-tasks" element={<ScheduledTasksPage />} />
        <Route path="/scheduled-tasks/new" element={<CreatePageStub />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ScheduledTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScheduledTasksMock.mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    useUserMock.mockReturnValue({ user: { sub: 'user-1' } });
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
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    renderScheduledTasksPage();

    expect(screen.getByText('items:2')).toBeTruthy();
  });

  it('calls refetch when the retry action is activated', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    useScheduledTasksMock.mockReturnValue({
      items: [],
      isLoading: false,
      error: new Error('boom'),
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
