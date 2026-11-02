import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import {
  useSkills,
  type SkillsContextType,
} from '../../../context/SkillsContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { createSkillsContextValue } from '../../../context/tests/skills-context-mock';
import { useUiFeature } from '../../useUiFeature';
import {
  useUrlEntityPreselection,
  type UseUrlEntityPreselectionParams,
} from '../useUrlEntityPreselection';
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

describe('useUrlEntityPreselection — skill-id', () => {
  const showNotification = vi.fn();

  const mockSkills = (overrides: Partial<SkillsContextType> = {}) =>
    vi.mocked(useSkills).mockReturnValue(createSkillsContextValue(overrides));

  const renderPreselection = (
    overrides: Partial<UseUrlEntityPreselectionParams> = {},
  ) => {
    const params = createParams(overrides);
    const view = renderHook(() => useUrlEntityPreselection(params));
    return { ...view, params };
  };

  const expectSkillUnavailable = () =>
    expect(showNotification).toHaveBeenCalledExactlyOnceWith({
      variant: NotificationVariant.Error,
      title: 'urlPreselection.skillUnavailableTitle',
      message: 'urlPreselection.skillUnavailableMessage',
    });

  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.navigate.mockImplementation(replaceNavigation);
    vi.mocked(useUiFeature).mockReturnValue(true);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(useDeployments).mockReturnValue(
      createDeploymentsContextValue({ items: [deployment()] }),
    );
    mockSkills({ skills: [skillItem()] });
  });

  afterEach(() => setUrl('/'));

  it.each([
    ['own', { skills: [skillItem()] }],
    ['shared-with-me', { sharedWithMe: [skillItem()] }],
    ['public', { publicSkills: [skillItem()] }],
  ])(
    'adds a skill from the %s listing and removes the parameter',
    (_label, listing) => {
      setUrl(`/?skill-id=${SKILL_URL}&foo=bar`);
      mockSkills({ skills: [], ...listing });

      const { params } = renderPreselection();

      expect(params.selectSkillByUrl).toHaveBeenCalledExactlyOnceWith(
        SKILL_URL,
      );
      expect(showNotification).not.toHaveBeenCalled();
      expect(window.location.search).toBe('?foo=bar');
    },
  );

  it('shows an error and leaves the input alone for a skill that is not listed', () => {
    setUrl('/?skill-id=skills/bucket/missing');

    const { params } = renderPreselection();

    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(params.seedSkillMentions).not.toHaveBeenCalled();
    expectSkillUnavailable();
    expect(window.location.search).toBe('');
  });

  it('shows an error for a malformed skill id', () => {
    setUrl('/?skill-id=not-a-skill-url');

    const { params } = renderPreselection();

    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expectSkillUnavailable();
  });

  it('shows an error when the skills feature is disabled', () => {
    setUrl(`/?skill-id=${SKILL_URL}`);
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.Skills,
    );
    mockSkills({ isLoading: false });

    const { params } = renderPreselection();

    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expectSkillUnavailable();
  });

  it('reports a load failure, not "no access", when the listing failed and holds no match', () => {
    setUrl(`/?skill-id=${SKILL_URL}`);
    mockSkills({ skills: [], error: new Error('boom') });

    const { params } = renderPreselection();

    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledExactlyOnceWith({
      variant: NotificationVariant.Error,
      title: 'urlPreselection.skillsLoadFailedTitle',
      message: 'urlPreselection.skillsLoadFailedMessage',
    });
    expect(window.location.search).toBe('');
  });

  it('matches a decoded query value against the percent-encoded listing url', () => {
    const encodedUrl = 'skills/bucket/My%20Skill';
    setUrl(`/?skill-id=${encodeURIComponent(encodedUrl)}`);
    mockSkills({ skills: [skillItem(encodedUrl, 'My Skill')] });

    const { params } = renderPreselection();

    expect(params.selectSkillByUrl).toHaveBeenCalledExactlyOnceWith(encodedUrl);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('still adds the skill when a refetch failed but the stale listing holds a match', () => {
    setUrl(`/?skill-id=${SKILL_URL}`);
    mockSkills({ skills: [skillItem()], error: new Error('boom') });

    const { params } = renderPreselection();

    expect(params.selectSkillByUrl).toHaveBeenCalledWith(SKILL_URL);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('adds nothing until the listing has settled, then adds the listed skill', () => {
    setUrl(`/?skill-id=${SKILL_URL}`);
    mockSkills({ isLoading: true });
    const { rerender, params } = renderPreselection();

    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(window.location.search).toContain('skill-id=');

    mockSkills({ skills: [skillItem()] });
    rerender();

    expect(params.selectSkillByUrl).toHaveBeenCalledExactlyOnceWith(SKILL_URL);
  });

  it('lets router state win and still removes the parameter', () => {
    setUrl(`/?skill-id=${SKILL_URL}`);

    const { params } = renderPreselection({
      routeState: {
        hasDeploymentId: false,
        hasSkillId: true,
        hasPrompt: false,
      },
    });

    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('applies a deployment and a skill together and removes both parameters', () => {
    setUrl(`/?deployment-id=gpt-4o&skill-id=${SKILL_URL}&foo=bar`);

    const { params } = renderPreselection();

    expect(params.restoreSelectedItemId).toHaveBeenCalledWith('gpt-4o');
    expect(params.selectSkillByUrl).toHaveBeenCalledWith(SKILL_URL);
    expect(window.location.search).toBe('?foo=bar');
  });

  it('adds the skill only once when the hook re-renders', () => {
    setUrl(`/?skill-id=${SKILL_URL}`);
    const { rerender, params } = renderPreselection();

    rerender();
    rerender();

    expect(params.selectSkillByUrl).toHaveBeenCalledOnce();
  });
});
