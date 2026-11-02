import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectViewRoute } from '../../../constants/routes';
import { ROUTES } from '../../../types/routes';
import { UserConfigStatus } from '../../../types/user-config-status';
import ProjectSharedInvitationPage from '../ProjectSharedInvitation';

const mocks = vi.hoisted(() => ({
  isEnabled: true,
  status: 'ready',
  sharedInvitation: vi.fn(() => <div>accepting</div>),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ status: mocks.status }),
  useFeatureFlag: () => mocks.isEnabled,
}));
vi.mock('../../SharedInvitation/SharedInvitation', () => ({
  default: mocks.sharedInvitation,
}));
vi.mock('../../NotFound/NotFound', () => ({
  default: () => <div>not found</div>,
}));
vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>loading</div>,
}));

describe('ProjectSharedInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEnabled = true;
    mocks.status = UserConfigStatus.Ready;
  });

  it('accepts the invitation and targets the project view without refreshing the catalog', () => {
    render(<ProjectSharedInvitationPage />);

    expect(screen.getByText('accepting')).toBeTruthy();
    expect(mocks.sharedInvitation).toHaveBeenCalledWith(
      {
        getTargetRoute: getProjectViewRoute,
        errorFallbackRoute: ROUTES.Projects,
        shouldRefreshCatalog: false,
      },
      undefined,
    );
  });

  it('renders NotFound without accepting when the flag is off', () => {
    mocks.isEnabled = false;

    render(<ProjectSharedInvitationPage />);

    expect(screen.getByText('not found')).toBeTruthy();
    expect(mocks.sharedInvitation).not.toHaveBeenCalled();
  });

  it('waits for the app config before deciding', () => {
    mocks.status = UserConfigStatus.Loading;

    render(<ProjectSharedInvitationPage />);

    expect(screen.getByText('loading')).toBeTruthy();
    expect(mocks.sharedInvitation).not.toHaveBeenCalled();
  });
});
