import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EntityPreselectionOutcome as Outcome,
  EntityPreselectionSource as Source,
  useEntityPreselection,
  type UseEntityPreselectionOptions,
} from '../useEntityPreselection';

const options = (): UseEntityPreselectionOptions => ({
  snapshot: {
    deploymentId: 'model',
    skillId: 'skill',
    promptId: 'prompt',
    superseded: [],
    isDisabled: false,
  },
  isDeploymentsLoading: false,
  deploymentsError: undefined,
  resolveDeployment: vi.fn(() => ({ id: 'canonical-model' })),
  isSkillsLoading: false,
  skillsError: undefined,
  isSkillsEnabled: true,
  resolveSkill: vi.fn(() => ({ url: 'canonical-skill', name: 'Skill' })),
  isPromptsEnabled: true,
  loadPrompt: vi.fn().mockResolvedValue({
    prompt: { id: 'prompt', name: 'Prompt', content: 'Text' },
    hasParameters: false,
  }),
  sinks: {
    restoreSelectedItemId: vi.fn(),
    selectSkillByUrl: vi.fn(),
    seedSkillMentions: vi.fn(),
    seedComposerText: vi.fn(),
    openParametersPopup: vi.fn(),
  },
  onConsume: vi.fn(),
  onOutcome: vi.fn(),
});

describe('useEntityPreselection', () => {
  it('waits for listings and combines resolved sources exactly once', async () => {
    const value = options();
    const { result, rerender } = renderHook(
      ({ loading }) =>
        useEntityPreselection({
          ...value,
          isDeploymentsLoading: loading,
          isSkillsLoading: loading,
        }),
      { initialProps: { loading: true } },
    );
    expect(result.current.isDeploymentPending).toBe(true);
    expect(value.sinks.seedSkillMentions).not.toHaveBeenCalled();
    rerender({ loading: false });
    await waitFor(() =>
      expect(value.sinks.seedSkillMentions).toHaveBeenCalledWith(
        '/Skill Text',
        [{ url: 'canonical-skill' }],
      ),
    );
    expect(result.current.isDeploymentOverrideActive).toBe(true);
    expect(result.current.isDeploymentPending).toBe(false);
    rerender({ loading: false });
    expect(value.sinks.seedSkillMentions).toHaveBeenCalledTimes(1);
  });

  it('honors supplied source precedence and handles prompt parameters', async () => {
    const value = options();
    value.snapshot.superseded = [Source.Deployment, Source.Skill];
    value.loadPrompt = vi.fn().mockResolvedValue({
      prompt: { id: 'prompt', name: 'Prompt', content: '{{value}}' },
      hasParameters: true,
    });
    const { result } = renderHook(() => useEntityPreselection(value));
    await waitFor(() =>
      expect(value.sinks.openParametersPopup).toHaveBeenCalledTimes(1),
    );
    expect(value.sinks.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(value.sinks.selectSkillByUrl).not.toHaveBeenCalled();
    expect(value.onConsume).toHaveBeenCalledWith([
      Source.Deployment,
      Source.Skill,
    ]);
    expect(result.current.isDeploymentOverrideActive).toBe(false);
  });

  it('has no side effects in disabled mode', async () => {
    const value = options();
    value.snapshot.isDisabled = true;
    renderHook(() => useEntityPreselection(value));
    await act(async () => undefined);
    expect(value.loadPrompt).not.toHaveBeenCalled();
    expect(value.onConsume).not.toHaveBeenCalled();
    expect(value.onOutcome).not.toHaveBeenCalled();
  });

  it.each([undefined, new Error('listing')])(
    'settles unknown sources with typed outcomes (%s)',
    async (error) => {
      const value = options();
      value.resolveDeployment = () => undefined;
      value.resolveSkill = () => undefined;
      value.deploymentsError = error;
      value.skillsError = error;
      value.loadPrompt = vi.fn().mockRejectedValue(new Error('prompt'));
      const { result, rerender } = renderHook(() =>
        useEntityPreselection(value),
      );
      await waitFor(() => expect(value.onOutcome).toHaveBeenCalledTimes(3));
      expect(value.onOutcome).toHaveBeenCalledWith(
        error ? Outcome.DeploymentsLoadFailed : Outcome.DeploymentUnavailable,
        'model',
      );
      expect(value.onOutcome).toHaveBeenCalledWith(
        error ? Outcome.SkillsLoadFailed : Outcome.SkillUnavailable,
        'skill',
      );
      expect(result.current.isDeploymentOverrideActive).toBe(false);
      rerender();
      expect(value.onOutcome).toHaveBeenCalledTimes(3);
    },
  );

  it('aborts and ignores prompt completion after unmount', async () => {
    const value = options();
    let finish!: (result: undefined) => void;
    let signal!: AbortSignal;
    value.loadPrompt = (_id, abort) => {
      signal = abort;
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    const { unmount } = renderHook(() => useEntityPreselection(value));
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(undefined));
    expect(value.onOutcome).not.toHaveBeenCalled();
    expect(value.sinks.seedSkillMentions).not.toHaveBeenCalled();
  });

  it('reports and consumes a disabled prompt once in StrictMode', () => {
    const value = options();
    value.snapshot.deploymentId = null;
    value.snapshot.skillId = null;
    value.isPromptsEnabled = false;
    const onConsume = vi.fn();
    value.onConsume = onConsume;

    const { rerender } = renderHook(() => useEntityPreselection(value), {
      reactStrictMode: true,
    });
    rerender();

    expect(value.loadPrompt).not.toHaveBeenCalled();
    expect(value.onOutcome).toHaveBeenCalledExactlyOnceWith(
      Outcome.PromptUnavailable,
      'prompt',
      undefined,
    );
    expect(
      onConsume.mock.calls.filter(([sources]) =>
        sources.includes(Source.Prompt),
      ),
    ).toHaveLength(1);
  });

  it('still resolves an asynchronous prompt after StrictMode effect replay', async () => {
    const value = options();
    value.snapshot.deploymentId = null;
    value.snapshot.skillId = null;
    renderHook(() => useEntityPreselection(value), { reactStrictMode: true });

    await waitFor(() =>
      expect(value.sinks.seedComposerText).toHaveBeenCalledExactlyOnceWith(
        'Text',
      ),
    );
    expect(value.onOutcome).not.toHaveBeenCalled();
  });
});
