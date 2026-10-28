import {
  CatalogCreationType,
  type CatalogCreationPermissionsDto,
} from '@epam/ai-dial-chat-api-client';
import { useSyncExternalStore } from 'react';
import { UserConfigStatus } from '../../types/user-config-status';

interface CatalogCreationState {
  catalogCreationStatus: UserConfigStatus;
  catalogCreationPermissions: CatalogCreationPermissionsDto | null;
}

const ALLOW_ALL = (): CatalogCreationState => ({
  catalogCreationStatus: UserConfigStatus.Ready,
  catalogCreationPermissions: {
    allowedTypes: Object.values(CatalogCreationType),
    restrictedSchemaIds: [],
  },
});

/*
 * Creation state for specs whose `AppConfigContext` mock is a plain factory.
 * Read it through `useCatalogCreationState()` inside the mocked
 * `useAppConfig`, so changing it re-renders consumers the way the real
 * context does:
 *
 *   vi.mock('<relative>/context/AppConfigContext', async () => {
 *     const { useCatalogCreationState } = await import(
 *       '<relative>/context/tests/catalog-creation-state'
 *     );
 *     return {
 *       useAppConfig: () => ({ ...useCatalogCreationState(), config: {} }),
 *     };
 *   });
 *
 * The module is a singleton, so the factory and the spec share one state.
 * Call `resetCatalogCreationState()` in `beforeEach`, and wrap a change made
 * after rendering in `act`.
 */
let state: CatalogCreationState = ALLOW_ALL();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const update = (next: CatalogCreationState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** The current creation state, re-rendering the caller when it changes. */
export const useCatalogCreationState = (): CatalogCreationState =>
  useSyncExternalStore(subscribe, () => state);

/** Restores the default: every creation type allowed, no restricted schema. */
export const resetCatalogCreationState = (): void => {
  update(ALLOW_ALL());
};

/** Sets the permissions a spec runs with, ready unless a status is given. */
export const setCatalogCreationState = (
  catalogCreationPermissions: CatalogCreationPermissionsDto | null,
  catalogCreationStatus: UserConfigStatus = UserConfigStatus.Ready,
): void => {
  update({ catalogCreationStatus, catalogCreationPermissions });
};
