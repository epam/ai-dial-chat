/** Field values shared by Quick App and Toolset creation's General step. */
export interface DeploymentCreationFormValues {
  /** Display name of the entity being created. */
  name: string;
  /** Long-form description of the entity. */
  description: string;
  /** Icon URL, entered as a plain URL text field. */
  iconUrl: string;
  /** Version string (e.g. `'1.0.0'`). */
  version: string;
  /** Free-entry topic tags. */
  topics: string[];
  /** Short catalog-friendly summary, limited to `introMaxLength` characters. */
  intro: string;
}

/** Translated, display-ready field errors for the shared form. */
export interface DeploymentCreationFormFieldErrors {
  /** Error message for the name field. */
  name?: string;
  /** Error message for the version field. */
  version?: string;
  /** Error message for the intro field. */
  intro?: string;
}

/** Label and placeholder text for a single field, supplied by the host app. */
export interface DeploymentCreationFormFieldLabels {
  /** Field label text. */
  label: string;
  /** Placeholder text shown when the field is empty. */
  placeholder?: string;
}

/** Pre-translated labels/placeholders for every field, supplied by the host app. */
export interface DeploymentCreationFormLabels {
  /** Labels for the name field. */
  name: DeploymentCreationFormFieldLabels;
  /** Labels for the description field. */
  description: DeploymentCreationFormFieldLabels;
  /** Labels for the icon URL field. */
  iconUrl: DeploymentCreationFormFieldLabels;
  /** Labels for the version field. */
  version: DeploymentCreationFormFieldLabels;
  /** Labels for the topics field. */
  topics: DeploymentCreationFormFieldLabels;
  /** Labels for the intro field. */
  intro: DeploymentCreationFormFieldLabels;
}

/** Optional per-slot class name overrides for visual composition by the host app. */
export interface DeploymentCreationFormClassNames {
  /** Class applied to the root container. Defaults to a vertical flex stack. */
  root?: string;
  /** Class applied to each individual field wrapper. */
  field?: string;
}

/** Props accepted by the `DeploymentCreationForm` component. */
export interface DeploymentCreationFormProps {
  /** Current field values. The component holds no state of its own. */
  values: DeploymentCreationFormValues;
  /** Field-level errors to surface, already translated by the host app. */
  errors: DeploymentCreationFormFieldErrors;
  /** Called with a partial patch whenever a field value changes. */
  onChange: (patch: Partial<DeploymentCreationFormValues>) => void;
  /** Pre-translated labels/placeholders for every field. */
  labels: DeploymentCreationFormLabels;
  /** Maximum character length enforced on the intro field. Defaults to `90`. */
  introMaxLength?: number;
  /** Optional per-slot class name overrides. */
  classNames?: DeploymentCreationFormClassNames;
  /**
   * Accessible name for the field set as a whole, exposed via `role="group"`.
   * Supply the host app's translated section title (e.g. `'General'`).
   */
  ariaLabel?: string;
}
