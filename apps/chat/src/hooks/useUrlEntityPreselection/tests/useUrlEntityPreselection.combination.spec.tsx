import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook, waitFor } from '@testing-library/react';
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
import { getPrompt } from '../../../server-api/prompts.api';
import { useUiFeature } from '../../useUiFeature';
import { useUrlEntityPreselection } from '../useUrlEntityPreselection';
import {
  PERSONAL_PROMPT_ID,
  SKILL_URL,
  createParams,
  replaceNavigation,
  setUrl,
  skillItem,
} from './preselection-test-utils';

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router', () => ({ useNavigate: () => routerMocks.navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    getApiErrorDetails: vi.fn().mockResolvedValue({ traceId: undefined }),
  };
});
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/SkillsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../server-api/prompts.api');
vi.mock('../../useUiFeature');

const promptDto = (content: string): PromptResponseDto =>
  ({
    id: 'dto-id',
    name: 'Summarize',
    description: 'Summarizes text',
    content,
  }) as PromptResponseDto;

const URL_WITH_BOTH = `/?skill-id=${SKILL_URL}&prompt-id=${PERSONAL_PROMPT_ID}&foo=bar`;

describe('useUrlEntityPreselection — skill-id with prompt-id', () => {
  const showNotification = vi.fn();

  const mockSkills = (overrides: Partial<SkillsContextType> = {}) =>
    vi.mocked(useSkills).mockReturnValue(createSkillsContextValue(overrides));

  const renderPreselection = () => {
    const params = createParams();
    const view = renderHook(() => useUrlEntityPreselection(params));
    return { ...view, params };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.navigate.mockImplementation(replaceNavigation);
    vi.mocked(useUiFeature).mockReturnValue(true);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(useDeployments).mockReturnValue(createDeploymentsContextValue());
    mockSkills({ skills: [skillItem()] });
    vi.mocked(getPrompt).mockResolvedValue(promptDto('Summarize the text.'));
  });

  afterEach(() => setUrl('/'));

  it('seeds the mention followed by the prompt body in one call for a body without parameters', async () => {
    setUrl(URL_WITH_BOTH);

    const { params } = renderPreselection();

    await waitFor(() =>
      expect(params.seedSkillMentions).toHaveBeenCalledExactlyOnceWith(
        '/code-review Summarize the text.',
        [{ url: SKILL_URL }],
      ),
    );
    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(params.seedComposerText).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?foo=bar');
  });

  it('seeds only the mention and opens the popup for a body with parameters', async () => {
    setUrl(URL_WITH_BOTH);
    vi.mocked(getPrompt).mockResolvedValue(promptDto('Summarize {{text}}.'));

    const { params } = renderPreselection();

    await waitFor(() =>
      expect(params.openParametersPopup).toHaveBeenCalledExactlyOnceWith({
        id: PERSONAL_PROMPT_ID,
        name: 'Summarize',
        description: 'Summarizes text',
        content: 'Summarize {{text}}.',
      }),
    );
    expect(params.selectSkillByUrl).toHaveBeenCalledExactlyOnceWith(SKILL_URL);
    expect(params.seedSkillMentions).not.toHaveBeenCalled();
    expect(params.seedComposerText).not.toHaveBeenCalled();
  });

  it('keeps the skill and reports the prompt when only the prompt fails', async () => {
    setUrl(URL_WITH_BOTH);
    vi.mocked(getPrompt).mockRejectedValue(new Error('404'));

    const { params } = renderPreselection();

    await waitFor(() =>
      expect(params.selectSkillByUrl).toHaveBeenCalledExactlyOnceWith(
        SKILL_URL,
      ),
    );
    expect(showNotification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        title: 'urlPreselection.promptUnavailableTitle',
      }),
    );
    expect(params.seedComposerText).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?foo=bar');
  });

  it('applies the prompt and reports the skill when only the skill is unknown', async () => {
    setUrl(URL_WITH_BOTH);
    mockSkills({ skills: [] });

    const { params } = renderPreselection();

    await waitFor(() =>
      expect(params.seedComposerText).toHaveBeenCalledExactlyOnceWith(
        'Summarize the text.',
      ),
    );
    expect(showNotification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'urlPreselection.skillUnavailableTitle',
      }),
    );
    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?foo=bar');
  });

  it('applies nothing and reports both when both fail', async () => {
    setUrl(URL_WITH_BOTH);
    mockSkills({ skills: [] });
    vi.mocked(getPrompt).mockRejectedValue(new Error('404'));

    const { params } = renderPreselection();

    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    expect(params.seedSkillMentions).not.toHaveBeenCalled();
    expect(params.seedComposerText).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?foo=bar');
  });

  it('gives the same result when the prompt arrives before the skills listing', async () => {
    setUrl(URL_WITH_BOTH);
    mockSkills({ isLoading: true });
    const { rerender, params } = renderPreselection();

    await waitFor(() => expect(getPrompt).toHaveBeenCalled());
    await Promise.resolve();
    expect(params.seedSkillMentions).not.toHaveBeenCalled();
    expect(params.seedComposerText).not.toHaveBeenCalled();

    mockSkills({ skills: [skillItem()] });
    rerender();

    await waitFor(() =>
      expect(params.seedSkillMentions).toHaveBeenCalledExactlyOnceWith(
        '/code-review Summarize the text.',
        [{ url: SKILL_URL }],
      ),
    );
  });

  it('gives the same result when the skills listing arrives before the prompt', async () => {
    setUrl(URL_WITH_BOTH);
    let resolvePrompt: (value: PromptResponseDto) => void = () => undefined;
    vi.mocked(getPrompt).mockReturnValue(
      new Promise((resolve) => {
        resolvePrompt = resolve;
      }),
    );
    const { params } = renderPreselection();

    expect(params.seedSkillMentions).not.toHaveBeenCalled();
    expect(params.selectSkillByUrl).not.toHaveBeenCalled();
    resolvePrompt(promptDto('Summarize the text.'));

    await waitFor(() =>
      expect(params.seedSkillMentions).toHaveBeenCalledExactlyOnceWith(
        '/code-review Summarize the text.',
        [{ url: SKILL_URL }],
      ),
    );
  });

  it('does not turn a /otherSkill inside the prompt body into a second mention', async () => {
    setUrl(URL_WITH_BOTH);
    vi.mocked(getPrompt).mockResolvedValue(
      promptDto('Ask /other-skill about it.'),
    );

    const { params } = renderPreselection();

    await waitFor(() => expect(params.seedSkillMentions).toHaveBeenCalled());
    expect(params.seedSkillMentions).toHaveBeenCalledWith(
      '/code-review Ask /other-skill about it.',
      [{ url: SKILL_URL }],
    );
  });
});
