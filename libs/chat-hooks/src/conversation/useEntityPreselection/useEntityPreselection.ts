import { useEffect, useRef, useState } from 'react';

/** Sources whose arrival values may be consumed. */
export enum EntityPreselectionSource {
  Deployment = 'deployment',
  Skill = 'skill',
  Prompt = 'prompt',
}
/** Failure outcomes interpreted by the host. */
export enum EntityPreselectionOutcome {
  DeploymentUnavailable = 'deployment-unavailable',
  DeploymentsLoadFailed = 'deployments-load-failed',
  SkillUnavailable = 'skill-unavailable',
  SkillsLoadFailed = 'skills-load-failed',
  PromptUnavailable = 'prompt-unavailable',
}
/** Parsed arrival values; the controller captures these once per mount. */
export interface EntityPreselectionSnapshot {
  /** Requested deployment identity. */
  deploymentId: string | null;
  /** Requested skill reference. */
  skillId: string | null;
  /** Requested prompt identity. */
  promptId: string | null;
  /** Sources already provided by the host, which take precedence. */
  superseded: readonly EntityPreselectionSource[];
  /** Disables all application, consumption and outcome side effects. */
  isDisabled: boolean;
}
/** Structural prompt passed to the host's composer or parameter popup. */
export interface EntityPreselectionPrompt {
  /** Canonical identity. */
  id: string;
  /** Display name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Prompt content. */
  content: string;
}
/** A resolved skill mention. */
export interface EntityPreselectionSkill {
  /** Canonical reference. */
  url: string;
  /** Resolved display name. */
  name: string;
}
/** Loaded prompt and parameter policy. */
export interface EntityPreselectionPromptResult {
  /** Resolved prompt. */
  prompt: EntityPreselectionPrompt;
  /** Whether the host must ask for parameter values. */
  hasParameters: boolean;
}
/** Host actions for applying resolved entities. */
export interface EntityPreselectionSinks {
  /** Selects a deployment without persisting a preference. */
  restoreSelectedItemId: (id: string) => void;
  /** Inserts a skill mention. */
  selectSkillByUrl: (url: string) => void;
  /** Seeds combined prompt text and skill references. */
  seedSkillMentions: (
    content: string,
    entries: { url: string }[] | undefined,
  ) => void;
  /** Seeds plain prompt text. */
  seedComposerText: (text: string) => void;
  /** Opens a parameterized prompt. */
  openParametersPopup: (prompt: EntityPreselectionPrompt) => void;
}
/** Host listings, loaders and side-effect adapters. */
export interface UseEntityPreselectionOptions {
  /** Parsed arrival snapshot. */
  snapshot: EntityPreselectionSnapshot;
  /** Whether the deployment listing is pending. */
  isDeploymentsLoading: boolean;
  /** Whether deployment loading failed. */
  deploymentsError: unknown;
  /** Looks up an eligible deployment in the current listing. */
  resolveDeployment: (id: string) => { id: string } | undefined;
  /** Whether skill listing is pending. */
  isSkillsLoading: boolean;
  /** Whether skill loading failed. */
  skillsError: unknown;
  /** Whether skills are available in this host. */
  isSkillsEnabled: boolean;
  /** Looks up a valid skill in current listings. */
  resolveSkill: (id: string) => EntityPreselectionSkill | undefined;
  /** Whether prompts are available in this host. */
  isPromptsEnabled: boolean;
  /** Loads and adapts a prompt; undefined means unavailable. */
  loadPrompt: (
    id: string,
    signal: AbortSignal,
  ) => Promise<EntityPreselectionPromptResult | undefined>;
  /** Application sinks, read from the latest committed render. */
  sinks: EntityPreselectionSinks;
  /** Consumes supplied arrival sources, leaving URL/router policy to the host. */
  onConsume: (sources: EntityPreselectionSource[]) => void;
  /** Reports a typed failure, optional host error and original identity. */
  onOutcome: (
    outcome: EntityPreselectionOutcome,
    id: string,
    error?: unknown,
  ) => void;
}
/** Deployment override flags for default-selection coordination. */
export interface UseEntityPreselectionResult {
  /** Pending or successfully applied deployment override. */
  isDeploymentOverrideActive: boolean;
  /** Deployment resolution has not settled yet. */
  isDeploymentPending: boolean;
}
enum Status {
  Idle = 'idle',
  Pending = 'pending',
  Resolved = 'resolved',
  Failed = 'failed',
}

/** Applies arrival entities once, preserving source precedence and ignoring retired work. */
export const useEntityPreselection = (
  options: UseEntityPreselectionOptions,
): UseEntityPreselectionResult => {
  const [snapshot] = useState(options.snapshot);
  const active = (source: EntityPreselectionSource, id: string | null) =>
    !snapshot.isDisabled &&
    id !== null &&
    !snapshot.superseded.includes(source);
  const [deployment, setDeployment] = useState(() =>
    active(EntityPreselectionSource.Deployment, snapshot.deploymentId)
      ? Status.Pending
      : Status.Idle,
  );
  const [skill, setSkill] = useState<{
    status: Status;
    value?: EntityPreselectionSkill;
  }>(() => ({
    status: active(EntityPreselectionSource.Skill, snapshot.skillId)
      ? Status.Pending
      : Status.Idle,
  }));
  const [prompt, setPrompt] = useState<{
    status: Status;
    value?: EntityPreselectionPromptResult;
  }>(() => ({
    status: active(EntityPreselectionSource.Prompt, snapshot.promptId)
      ? Status.Pending
      : Status.Idle,
  }));
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const consumedPrecedence = useRef(false);
  const deploymentResolved = useRef(false);
  const skillResolved = useRef(false);
  const promptResolved = useRef(false);
  const composed = useRef(false);
  useEffect(() => {
    if (snapshot.isDisabled || consumedPrecedence.current) return;
    consumedPrecedence.current = true;
    const ids = {
      [EntityPreselectionSource.Deployment]: snapshot.deploymentId,
      [EntityPreselectionSource.Skill]: snapshot.skillId,
      [EntityPreselectionSource.Prompt]: snapshot.promptId,
    };
    latest.current.onConsume(
      snapshot.superseded.filter((source) => !!ids[source]),
    );
  }, [snapshot]);
  useEffect(() => {
    if (
      deployment !== Status.Pending ||
      options.isDeploymentsLoading ||
      deploymentResolved.current
    )
      return;
    deploymentResolved.current = true;
    const id = snapshot.deploymentId ?? '';
    const current = latest.current;
    const match = current.resolveDeployment(id);
    if (match) {
      current.sinks.restoreSelectedItemId(match.id);
      setDeployment(Status.Resolved);
    } else {
      current.onOutcome(
        current.deploymentsError != null
          ? EntityPreselectionOutcome.DeploymentsLoadFailed
          : EntityPreselectionOutcome.DeploymentUnavailable,
        id,
      );
      setDeployment(Status.Failed);
    }
    current.onConsume([EntityPreselectionSource.Deployment]);
  }, [
    deployment,
    options.isDeploymentsLoading,
    options.deploymentsError,
    options.resolveDeployment,
    snapshot.deploymentId,
  ]);
  useEffect(() => {
    if (
      skill.status !== Status.Pending ||
      options.isSkillsLoading ||
      skillResolved.current
    )
      return;
    skillResolved.current = true;
    const id = snapshot.skillId ?? '';
    const current = latest.current;
    const match = current.isSkillsEnabled
      ? current.resolveSkill(id)
      : undefined;
    if (match) setSkill({ status: Status.Resolved, value: match });
    else {
      current.onOutcome(
        current.isSkillsEnabled && current.skillsError != null
          ? EntityPreselectionOutcome.SkillsLoadFailed
          : EntityPreselectionOutcome.SkillUnavailable,
        id,
      );
      setSkill({ status: Status.Failed });
      current.onConsume([EntityPreselectionSource.Skill]);
    }
  }, [
    skill.status,
    options.isSkillsLoading,
    options.skillsError,
    options.isSkillsEnabled,
    options.resolveSkill,
    snapshot.skillId,
  ]);
  useEffect(() => {
    if (prompt.status !== Status.Pending || promptResolved.current) return;
    const controller = new AbortController();
    const id = snapshot.promptId ?? '';
    const load = async () => {
      let value: EntityPreselectionPromptResult | undefined;
      let failure: unknown;
      try {
        value = options.isPromptsEnabled
          ? await latest.current.loadPrompt(id, controller.signal)
          : undefined;
      } catch (error) {
        failure = error;
      }
      if (controller.signal.aborted) return;
      promptResolved.current = true;
      if (value) setPrompt({ status: Status.Resolved, value });
      else {
        latest.current.onOutcome(
          EntityPreselectionOutcome.PromptUnavailable,
          id,
          failure,
        );
        setPrompt({ status: Status.Failed });
        latest.current.onConsume([EntityPreselectionSource.Prompt]);
      }
    };
    void load();
    return () => controller.abort();
  }, [prompt.status, options.isPromptsEnabled, snapshot.promptId]);
  useEffect(() => {
    if (
      composed.current ||
      skill.status === Status.Pending ||
      prompt.status === Status.Pending
    )
      return;
    if (!skill.value && !prompt.value) return;
    composed.current = true;
    const { sinks, onConsume } = latest.current;
    const resolvedPrompt = prompt.value?.prompt;
    const sources: EntityPreselectionSource[] = [];
    if (skill.value && resolvedPrompt) {
      if (prompt.value?.hasParameters) {
        sinks.selectSkillByUrl(skill.value.url);
        sinks.openParametersPopup(resolvedPrompt);
      } else
        sinks.seedSkillMentions(
          `/${skill.value.name} ${resolvedPrompt.content}`,
          [{ url: skill.value.url }],
        );
      sources.push(
        EntityPreselectionSource.Skill,
        EntityPreselectionSource.Prompt,
      );
    } else if (skill.value) {
      sinks.selectSkillByUrl(skill.value.url);
      sources.push(EntityPreselectionSource.Skill);
    } else if (resolvedPrompt) {
      if (prompt.value?.hasParameters)
        sinks.openParametersPopup(resolvedPrompt);
      else sinks.seedComposerText(resolvedPrompt.content);
      sources.push(EntityPreselectionSource.Prompt);
    }
    onConsume(sources);
  }, [skill, prompt]);
  return {
    isDeploymentOverrideActive:
      deployment === Status.Pending || deployment === Status.Resolved,
    isDeploymentPending: deployment === Status.Pending,
  };
};
