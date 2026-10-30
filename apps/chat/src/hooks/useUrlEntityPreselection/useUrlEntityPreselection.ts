import {
  findDeploymentByIdOrReference,
  findSkillByUrl,
  getApiErrorDetails,
  normalizeDeploymentId,
  parsePromptResourceUrl,
  parseSkillResourceUrl,
} from '@epam/ai-dial-chat-hooks';
import {
  useEntityPreselection,
  EntityPreselectionSource as Source,
  EntityPreselectionOutcome as Outcome,
  type EntityPreselectionSnapshot,
} from '@epam/ai-dial-chat-hooks/conversation';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  extractPromptParams,
  PUBLIC_BUCKET,
  type RequestSkill,
} from '@epam/ai-dial-chat-shared';
import { getSkillFallbackName } from '@epam/ai-dial-skills';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { PendingParametersPrompt } from '../../components/PromptSelector/usePromptSelectorOverlay';
import { UrlPreselectionI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useSkills } from '../../context/SkillsContext';
import { getPrompt, getPublicPrompt } from '../../server-api/prompts.api';
import { UrlPreselectionQuery } from '../../types/url-preselection';
import { isDeepLinkableDeployment } from '../../utils/deployments';
import {
  getCleanedLocationTarget,
  getCurrentRouterState,
} from '../../utils/url-cleanup';
import { useUiFeature } from '../useUiFeature';

/** Longest part of a link-supplied id echoed into a notification, so a crafted link cannot show arbitrary long text. */
const MAX_ECHOED_ID_LENGTH = 64;

/** Sinks of the new-conversation route that the URL parameters are applied through. */
export interface UrlPreselectionSinks {
  /** Selects a deployment without saving it as the user's preference. */
  restoreSelectedItemId: (id: string) => void;
  /** Adds a skill mention (named from the skill listings) to the message input. */
  selectSkillByUrl: (url: string) => void;
  /** Replaces the message input with `content` and tracks `entries` as its skill mentions. */
  seedSkillMentions: (
    content: string,
    entries: RequestSkill[] | undefined,
  ) => void;
  /** Replaces the message input text. */
  seedComposerText: (text: string) => void;
  /** Opens the "Prompt parameters" popup for a parameterized prompt. */
  openParametersPopup: (prompt: PendingParametersPrompt) => void;
}

/** Sources the route already received from router state, which win over the URL. */
export interface UrlPreselectionRouteState {
  /** Router state carries a `deploymentId`. */
  hasDeploymentId: boolean;
  /** Router state carries a `skillId`. */
  hasSkillId: boolean;
  /** Router state carries a `promptContent` or a `pendingPrompt`. */
  hasPrompt: boolean;
}

/** Parameters of {@link useUrlEntityPreselection}. */
export interface UseUrlEntityPreselectionParams extends UrlPreselectionSinks {
  /** Router-state sources that take precedence over the URL parameters. */
  routeState: UrlPreselectionRouteState;
  /** Isolated view or overlay mode: the hook then neither applies, notifies nor cleans the URL. */
  isDisabled: boolean;
}

/** Result of {@link useUrlEntityPreselection}. */
export interface UseUrlEntityPreselectionResult {
  /** A `deployment-id` is pending or has been applied, so the default selection must not run. */
  isDeploymentOverrideActive: boolean;
  /**
   * A `deployment-id` is still being resolved. The route treats the selection
   * as not yet known while it is set, so the provider's provisional default is
   * neither shown nor used to fetch viewer or tool data.
   */
  isDeploymentPending: boolean;
}

const queryBySource = {
  [Source.Deployment]: UrlPreselectionQuery.DeploymentId,
  [Source.Skill]: UrlPreselectionQuery.SkillId,
  [Source.Prompt]: UrlPreselectionQuery.PromptId,
};

/** Adapts parsed URL values, current catalogs and translated feedback to entity preselection. */
export const useUrlEntityPreselection = ({
  routeState,
  isDisabled,
  ...sinks
}: UseUrlEntityPreselectionParams): UseUrlEntityPreselectionResult => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showWarningNotification, showErrorNotification } = useNotification();
  const {
    items,
    isLoading: isDeploymentsLoading,
    error: deploymentsError,
  } = useDeployments();
  const {
    skills,
    sharedWithMe,
    publicSkills,
    isLoading: isSkillsLoading,
    error: skillsError,
  } = useSkills();
  const isSkillsEnabled = useUiFeature(OverlayFeature.Skills);
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);
  const [arrival] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const superseded: Source[] = [];
    if (routeState.hasDeploymentId) superseded.push(Source.Deployment);
    if (routeState.hasSkillId) superseded.push(Source.Skill);
    if (routeState.hasPrompt) superseded.push(Source.Prompt);
    const snapshot: EntityPreselectionSnapshot = {
      deploymentId: query.get(UrlPreselectionQuery.DeploymentId) || null,
      skillId: query.get(UrlPreselectionQuery.SkillId) || null,
      promptId: query.get(UrlPreselectionQuery.PromptId) || null,
      superseded,
      isDisabled,
    };
    return { snapshot, pathname: window.location.pathname };
  });
  return useEntityPreselection({
    snapshot: arrival.snapshot,
    sinks,
    isDeploymentsLoading,
    deploymentsError,
    resolveDeployment: (id) => {
      const match = findDeploymentByIdOrReference(items, id);
      return match && isDeepLinkableDeployment(match) ? match : undefined;
    },
    isSkillsLoading,
    skillsError,
    isSkillsEnabled,
    resolveSkill: (id) => {
      const match = parseSkillResourceUrl(id)
        ? findSkillByUrl({ skills, sharedWithMe, publicSkills }, id)
        : undefined;
      return match
        ? {
            url: match.url,
            name: match.name || getSkillFallbackName(match.url),
          }
        : undefined;
    },
    isPromptsEnabled,
    loadPrompt: async (rawId) => {
      const id = normalizeDeploymentId(rawId);
      const parsed = parsePromptResourceUrl(id);
      if (!parsed) return undefined;
      try {
        const dto =
          parsed.bucket === PUBLIC_BUCKET
            ? await getPublicPrompt(parsed.path)
            : await getPrompt(id);
        return {
          prompt: {
            id,
            name: dto.name,
            description: dto.description,
            content: dto.content,
          },
          hasParameters: extractPromptParams(dto.content).length > 0,
        };
      } catch (error) {
        throw await getApiErrorDetails(error);
      }
    },
    onConsume: (sources) => {
      if (window.location.pathname !== arrival.pathname) return;
      const keys = sources.map((source) => queryBySource[source]);
      const current = new URLSearchParams(window.location.search);
      if (!keys.some((key) => current.has(key))) return;
      navigate(getCleanedLocationTarget(keys), {
        replace: true,
        state: getCurrentRouterState(),
      });
    },
    onOutcome: (outcome, id, error) => {
      switch (outcome) {
        case Outcome.DeploymentUnavailable:
          showWarningNotification({
            title: t(UrlPreselectionI18nKeys.DeploymentNotFoundTitle),
            message: t(UrlPreselectionI18nKeys.DeploymentNotFoundMessage, {
              id:
                id.length > MAX_ECHOED_ID_LENGTH
                  ? `${id.slice(0, MAX_ECHOED_ID_LENGTH)}…`
                  : id,
            }),
          });
          break;
        case Outcome.DeploymentsLoadFailed:
          showErrorNotification({
            title: t(UrlPreselectionI18nKeys.DeploymentsLoadFailedTitle),
            message: t(UrlPreselectionI18nKeys.DeploymentsLoadFailedMessage),
          });
          break;
        case Outcome.SkillUnavailable:
        case Outcome.SkillsLoadFailed: {
          const failed = outcome === Outcome.SkillsLoadFailed;
          showErrorNotification({
            title: t(
              failed
                ? UrlPreselectionI18nKeys.SkillsLoadFailedTitle
                : UrlPreselectionI18nKeys.SkillUnavailableTitle,
            ),
            message: t(
              failed
                ? UrlPreselectionI18nKeys.SkillsLoadFailedMessage
                : UrlPreselectionI18nKeys.SkillUnavailableMessage,
            ),
          });
          break;
        }
        case Outcome.PromptUnavailable:
          showErrorNotification({
            title: t(UrlPreselectionI18nKeys.PromptUnavailableTitle),
            message: t(UrlPreselectionI18nKeys.PromptUnavailableMessage),
            requestId: (error as { traceId?: string } | undefined)?.traceId,
          });
      }
    },
  });
};
