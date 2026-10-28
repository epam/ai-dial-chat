import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import * as NotificationContextModule from '../../../context/NotificationContext';
import * as SkillsContextModule from '../../../context/SkillsContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { createSkillsContextValue } from '../../../context/tests/skills-context-mock';
import { useUiFeature } from '../../useUiFeature';
import { useUrlEntityPreselection } from '../useUrlEntityPreselection';
import {
  SKILL_URL,
  createParams,
  deployment,
  replaceNavigation,
  setUrl,
  skillItem,
} from './preselection-test-utils';

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router', () => ({ useNavigate: () => routerMocks.navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/SkillsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../useUiFeature');

describe('useUrlEntityPreselection — URL cleanup', () => {
  const showNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.navigate.mockImplementation(replaceNavigation);
    vi.mocked(useUiFeature).mockReturnValue(true);
    vi.mocked(NotificationContextModule.useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({ items: [deployment()] }),
    );
    vi.mocked(SkillsContextModule.useSkills).mockReturnValue(
      createSkillsContextValue({ skills: [skillItem()] }),
    );
  });

  afterEach(() => setUrl('/'));

  it('removes both keys settling in the same tick and keeps the rest of the URL', () => {
    setUrl(`/?a=1&deployment-id=gpt-4o&skill-id=${SKILL_URL}#h`);

    renderHook(() => useUrlEntityPreselection(createParams()));

    expect(window.location.search).toBe('?a=1');
    expect(window.location.hash).toBe('#h');
  });

  it('leaves a parameter in the URL while its source is still pending', () => {
    setUrl(`/?deployment-id=gpt-4o&skill-id=${SKILL_URL}`);
    vi.mocked(SkillsContextModule.useSkills).mockReturnValue(
      createSkillsContextValue({ isLoading: true }),
    );

    renderHook(() => useUrlEntityPreselection(createParams()));

    expect(window.location.search).toBe(`?skill-id=${SKILL_URL}`);
  });

  it('hands the pending router state back unchanged', () => {
    setUrl('/?deployment-id=gpt-4o', {
      usr: { skillId: 'skills/b/p' },
      key: 'k',
      idx: 0,
    });

    renderHook(() => useUrlEntityPreselection(createParams()));

    expect(window.history.state).toEqual({ usr: { skillId: 'skills/b/p' } });
  });

  it('does not rewrite another route when a source settles after leaving', () => {
    setUrl('/?deployment-id=gpt-4o');
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({ isLoading: true }),
    );
    const { rerender } = renderHook(() =>
      useUrlEntityPreselection(createParams()),
    );

    setUrl('/conversations/x?deployment-id=gpt-4o');
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({ items: [deployment()] }),
    );
    rerender();

    expect(routerMocks.navigate).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?deployment-id=gpt-4o');
  });

  it('touches nothing when disabled', () => {
    setUrl(`/?deployment-id=missing&skill-id=${SKILL_URL}&prompt-id=x`);
    const params = createParams({ isDisabled: true });

    renderHook(() => useUrlEntityPreselection(params));

    expect(routerMocks.navigate).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(window.location.search).toBe(
      `?deployment-id=missing&skill-id=${SKILL_URL}&prompt-id=x`,
    );
  });

  it('removes a parameter superseded by router state without applying it', () => {
    setUrl('/?deployment-id=gpt-4o&foo=bar');
    const params = createParams({
      routeState: {
        hasDeploymentId: true,
        hasSkillId: false,
        hasPrompt: false,
      },
    });

    renderHook(() => useUrlEntityPreselection(params));

    expect(window.location.search).toBe('?foo=bar');
    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
  });
});
