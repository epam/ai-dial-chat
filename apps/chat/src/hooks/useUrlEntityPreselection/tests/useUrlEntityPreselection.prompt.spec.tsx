import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useSkills } from '../../../context/SkillsContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { createSkillsContextValue } from '../../../context/tests/skills-context-mock';
import { getPrompt, getPublicPrompt } from '../../../server-api/prompts.api';
import { useUiFeature } from '../../useUiFeature';
import {
  useUrlEntityPreselection,
  type UseUrlEntityPreselectionParams,
} from '../useUrlEntityPreselection';
import {
  PERSONAL_PROMPT_ID,
  PUBLIC_PROMPT_ID,
  createParams,
  replaceNavigation,
  setUrl,
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
    getApiErrorDetails: vi.fn().mockResolvedValue({ traceId: 'trace-1' }),
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

describe('useUrlEntityPreselection — prompt-id', () => {
  const showNotification = vi.fn();

  const renderPreselection = (
    overrides: Partial<UseUrlEntityPreselectionParams> = {},
    options: { isStrict?: boolean } = {},
  ) => {
    const params = createParams(overrides);
    const view = renderHook(() => useUrlEntityPreselection(params), {
      wrapper: options.isStrict ? StrictMode : undefined,
    });
    return { ...view, params };
  };

  const expectPromptUnavailable = (requestId?: string) =>
    expect(showNotification).toHaveBeenCalledExactlyOnceWith({
      variant: NotificationVariant.Error,
      title: 'urlPreselection.promptUnavailableTitle',
      message: 'urlPreselection.promptUnavailableMessage',
      requestId,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.navigate.mockImplementation(replaceNavigation);
    vi.mocked(useUiFeature).mockReturnValue(true);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(useDeployments).mockReturnValue(createDeploymentsContextValue());
    vi.mocked(useSkills).mockReturnValue(createSkillsContextValue());
    vi.mocked(getPrompt).mockResolvedValue(promptDto('Summarize the text.'));
    vi.mocked(getPublicPrompt).mockResolvedValue(
      promptDto('Summarize the text.'),
    );
  });

  afterEach(() => setUrl('/'));

  it('seeds the composer with a body without parameters and removes the parameter', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}&foo=bar`);

    const { params } = renderPreselection();

    await waitFor(() =>
      expect(params.seedComposerText).toHaveBeenCalledExactlyOnceWith(
        'Summarize the text.',
      ),
    );
    expect(params.openParametersPopup).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?foo=bar');
  });

  it('opens the parameters popup for a body with parameters', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);
    vi.mocked(getPrompt).mockResolvedValue(
      promptDto('Summarize {{text}} in {{language}}.'),
    );

    const { params } = renderPreselection();

    await waitFor(() =>
      expect(params.openParametersPopup).toHaveBeenCalledExactlyOnceWith({
        id: PERSONAL_PROMPT_ID,
        name: 'Summarize',
        description: 'Summarizes text',
        content: 'Summarize {{text}} in {{language}}.',
      }),
    );
    expect(params.seedComposerText).not.toHaveBeenCalled();
  });

  it('reads a personal or shared prompt by its full id', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);

    const { params } = renderPreselection();

    await waitFor(() => expect(params.seedComposerText).toHaveBeenCalled());
    expect(getPrompt).toHaveBeenCalledWith(PERSONAL_PROMPT_ID);
    expect(getPublicPrompt).not.toHaveBeenCalled();
  });

  it('re-encodes a decoded query value into the percent-encoded prompt id', async () => {
    const encodedId = 'prompts/bucket/Work/My%20Prompt';
    setUrl(`/?prompt-id=${encodeURIComponent(encodedId)}`);

    const { params } = renderPreselection();

    await waitFor(() => expect(params.seedComposerText).toHaveBeenCalled());
    expect(getPrompt).toHaveBeenCalledWith(encodedId);
  });

  it('reads an organisation prompt through the public read with its bucket-relative path', async () => {
    setUrl(`/?prompt-id=${PUBLIC_PROMPT_ID}`);

    const { params } = renderPreselection();

    await waitFor(() => expect(params.seedComposerText).toHaveBeenCalled());
    expect(getPublicPrompt).toHaveBeenCalledWith('Work/summarize');
    expect(getPrompt).not.toHaveBeenCalled();
  });

  it('shows an error and loads nothing for a malformed id', async () => {
    setUrl('/?prompt-id=not-a-prompt');

    const { params } = renderPreselection();

    await waitFor(() => expectPromptUnavailable());
    expect(getPrompt).not.toHaveBeenCalled();
    expect(getPublicPrompt).not.toHaveBeenCalled();
    expect(params.seedComposerText).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('shows an error and loads nothing when the prompts feature is disabled', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.Prompts,
    );

    const { params } = renderPreselection();

    await waitFor(() => expectPromptUnavailable());
    expect(getPrompt).not.toHaveBeenCalled();
    expect(params.openParametersPopup).not.toHaveBeenCalled();
  });

  it('shows an error carrying the request id when the read fails', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);
    vi.mocked(getPrompt).mockRejectedValue(new Error('403'));

    const { params } = renderPreselection();

    await waitFor(() => expectPromptUnavailable('trace-1'));
    expect(params.seedComposerText).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('does nothing after unmount when the read settles late', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);
    let resolveRead: (value: PromptResponseDto) => void = () => undefined;
    vi.mocked(getPrompt).mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );
    const { unmount, params } = renderPreselection();

    unmount();
    resolveRead(promptDto('Late body'));
    await Promise.resolve();

    expect(params.seedComposerText).not.toHaveBeenCalled();
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it('loads and applies the prompt exactly once under StrictMode', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);

    const { params } = renderPreselection({}, { isStrict: true });

    await waitFor(() =>
      expect(params.seedComposerText).toHaveBeenCalledExactlyOnceWith(
        'Summarize the text.',
      ),
    );
    expect(window.location.search).toBe('');
  });

  it('reports a malformed id once under StrictMode', async () => {
    setUrl('/?prompt-id=not-a-prompt');

    renderPreselection({}, { isStrict: true });

    await waitFor(() => expectPromptUnavailable());
  });

  it('lets router state win and still removes the parameter', async () => {
    setUrl(`/?prompt-id=${PERSONAL_PROMPT_ID}`);

    const { params } = renderPreselection({
      routeState: {
        hasDeploymentId: false,
        hasSkillId: false,
        hasPrompt: true,
      },
    });

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(getPrompt).not.toHaveBeenCalled();
    expect(params.seedComposerText).not.toHaveBeenCalled();
  });
});
