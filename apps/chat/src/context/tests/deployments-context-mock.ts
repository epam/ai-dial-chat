import type { DeploymentsContextType } from '../DeploymentsContext';

/** Builds a full `useDeployments()` value for tests, defaulting to an empty/idle state. */
export const createDeploymentsContextValue = (
  overrides: Partial<DeploymentsContextType> = {},
): DeploymentsContextType => ({
  items: [],
  selectedItemId: null,
  setSelectedItemId: () => undefined,
  restoreSelectedItemId: () => undefined,
  restoreDefaultSelection: () => undefined,
  selectedDeploymentConfiguration: null,
  selectedDeploymentDetails: null,
  isDeploymentDetailsLoading: false,
  isLoading: false,
  error: null,
  schemas: [],
  toolsets: [],
  refetchToolsets: async () => undefined,
  refetchDeployments: async () => undefined,
  mergeSharedItem: () => undefined,
  ...overrides,
});
