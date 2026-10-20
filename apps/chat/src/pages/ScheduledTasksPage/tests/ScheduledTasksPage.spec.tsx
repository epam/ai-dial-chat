import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import ScheduledTasksPage from '../ScheduledTasksPage';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const refetchMock = vi.fn();
const setSearchQueryMock = vi.fn();
const setSortKeyMock = vi.fn();
const loadMoreMock = vi.fn();
const useScheduledTasksMock = vi.fn();
vi.mock('../../../hooks/scheduled-tasks/useScheduledTasks', () => ({
  useScheduledTasks: (enabled: boolean) => useScheduledTasksMock(enabled),
}));

const refetchCredentialsMock = vi.fn();
const useOfflineCredentialsGateMock = vi.fn();
vi.mock('../../../hooks/offlineCredentials/useOfflineCredentialsGate', () => ({
  OfflineCredentialsGateStatus: {
    Checking: 'checking',
    Hidden: 'hidden',
    Available: 'available',
    Unavailable: 'unavailable',
    Error: 'error',
  },
  useOfflineCredentialsGate: () => useOfflineCredentialsGateMock(),
}));

const logInMock = vi.fn();
const useOfflineCredentialsAuthMock = vi.fn();
/*
 * The app auth wiring is the test seam: the shared hook is outcome-based, so
 * the page spec drives login outcomes directly instead of the OAuth popup
 * flow (covered by the lib's own spec).
 */
vi.mock('../../../hooks/offlineCredentials/useOfflineCredentialsAuth', () => ({
  useOfflineCredentialsAuth: () => useOfflineCredentialsAuthMock(),
}));

const makeAuthResult = (
  overrides?: Partial<{
    isLoggingIn: boolean;
    loginOutcome: string | undefined;
    isLoggingOut: boolean;
  }>,
) => ({
  isLoggingIn: false,
  loginOutcome: undefined,
  isLoggingOut: false,
  logIn: logInMock,
  logOut: vi.fn(),
  ...overrides,
});

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
    banner,
    styles,
  }: {
    styles?: { typography?: { subtitleClassName?: string } };
    labels: {
      title: string;
      createButtonLabel: string;
      retryLabel: string;
      loadMoreErrorLabel?: string;
      cardLabels?: {
        newBadgeLabel?: string;
        pausedBadgeLabel?: string;
        completedBadgeLabel?: string;
      };
    };
    onCreateClick?: () => void;
    items: { id: string; isCompleted?: boolean }[];
    error: Error | null;
    onRetry: () => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    sortKey: string;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
    onCardClick?: (id: string) => void;
    banner?: ReactNode;
  }) => (
    <div>
      {labels.title}
      <span>items:{items.length}</span>
      <span>searchQuery:{searchQuery}</span>
      <span>sortKey:{sortKey}</span>
      <span>
        subtitleClass:{styles?.typography?.subtitleClassName ?? 'default'}
      </span>
      <span>hasMore:{String(hasMore)}</span>
      <span>isLoadingMore:{String(isLoadingMore)}</span>
      {error && <button onClick={onRetry}>{labels.retryLabel}</button>}
      {onCreateClick != null && (
        <button onClick={onCreateClick}>{labels.createButtonLabel}</button>
      )}
      <button onClick={() => onSearchQueryChange('daily')}>set search</button>
      <button onClick={onLoadMore}>load more</button>
      <span>completedBadgeLabel:{labels.cardLabels?.completedBadgeLabel}</span>
      <span>pausedBadgeLabel:{labels.cardLabels?.pausedBadgeLabel}</span>
      <span>loadMoreErrorLabel:{labels.loadMoreErrorLabel}</span>
      {items.map((item) => (
        <div key={item.id}>
          <button onClick={() => onCardClick?.(item.id)}>card:{item.id}</button>
          <span>completed:{String(item.isCompleted)}</span>
        </div>
      ))}
      {banner}
    </div>
  ),
}));

const CreatePageStub = () => {
  const navigate = useNavigate();
  return (
    <div>
      create page
      <button
        onClick={() =>
          navigate('/scheduled-tasks', { state: { refresh: true } })
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

const CONNECT_SETTINGS = {
  clientId: 'dial-chat',
  authorizationEndpoint: 'https://idp.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

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
    useOfflineCredentialsGateMock.mockReturnValue({
      status: 'hidden',
      connect: undefined,
      connected: false,
      schedulerServiceConsent: 'signed_in',
      refetch: refetchCredentialsMock,
    });
    useOfflineCredentialsAuthMock.mockReturnValue(makeAuthResult());
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

  it('navigates to the create route when New task is clicked', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderScheduledTasksPage();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.toolbar.createButtonLabel',
      }),
    );

    expect(screen.getByText('create page')).toBeTruthy();
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

  describe('limited-access banner and create gating', () => {
    it('shows the limited-access banner and no New task button when the scheduler consent is signed out and the user is connected', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'hidden',
        connect: undefined,
        connected: true,
        schedulerServiceConsent: 'signed_out',
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        'scheduledTasks.limitedAccessBanner.title',
      );
      expect(alert.textContent).toContain(
        'scheduledTasks.limitedAccessBanner.body',
      );
      expect(
        screen.queryByRole('button', {
          name: 'scheduledTasks.toolbar.createButtonLabel',
        }),
      ).toBeNull();
    });

    it('shows the limited-access banner instead of the login banner when the consent is signed out and the user is disconnected', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: CONNECT_SETTINGS,
        connected: false,
        schedulerServiceConsent: 'signed_out',
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        'scheduledTasks.limitedAccessBanner.title',
      );
      expect(alert.textContent).not.toContain(
        'scheduledTasks.offlineCredentialsBanner.title',
      );
      expect(
        screen.queryByRole('button', { name: 'buttons.logIn' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: 'scheduledTasks.toolbar.createButtonLabel',
        }),
      ).toBeNull();
    });

    it('keeps the login banner and the New task button when the consent read failed (unknown)', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: CONNECT_SETTINGS,
        connected: false,
        schedulerServiceConsent: 'unknown',
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      expect(screen.getByRole('alert').textContent).toContain(
        'scheduledTasks.offlineCredentialsBanner.title',
      );
      expect(
        screen.getByRole('button', {
          name: 'scheduledTasks.toolbar.createButtonLabel',
        }),
      ).toBeTruthy();
    });

    it('keeps the list usable while the limited-access banner is shown', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'hidden',
        connect: undefined,
        connected: true,
        schedulerServiceConsent: 'signed_out',
        refetch: refetchCredentialsMock,
      });
      useScheduledTasksMock.mockReturnValue({
        items: [{ id: 'sched_1', displayName: 'Daily summary', trigger: {} }],
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

      expect(screen.getByRole('alert').textContent).toContain(
        'scheduledTasks.limitedAccessBanner.title',
      );
      expect(screen.getByRole('button', { name: 'card:sched_1' })).toBeTruthy();
    });
  });

  describe('offline-credentials login banner', () => {
    it('does not render the banner while status is checking', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'checking',
        connect: undefined,
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('renders the banner without a login action when credentials are unavailable', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'unavailable',
        connect: undefined,
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      expect(screen.getByRole('alert')).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'buttons.logIn' }),
      ).toBeNull();
    });

    it('renders the banner with "Log in required." and a Log in button when available', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: CONNECT_SETTINGS,
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        'scheduledTasks.offlineCredentialsBanner.title',
      );
      expect(
        screen.getByRole('button', { name: 'buttons.logIn' }),
      ).toBeTruthy();
    });

    it('keeps the list usable while the banner is shown', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: CONNECT_SETTINGS,
        refetch: refetchCredentialsMock,
      });
      useScheduledTasksMock.mockReturnValue({
        items: [{ id: 'sched_1', displayName: 'Daily summary', trigger: {} }],
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

      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'card:sched_1' })).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: 'scheduledTasks.toolbar.createButtonLabel',
        }),
      ).toBeTruthy();
    });

    it('starts the auth flow login when the banner Log in is activated', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: CONNECT_SETTINGS,
        refetch: refetchCredentialsMock,
      });
      renderScheduledTasksPage();

      await userEvent.click(
        screen.getByRole('button', { name: 'buttons.logIn' }),
      );

      expect(logInMock).toHaveBeenCalledOnce();
    });

    it.each([
      [
        'popup-blocked',
        'scheduledTasks.offlineCredentialsBanner.popupBlockedMessage',
      ],
      ['cancelled', 'scheduledTasks.offlineCredentialsBanner.cancelledMessage'],
      ['timed-out', 'scheduledTasks.offlineCredentialsBanner.timeoutMessage'],
      ['failure', 'scheduledTasks.offlineCredentialsBanner.failedMessage'],
    ])(
      'keeps the banner visible with a Retry action after a %s outcome',
      async (outcomeType, message) => {
        useFeatureFlagMock.mockReturnValue(true);
        useOfflineCredentialsGateMock.mockReturnValue({
          status: 'available',
          connect: CONNECT_SETTINGS,
          refetch: refetchCredentialsMock,
        });
        useOfflineCredentialsAuthMock.mockReturnValue(
          makeAuthResult({ loginOutcome: outcomeType }),
        );
        renderScheduledTasksPage();

        expect(
          await screen.findByRole('button', { name: 'buttons.retry' }),
        ).toBeTruthy();
        expect(screen.getByText(message)).toBeTruthy();

        await userEvent.click(
          screen.getByRole('button', { name: 'buttons.retry' }),
        );
        expect(logInMock).toHaveBeenCalledOnce();
      },
    );

    it('hides the banner once a successful login outcome resolves with the announcement spoken', () => {
      useFeatureFlagMock.mockReturnValue(true);
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: CONNECT_SETTINGS,
        refetch: refetchCredentialsMock,
      });
      const view = renderScheduledTasksPage();

      expect(screen.getByRole('alert')).toBeTruthy();

      view.unmount();
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'hidden',
        connect: undefined,
        refetch: refetchCredentialsMock,
      });
      useOfflineCredentialsAuthMock.mockReturnValue(
        makeAuthResult({ loginOutcome: 'success' }),
      );
      renderScheduledTasksPage();

      expect(
        screen.getByText(
          'scheduledTasks.offlineCredentialsBanner.successAnnouncement',
        ),
      ).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('renders no disconnect/logout affordance in any gate state', () => {
    useFeatureFlagMock.mockReturnValue(true);
    const gateStates = [
      { status: 'checking', connect: undefined, connected: false },
      { status: 'hidden', connect: undefined, connected: true },
      { status: 'available', connect: CONNECT_SETTINGS, connected: false },
      { status: 'unavailable', connect: undefined, connected: false },
      { status: 'error', connect: undefined, connected: false },
    ];
    for (const gateState of gateStates) {
      useOfflineCredentialsGateMock.mockReturnValue({
        ...gateState,
        refetch: refetchCredentialsMock,
      });
      const view = renderScheduledTasksPage();

      /* The logout surface lives in the Settings Extensions section now —
         no gate state on this page offers a revoke. */
      expect(
        screen.queryByRole('button', { name: 'buttons.logOut' }),
      ).toBeNull();
      expect(
        screen.queryByRole('dialog', {
          name: 'scheduledTasks.disconnect.confirmTitle',
        }),
      ).toBeNull();

      view.unmount();
    }
  });
});

describe('ScheduledTasksPage — completed state', () => {
  it('maps a completed DTO through to the lib items and passes the completed badge label', () => {
    useFeatureFlagMock.mockReturnValue(true);
    useScheduledTasksMock.mockReturnValue({
      items: [
        {
          id: 'sched_done',
          displayName: 'One-time report',
          trigger: { date: '2020-01-01T00:00:00.000Z' },
          triggerType: 'date',
          isActive: false,
          isCompleted: true,
          nextRunTime: null,
        },
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

    expect(screen.getByText('card:sched_done')).toBeTruthy();
    expect(screen.getByText('completed:true')).toBeTruthy();
    expect(
      screen.getByText(
        'completedBadgeLabel:scheduledTasks.card.completedBadgeLabel',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('pausedBadgeLabel:scheduledTasks.card.pausedBadgeLabel'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'loadMoreErrorLabel:scheduledTasks.list.loadMoreErrorLabel',
      ),
    ).toBeTruthy();
  });
});

describe('ScheduledTasksPage — header typography', () => {
  it('uses the small-text description', () => {
    renderScheduledTasksPage();

    expect(
      screen.getByText('subtitleClass:dial-small-text !mt-0.5'),
    ).toBeTruthy();
  });
});
