import type {
  DeploymentItemDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { vi } from 'vitest';
import type {
  UrlPreselectionRouteState,
  UseUrlEntityPreselectionParams,
} from '../useUrlEntityPreselection';

export const SKILL_URL = 'skills/bucket/code-review';
export const PUBLIC_PROMPT_ID = 'prompts/public/Work/summarize';
export const PERSONAL_PROMPT_ID = 'prompts/bucket/Work/summarize';

export const setUrl = (url: string, state: unknown = null) =>
  window.history.replaceState(state, '', url);

/** Emulates a router `replace` navigation that keeps the current pathname. */
export const replaceNavigation = (
  to: { search: string; hash: string },
  options?: { state?: unknown },
) =>
  window.history.replaceState(
    { usr: options?.state ?? null },
    '',
    `${window.location.pathname}${to.search}${to.hash}`,
  );

export const createSinks = () => ({
  restoreSelectedItemId: vi.fn(),
  selectSkillByUrl: vi.fn(),
  seedSkillMentions: vi.fn(),
  seedComposerText: vi.fn(),
  openParametersPopup: vi.fn(),
});

export const NO_ROUTE_STATE: UrlPreselectionRouteState = {
  hasDeploymentId: false,
  hasSkillId: false,
  hasPrompt: false,
};

export const createParams = (
  overrides: Partial<UseUrlEntityPreselectionParams> = {},
): UseUrlEntityPreselectionParams => ({
  ...createSinks(),
  routeState: NO_ROUTE_STATE,
  isDisabled: false,
  ...overrides,
});

export const deployment = (
  overrides: Partial<DeploymentItemDto> = {},
): DeploymentItemDto =>
  ({
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    type: 'model',
    ...overrides,
  }) as DeploymentItemDto;

export const skillItem = (
  url = SKILL_URL,
  name = 'code-review',
): SkillMetadataItemDto => ({ url, name }) as SkillMetadataItemDto;
