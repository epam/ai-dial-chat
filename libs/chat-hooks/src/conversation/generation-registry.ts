/** Lifecycle of a tracked client generation. */
export enum ClientGenerationStatus {
  Active = 'active',
  Done = 'done',
}

/** A generation tracked under an opaque conversation path. */
export interface GenerationEntry {
  /** Caller-provided generation identity. */
  generationId: string;
  /** Exact conversation path. */
  path: string;
  /** Controller cancelled when an active generation is replaced. */
  abortController: AbortController;
  /** Current lifecycle state. */
  status: ClientGenerationStatus;
}

/** Instance-owned registry; it has no automatic teardown or persistence. */
export interface GenerationRegistry {
  /** Starts a generation, aborting the prior active entry on this path. */
  startGeneration: (path: string, generationId: string) => AbortController;
  /** Completes the entry only if its generation identity still matches. */
  completeGeneration: (path: string, generationId: string) => void;
  /** Returns the entry for the exact path. */
  getGeneration: (path: string) => GenerationEntry | undefined;
  /** Whether any tracked generation is active. */
  hasActiveGeneration: () => boolean;
}

/** Creates an independent generation registry with stable operations. */
export const createGenerationRegistry = (): GenerationRegistry => {
  const entries = new Map<string, GenerationEntry>();
  return {
    startGeneration: (path, generationId) => {
      const existing = entries.get(path);
      if (existing?.status === ClientGenerationStatus.Active) {
        existing.abortController.abort();
      }
      const abortController = new AbortController();
      entries.set(path, {
        path,
        generationId,
        abortController,
        status: ClientGenerationStatus.Active,
      });
      return abortController;
    },
    completeGeneration: (path, generationId) => {
      const entry = entries.get(path);
      if (entry?.generationId === generationId) {
        entries.set(path, { ...entry, status: ClientGenerationStatus.Done });
      }
    },
    getGeneration: (path) => entries.get(path),
    hasActiveGeneration: () => {
      for (const entry of entries.values()) {
        if (entry.status === ClientGenerationStatus.Active) return true;
      }
      return false;
    },
  };
};
