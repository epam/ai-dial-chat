import type { DeploymentCreationFormValues } from './deployment-creation-form';
import type { MetadataField } from './metadata-field';
import type {
  DeploymentCreationFormErrorCodes,
  DeploymentCreationFormValidationOptions,
} from './validation';

/** Options accepted by `useMetadataForm`. */
export interface UseMetadataFormOptions {
  /** Values the form starts from; applied once per `reseedKey`. */
  initialValues: DeploymentCreationFormValues;
  /** Pattern checks passed to `validateDeploymentCreationFields`. Defaults to none. */
  validationOptions?: DeploymentCreationFormValidationOptions;
  /** Changing this re-seeds the form from `initialValues` and clears touched state. */
  reseedKey?: string | number;
}

/** State and actions returned by `useMetadataForm`. */
export interface UseMetadataFormResult {
  /** Current metadata values. */
  values: DeploymentCreationFormValues;
  /** Merges a partial patch into `values`. */
  setValues: (patch: Partial<DeploymentCreationFormValues>) => void;
  /** Fields the user has left (blurred) at least once. */
  touched: Partial<Record<MetadataField, boolean>>;
  /** Marks one field as touched so its error becomes visible. */
  markTouched: (field: MetadataField) => void;
  /** Every validation error for the current values, visible or not. */
  errorCodes: DeploymentCreationFormErrorCodes;
  /** Errors for touched fields only, or for every field after `attemptSubmit`. */
  visibleErrorCodes: DeploymentCreationFormErrorCodes;
  /** Makes every error visible and returns whether the values are valid. */
  attemptSubmit: () => boolean;
  /** Whether `values` differ from the last seeded or reset values. */
  isDirty: boolean;
  /** Replaces the values and the dirty baseline, and clears touched state. Defaults to the current `initialValues`. */
  reset: (values?: DeploymentCreationFormValues) => void;
}
