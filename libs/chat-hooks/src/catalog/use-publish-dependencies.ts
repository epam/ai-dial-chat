import type { PublishDependency } from '@epam/ai-dial-publish-panel';
import { useEffect, useRef, useState } from 'react';

const EMPTY_DEPENDENCIES: PublishDependency[] = [];

/** Host inputs of {@link usePublishDependencies}. */
export interface UsePublishDependenciesOptions {
  /** Whether the publish panel is open; the dependencies are read each time it opens. */
  isOpen: boolean;
  /** Id of the entity being published; a change reads its dependencies again. */
  entityId: string;
  /** Reads the entity's private dependencies, already mapped to the panel's model; the host owns the request. */
  loadDependencies: (entityId: string) => Promise<PublishDependency[]>;
}

interface LoadedDependencies {
  /** The entity the dependencies belong to. */
  entityId: string;
  /** Its private dependencies. */
  dependencies: PublishDependency[];
}

/**
 * Returns the private dependencies of an entity for a publish panel, read again
 * on every open so a dependency published since the last one drops off the
 * list. The list is advisory: a failed read leaves it empty, a read that
 * finishes after the panel closed or the entity changed is ignored, and another
 * entity's list is never returned.
 */
export const usePublishDependencies = ({
  isOpen,
  entityId,
  loadDependencies,
}: UsePublishDependenciesOptions): PublishDependency[] => {
  const [loaded, setLoaded] = useState<LoadedDependencies | undefined>();
  /* The host may pass a new function each render; only an open or an entity change reads. */
  const loadDependenciesRef = useRef(loadDependencies);
  useEffect(() => {
    loadDependenciesRef.current = loadDependencies;
  }, [loadDependencies]);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    const load = async () => {
      let dependencies = EMPTY_DEPENDENCIES;
      try {
        dependencies = await loadDependenciesRef.current(entityId);
      } catch {
        /* Left empty: the list only informs, publishing does not depend on it. */
      }
      if (!isCancelled) setLoaded({ entityId, dependencies });
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, entityId]);

  return loaded?.entityId === entityId
    ? loaded.dependencies
    : EMPTY_DEPENDENCIES;
};
