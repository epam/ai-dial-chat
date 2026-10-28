import {
  findDeploymentByIdOrReference,
  getApiErrorDetails,
  normalizeDeploymentId,
  parsePromptResourceUrl,
  parseSkillResourceUrl,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  extractPromptParams,
  PUBLIC_BUCKET,
  type RequestSkill,
} from '@epam/ai-dial-chat-shared';
import { getSkillFallbackName } from '@epam/ai-dial-skills';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { findSkillByUrl } from '../../utils/skills';
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

enum DeploymentOutcome {
  Idle = 'idle',
  Pending = 'pending',
  Applied = 'applied',
  Settled = 'settled',
}

enum SourceStatus {
  Idle = 'idle',
  Pending = 'pending',
  Resolved = 'resolved',
  Failed = 'failed',
}

interface SkillSource {
  status: SourceStatus;
  url?: string;
  name?: string;
}

interface PromptSource {
  status: SourceStatus;
  prompt?: PendingParametersPrompt;
  hasParameters?: boolean;
}

/**
 * Applies the `deployment-id`, `skill-id` and `prompt-id` query parameters once on
 * arrival at the new-conversation route, through the route's own sinks, and removes
 * each parameter from the URL as soon as it has been applied or has failed.
 *
 * It owns the parameter snapshot, the per-source "applied" guards and the URL
 * cleanup, so the route's router-state effects stay untouched and cannot re-fire on
 * URL-derived values. Sinks are read through refs because several of them change
 * identity on every render; `isDeploymentOverrideActive` is state so the route's
 * default-selection effect re-runs when an unknown id settles.
 * @param params - route sinks, router-state precedence flags and the disabled switch
 */
export const useUrlEntityPreselection = ({
  restoreSelectedItemId,
  selectSkillByUrl,
  seedSkillMentions,
  seedComposerText,
  openParametersPopup,
  routeState,
  isDisabled,
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

  const [snapshot] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const read = (query: UrlPreselectionQuery) => params.get(query) || null;
    return {
      deploymentId: read(UrlPreselectionQuery.DeploymentId),
      skillId: read(UrlPreselectionQuery.SkillId),
      promptId: read(UrlPreselectionQuery.PromptId),
      pathname: window.location.pathname,
      routeState,
      isDisabled,
    };
  });

  const isSourceActive = (id: string | null, hasRouteState: boolean) =>
    !snapshot.isDisabled && id != null && !hasRouteState;

  const [deploymentOutcome, setDeploymentOutcome] = useState(() =>
    isSourceActive(snapshot.deploymentId, snapshot.routeState.hasDeploymentId)
      ? DeploymentOutcome.Pending
      : DeploymentOutcome.Idle,
  );
  const [skill, setSkill] = useState<SkillSource>(() => ({
    status: isSourceActive(snapshot.skillId, snapshot.routeState.hasSkillId)
      ? SourceStatus.Pending
      : SourceStatus.Idle,
  }));
  const [prompt, setPrompt] = useState<PromptSource>(() => ({
    status: isSourceActive(snapshot.promptId, snapshot.routeState.hasPrompt)
      ? SourceStatus.Pending
      : SourceStatus.Idle,
  }));

  const latest = {
    sinks: {
      restoreSelectedItemId,
      selectSkillByUrl,
      seedSkillMentions,
      seedComposerText,
      openParametersPopup,
    } satisfies UrlPreselectionSinks,
    showWarningNotification,
    showErrorNotification,
    t,
    navigate,
  };
  const latestRef = useRef(latest);
  useEffect(() => {
    latestRef.current = latest;
  });

  const isMountedRef = useRef(false);
  const hasResolvedDeploymentRef = useRef(false);
  const hasResolvedSkillRef = useRef(false);
  const hasResolvedPromptRef = useRef(false);
  const hasComposedRef = useRef(false);
  const hasCleanedRouteStateRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const removeFromUrl = useCallback(
    (keys: UrlPreselectionQuery[]) => {
      if (
        !isMountedRef.current ||
        window.location.pathname !== snapshot.pathname
      ) {
        return;
      }
      const current = new URLSearchParams(window.location.search);
      if (!keys.some((key) => current.has(key))) return;
      latestRef.current.navigate(getCleanedLocationTarget(keys), {
        replace: true,
        state: getCurrentRouterState(),
      });
    },
    [snapshot.pathname],
  );

  useEffect(() => {
    if (snapshot.isDisabled || hasCleanedRouteStateRef.current) return;
    hasCleanedRouteStateRef.current = true;
    const superseded: UrlPreselectionQuery[] = [];
    if (snapshot.deploymentId && snapshot.routeState.hasDeploymentId) {
      superseded.push(UrlPreselectionQuery.DeploymentId);
    }
    if (snapshot.skillId && snapshot.routeState.hasSkillId) {
      superseded.push(UrlPreselectionQuery.SkillId);
    }
    if (snapshot.promptId && snapshot.routeState.hasPrompt) {
      superseded.push(UrlPreselectionQuery.PromptId);
    }
    removeFromUrl(superseded);
  }, [snapshot, removeFromUrl]);

  useEffect(() => {
    if (
      deploymentOutcome !== DeploymentOutcome.Pending ||
      isDeploymentsLoading ||
      hasResolvedDeploymentRef.current
    ) {
      return;
    }
    hasResolvedDeploymentRef.current = true;
    const id = snapshot.deploymentId ?? '';
    const { sinks, showWarningNotification, showErrorNotification, t } =
      latestRef.current;

    /* A failed refetch can leave an earlier, still usable listing in `items`, so the id is looked up before the error is reported. */
    const deployment = findDeploymentByIdOrReference(items, id);
    if (deployment && isDeepLinkableDeployment(deployment)) {
      sinks.restoreSelectedItemId(deployment.id);
      setDeploymentOutcome(DeploymentOutcome.Applied);
    } else if (deploymentsError != null) {
      showErrorNotification({
        title: t(UrlPreselectionI18nKeys.DeploymentsLoadFailedTitle),
        message: t(UrlPreselectionI18nKeys.DeploymentsLoadFailedMessage),
      });
      setDeploymentOutcome(DeploymentOutcome.Settled);
    } else {
      showWarningNotification({
        title: t(UrlPreselectionI18nKeys.DeploymentNotFoundTitle),
        message: t(UrlPreselectionI18nKeys.DeploymentNotFoundMessage, {
          id:
            id.length > MAX_ECHOED_ID_LENGTH
              ? `${id.slice(0, MAX_ECHOED_ID_LENGTH)}…`
              : id,
        }),
      });
      setDeploymentOutcome(DeploymentOutcome.Settled);
    }
    removeFromUrl([UrlPreselectionQuery.DeploymentId]);
  }, [
    deploymentOutcome,
    isDeploymentsLoading,
    deploymentsError,
    items,
    snapshot.deploymentId,
    removeFromUrl,
  ]);

  useEffect(() => {
    if (
      skill.status !== SourceStatus.Pending ||
      isSkillsLoading ||
      hasResolvedSkillRef.current
    ) {
      return;
    }
    hasResolvedSkillRef.current = true;
    const url = snapshot.skillId ?? '';
    const match =
      isSkillsEnabled && parseSkillResourceUrl(url)
        ? findSkillByUrl({ skills, sharedWithMe, publicSkills }, url)
        : undefined;

    if (match) {
      /* The listing's own `url` is canonical; the query value may have arrived decoded. */
      setSkill({
        status: SourceStatus.Resolved,
        url: match.url,
        name: match.name || getSkillFallbackName(match.url),
      });
      return;
    }
    const { showErrorNotification, t } = latestRef.current;
    const isLoadFailure = isSkillsEnabled && skillsError != null;
    showErrorNotification({
      title: t(
        isLoadFailure
          ? UrlPreselectionI18nKeys.SkillsLoadFailedTitle
          : UrlPreselectionI18nKeys.SkillUnavailableTitle,
      ),
      message: t(
        isLoadFailure
          ? UrlPreselectionI18nKeys.SkillsLoadFailedMessage
          : UrlPreselectionI18nKeys.SkillUnavailableMessage,
      ),
    });
    setSkill({ status: SourceStatus.Failed });
    removeFromUrl([UrlPreselectionQuery.SkillId]);
  }, [
    skill.status,
    isSkillsLoading,
    skillsError,
    isSkillsEnabled,
    skills,
    sharedWithMe,
    publicSkills,
    snapshot.skillId,
    removeFromUrl,
  ]);

  useEffect(() => {
    if (
      prompt.status !== SourceStatus.Pending ||
      hasResolvedPromptRef.current
    ) {
      return;
    }
    /* Re-encoded per segment: the query value arrives decoded, while prompt ids are percent-encoded resource paths. */
    const id = normalizeDeploymentId(snapshot.promptId ?? '');
    const parsed = isPromptsEnabled ? parsePromptResourceUrl(id) : null;
    let isCancelled = false;

    const fail = async (error?: unknown) => {
      const traceId =
        error === undefined
          ? undefined
          : (await getApiErrorDetails(error)).traceId;
      if (isCancelled) return;
      hasResolvedPromptRef.current = true;
      const { showErrorNotification, t } = latestRef.current;
      showErrorNotification({
        title: t(UrlPreselectionI18nKeys.PromptUnavailableTitle),
        message: t(UrlPreselectionI18nKeys.PromptUnavailableMessage),
        requestId: traceId,
      });
      setPrompt({ status: SourceStatus.Failed });
      removeFromUrl([UrlPreselectionQuery.PromptId]);
    };

    const load = async () => {
      if (!parsed) {
        await fail();
        return;
      }
      try {
        const dto =
          parsed.bucket === PUBLIC_BUCKET
            ? await getPublicPrompt(parsed.path)
            : await getPrompt(id);
        if (isCancelled) return;
        hasResolvedPromptRef.current = true;
        setPrompt({
          status: SourceStatus.Resolved,
          prompt: {
            id,
            name: dto.name,
            description: dto.description,
            content: dto.content,
          },
          hasParameters: extractPromptParams(dto.content).length > 0,
        });
      } catch (error) {
        await fail(error);
      }
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [prompt.status, isPromptsEnabled, snapshot.promptId, removeFromUrl]);

  useEffect(() => {
    if (hasComposedRef.current) return;
    const statuses = [skill.status, prompt.status];
    const isAnyPending = statuses.includes(SourceStatus.Pending);
    const isAnyResolved = statuses.includes(SourceStatus.Resolved);
    if (isAnyPending || !isAnyResolved) return;
    hasComposedRef.current = true;

    const { sinks } = latestRef.current;
    const resolvedSkill =
      skill.status === SourceStatus.Resolved ? skill : undefined;
    const resolvedPrompt =
      prompt.status === SourceStatus.Resolved && prompt.prompt
        ? prompt.prompt
        : undefined;
    const appliedKeys: UrlPreselectionQuery[] = [];

    if (resolvedSkill?.url && resolvedPrompt) {
      if (prompt.hasParameters) {
        sinks.selectSkillByUrl(resolvedSkill.url);
        sinks.openParametersPopup(resolvedPrompt);
      } else {
        sinks.seedSkillMentions(
          `/${resolvedSkill.name} ${resolvedPrompt.content}`,
          [{ url: resolvedSkill.url }],
        );
      }
      appliedKeys.push(
        UrlPreselectionQuery.SkillId,
        UrlPreselectionQuery.PromptId,
      );
    } else if (resolvedSkill?.url) {
      sinks.selectSkillByUrl(resolvedSkill.url);
      appliedKeys.push(UrlPreselectionQuery.SkillId);
    } else if (resolvedPrompt) {
      if (prompt.hasParameters) {
        sinks.openParametersPopup(resolvedPrompt);
      } else {
        sinks.seedComposerText(resolvedPrompt.content);
      }
      appliedKeys.push(UrlPreselectionQuery.PromptId);
    }
    removeFromUrl(appliedKeys);
  }, [skill, prompt, removeFromUrl]);

  return {
    isDeploymentOverrideActive:
      deploymentOutcome === DeploymentOutcome.Pending ||
      deploymentOutcome === DeploymentOutcome.Applied,
    isDeploymentPending: deploymentOutcome === DeploymentOutcome.Pending,
  };
};
