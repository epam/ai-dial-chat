import { useCallback, useEffect, useRef, useState } from 'react';

/** Initial values for {@link useComposerSeed}. */
export interface UseComposerSeedInitial {
  /** Text the composer starts with. */
  text?: string;
  /** Revision paired with the initial text. Defaults to `0`. */
  revision?: number;
}

/** Return value of the {@link useComposerSeed} hook. */
export interface UseComposerSeedResult {
  /** Text to pass as the composer's `message` prop. */
  message: string | undefined;
  /** Revision to pass as the composer's `messageRevision` prop. */
  messageRevision: number;
  /** Replaces the composer text and bumps `messageRevision`. */
  seedMessage: (text: string) => void;
}

/**
 * Holds the one `message`/`messageRevision` pair a composer component
 * accepts, with an imperative `seedMessage` for one-shot writes (a picked
 * starter, route state). Pair with {@link useComposerSeedSource} for each
 * additional externally revision-tracked source (e.g. a skill-mention hook's
 * own message push) that should also seed the composer.
 */
export const useComposerSeed = (
  initial?: UseComposerSeedInitial,
): UseComposerSeedResult => {
  const [seed, setSeed] = useState<{ text: string | undefined; revision: number }>(
    { text: initial?.text, revision: initial?.revision ?? 0 },
  );

  const seedMessage = useCallback((text: string) => {
    setSeed((prev) => ({ text, revision: prev.revision + 1 }));
  }, []);

  return { message: seed.text, messageRevision: seed.revision, seedMessage };
};

/**
 * Calls `onChange` whenever `revision` changes from its previous value,
 * skipping the first render. Used to fold an externally revision-tracked
 * source (e.g. a skill-mention hook's `message`/`messageRevision` push) into
 * a {@link useComposerSeed} instance via its `seedMessage`.
 */
export const useComposerSeedSource = (
  revision: number | undefined,
  onChange: () => void,
): void => {
  const lastRevisionRef = useRef(revision);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (revision === lastRevisionRef.current) return;
    lastRevisionRef.current = revision;
    onChangeRef.current();
  }, [revision]);
};
