import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeploymentsContextType,
  useDeployments,
} from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useSkills } from '../../../context/SkillsContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { createSkillsContextValue } from '../../../context/tests/skills-context-mock';
import { useUiFeature } from '../../useUiFeature';
import {
  useUrlEntityPreselection,
  type UseUrlEntityPreselectionParams,
} from '../useUrlEntityPreselection';
import {
  createParams,
  deployment,
  replaceNavigation,
  setUrl,
} from './preselection-test-utils';

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router', () => ({ useNavigate: () => routerMocks.navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${JSON.stringify(params)}`,
  }),
}));
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/SkillsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../useUiFeature');

describe('useUrlEntityPreselection — deployment-id', () => {
  const showNotification = vi.fn();

  const mockDeployments = (overrides: Partial<DeploymentsContextType> = {}) =>
    vi
      .mocked(useDeployments)
      .mockReturnValue(createDeploymentsContextValue(overrides));

  const renderPreselection = (
    overrides: Partial<UseUrlEntityPreselectionParams> = {},
  ) => {
    const params = createParams(overrides);
    const view = renderHook(() => useUrlEntityPreselection(params));
    return { ...view, params };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.navigate.mockImplementation(replaceNavigation);
    vi.mocked(useUiFeature).mockReturnValue(true);
    vi.mocked(useSkills).mockReturnValue(createSkillsContextValue());
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    mockDeployments({ items: [deployment()] });
  });

  afterEach(() => setUrl('/'));

  it('selects a known deployment without persisting it and keeps the override active', () => {
    setUrl('/?deployment-id=gpt-4o');

    const { result, params } = renderPreselection();

    expect(params.restoreSelectedItemId).toHaveBeenCalledExactlyOnceWith(
      'gpt-4o',
    );
    expect(result.current.isDeploymentOverrideActive).toBe(true);
    expect(window.location.search).toBe('');
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('resolves a deployment addressed by its reference to the catalog id', () => {
    setUrl('/?deployment-id=ref-uuid');
    mockDeployments({
      items: [deployment({ id: 'applications/b/app', reference: 'ref-uuid' })],
    });

    const { params } = renderPreselection();

    expect(params.restoreSelectedItemId).toHaveBeenCalledWith(
      'applications/b/app',
    );
  });

  it('resolves a percent-encoding variant of the id', () => {
    setUrl('/?deployment-id=My%20App');
    mockDeployments({ items: [deployment({ id: 'My%20App' })] });

    const { params } = renderPreselection();

    expect(params.restoreSelectedItemId).toHaveBeenCalledWith('My%20App');
  });

  it('keeps the override active and does nothing while deployments are loading', () => {
    setUrl('/?deployment-id=gpt-4o');
    mockDeployments({ isLoading: true });

    const { result, params } = renderPreselection();

    expect(result.current.isDeploymentOverrideActive).toBe(true);
    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?deployment-id=gpt-4o');
  });

  it('applies the id once deployments finish loading', () => {
    setUrl('/?deployment-id=gpt-4o');
    mockDeployments({ isLoading: true });
    const { rerender, params } = renderPreselection();

    mockDeployments({ items: [deployment()] });
    rerender();

    expect(params.restoreSelectedItemId).toHaveBeenCalledExactlyOnceWith(
      'gpt-4o',
    );
  });

  it('warns and drops the override for an unknown id', () => {
    setUrl('/?deployment-id=does-not-exist');

    const { result, params } = renderPreselection();

    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(result.current.isDeploymentOverrideActive).toBe(false);
    expect(showNotification).toHaveBeenCalledExactlyOnceWith({
      variant: NotificationVariant.Warning,
      title: 'urlPreselection.deploymentNotFoundTitle',
      message:
        'urlPreselection.deploymentNotFoundMessage|{"id":"does-not-exist"}',
    });
    expect(window.location.search).toBe('');
  });

  it('echoes at most 64 characters of an unknown id into the warning', () => {
    const longId = `applications/bucket/${'x'.repeat(100)}`;
    setUrl(`/?deployment-id=${longId}`);

    renderPreselection();

    expect(showNotification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: `urlPreselection.deploymentNotFoundMessage|${JSON.stringify({
          id: `${longId.slice(0, 64)}…`,
        })}`,
      }),
    );
  });

  it('still resolves a known id longer than 64 characters from the full value', () => {
    const longId = `applications/bucket/${'x'.repeat(100)}`;
    setUrl(`/?deployment-id=${longId}`);
    mockDeployments({ items: [deployment({ id: longId })] });

    const { params } = renderPreselection();

    expect(params.restoreSelectedItemId).toHaveBeenCalledExactlyOnceWith(
      longId,
    );
    expect(showNotification).not.toHaveBeenCalled();
  });

  it.each([
    ['hidden', { isHidden: true }],
    ['a custom-UI-only application', { interfaces: ['custom_ui'] }],
    ['an MCP-only application', { interfaces: ['mcp'] }],
  ])('treats %s as unknown', (_label, overrides) => {
    setUrl('/?deployment-id=gpt-4o');
    mockDeployments({ items: [deployment(overrides)] });

    const { result, params } = renderPreselection();

    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(result.current.isDeploymentOverrideActive).toBe(false);
    expect(showNotification).toHaveBeenCalledOnce();
  });

  it('treats a toolset id as unknown because toolsets are not deployments', () => {
    setUrl('/?deployment-id=toolsets/b/search');
    mockDeployments({
      items: [deployment()],
      toolsets: [{ id: 'toolsets/b/search' } as never],
    });

    const { result, params } = renderPreselection();

    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(result.current.isDeploymentOverrideActive).toBe(false);
  });

  it('still applies the id when a refetch failed but the earlier listing holds it', () => {
    setUrl('/?deployment-id=gpt-4o');
    mockDeployments({ items: [deployment()], error: new Error('boom') });

    const { result, params } = renderPreselection();

    expect(params.restoreSelectedItemId).toHaveBeenCalledExactlyOnceWith(
      'gpt-4o',
    );
    expect(result.current.isDeploymentOverrideActive).toBe(true);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('reports the deployment as pending only until it is resolved', () => {
    setUrl('/?deployment-id=gpt-4o');
    mockDeployments({ items: [], isLoading: true });
    const { result, rerender } = renderPreselection();

    expect(result.current.isDeploymentPending).toBe(true);

    mockDeployments({ items: [deployment()] });
    rerender();

    expect(result.current.isDeploymentPending).toBe(false);
  });

  it('shows an error instead of "not found" when deployments failed to load', () => {
    setUrl('/?deployment-id=gpt-4o');
    mockDeployments({ items: [], error: new Error('boom') });

    const { result, params } = renderPreselection();

    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(result.current.isDeploymentOverrideActive).toBe(false);
    expect(showNotification).toHaveBeenCalledExactlyOnceWith({
      variant: NotificationVariant.Error,
      title: 'urlPreselection.deploymentsLoadFailedTitle',
      message: 'urlPreselection.deploymentsLoadFailedMessage',
    });
  });

  it('lets router state win and still removes the parameter', () => {
    setUrl('/?deployment-id=gpt-4o&foo=bar');

    const { result, params } = renderPreselection({
      routeState: {
        hasDeploymentId: true,
        hasSkillId: false,
        hasPrompt: false,
      },
    });

    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(result.current.isDeploymentOverrideActive).toBe(false);
    expect(window.location.search).toBe('?foo=bar');
  });

  it('has no override and does nothing without the parameter', () => {
    setUrl('/?foo=bar');

    const { result, params } = renderPreselection();

    expect(result.current.isDeploymentOverrideActive).toBe(false);
    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it('applies nothing and reports nothing when disabled', () => {
    setUrl('/?deployment-id=does-not-exist');

    const { result, params } = renderPreselection({ isDisabled: true });

    expect(result.current.isDeploymentOverrideActive).toBe(false);
    expect(params.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?deployment-id=does-not-exist');
  });

  it('applies the id only once when the hook re-renders', () => {
    setUrl('/?deployment-id=gpt-4o');
    const { rerender, params } = renderPreselection();

    rerender();
    rerender();

    expect(params.restoreSelectedItemId).toHaveBeenCalledOnce();
  });
});
