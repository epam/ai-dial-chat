import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Asynchronous rewriting callback supplied by the consuming host. */
export type TextRefinementCallback = (
  value: string,
  signal: AbortSignal,
) => Promise<string>;

/** Field-local refinement feedback state. */
export enum TextRefinementState {
  Idle = 'idle',
  Pending = 'pending',
  Success = 'success',
  Error = 'error',
  Restored = 'restored',
  Unchanged = 'unchanged',
}

/** Controlled value and lifecycle inputs for one refinable field. */
export interface UseTextRefinementOptions {
  /** Current controlled field value. */
  value: string;
  /** Host rewriting callback. Omission disables refinement and clears its state. */
  onRefine?: TextRefinementCallback;
  /** Publishes a successful result or the original Undo baseline. */
  onChange: (value: string) => void;
  /** Disables refinement and cancels active work when true. Defaults to false. */
  disabled?: boolean;
  /** Draft identity; changing it resets state even when text is equal. */
  resetKey?: unknown;
}

/** Controls and feedback for a single field. */
export interface TextRefinementResult {
  /** Current field-local feedback state. */
  state: TextRefinementState;
  /** Whether this field has a request in progress. */
  isPending: boolean;
  /** Whether the current value can be refined. */
  canRefine: boolean;
  /** Whether an original baseline can be restored. */
  canUndo: boolean;
  /** Refines the latest committed value; duplicate activation is ignored. */
  refine: () => Promise<void>;
  /** Restores the baseline from before the first successful refinement. */
  undo: () => void;
  /** Cancels work and clears feedback and Undo without modifying the value. */
  reset: () => void;
}

/** Preserves an author's draft and Undo baseline across asynchronous controlled updates. */
export const useTextRefinement = (
  options: UseTextRefinementOptions,
): TextRefinementResult => {
  const [state, setState] = useState(TextRefinementState.Idle);
  const [canUndo, setCanUndo] = useState(false);
  const latest = useRef(options);
  const mounted = useRef(false);
  const lifecycle = useRef({
    value: options.value,
    resetKey: options.resetKey,
    generation: 0,
    controller: undefined as AbortController | undefined,
    baseline: undefined as string | undefined,
    expected: undefined as string | undefined,
  });

  const invalidate = useCallback(() => {
    const current = lifecycle.current;
    current.generation++;
    current.controller?.abort();
    current.controller = undefined;
    current.baseline = undefined;
    current.expected = undefined;
  }, []);

  const reset = useCallback(() => {
    invalidate();
    if (mounted.current) {
      setState(TextRefinementState.Idle);
      setCanUndo(false);
    }
  }, [invalidate]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidate();
    };
  }, [invalidate]);

  useLayoutEffect(() => {
    const previous = latest.current;
    const current = lifecycle.current;
    latest.current = options;
    const changed = current.value !== options.value;
    const acknowledged = changed && current.expected === options.value;
    if (
      current.resetKey !== options.resetKey ||
      (previous.onRefine && !options.onRefine) ||
      (!previous.disabled && options.disabled) ||
      (changed && !acknowledged)
    ) {
      reset();
    } else if (acknowledged) {
      current.expected = undefined;
    }
    current.value = options.value;
    current.resetKey = options.resetKey;
  });

  const refine = useCallback(async () => {
    const input = latest.current;
    const current = lifecycle.current;
    if (
      !mounted.current ||
      !input.onRefine ||
      input.disabled ||
      !input.value.trim() ||
      current.controller ||
      current.expected !== undefined
    )
      return;
    const controller = new AbortController();
    current.controller = controller;
    const generation = ++current.generation;
    const original = input.value;
    const isCurrent = () =>
      mounted.current &&
      generation === current.generation &&
      !controller.signal.aborted &&
      latest.current.value === original;
    setState(TextRefinementState.Pending);
    try {
      const text = await input.onRefine(original, controller.signal);
      if (!isCurrent()) return;
      if (typeof text !== 'string' || !text.trim())
        throw new Error('Empty refinement');
      if (text === original) {
        setState(TextRefinementState.Unchanged);
        return;
      }
      current.baseline ??= original;
      current.expected = text;
      setCanUndo(true);
      setState(TextRefinementState.Success);
      latest.current.onChange(text);
    } catch (error) {
      if (!isCurrent()) return;
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        setState(TextRefinementState.Idle);
      } else {
        setState(TextRefinementState.Error);
      }
    } finally {
      if (generation === current.generation) current.controller = undefined;
    }
  }, []);

  const undo = useCallback(() => {
    const current = lifecycle.current;
    if (
      !mounted.current ||
      latest.current.disabled ||
      current.controller ||
      current.baseline === undefined
    )
      return;
    const original = current.baseline;
    current.baseline = undefined;
    current.expected = original;
    setCanUndo(false);
    setState(TextRefinementState.Restored);
    latest.current.onChange(original);
  }, []);

  return {
    state,
    isPending: state === TextRefinementState.Pending,
    canRefine: Boolean(
      options.onRefine &&
      !options.disabled &&
      options.value.trim() &&
      state !== TextRefinementState.Pending,
    ),
    canUndo,
    refine,
    undo,
    reset,
  };
};
