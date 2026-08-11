/** One additional (non-primary) locale's name/description translation, edited via the "Add locale" popup. */
export interface DeploymentCreationFormLocaleEntry {
  /** Stable client-side id for list rendering; not part of the persisted locale map. */
  id: string;
  /** Locale code this entry translates into (e.g. `'de'`). */
  language: string;
  /** Translated name for this locale. */
  name: string;
  /** Translated description for this locale. */
  description: string;
}

/** A selectable language option for an additional-locale row. */
export interface DeploymentCreationFormLocaleOption {
  /** Locale code (e.g. `'de'`). */
  code: string;
  /** Display label for the option (e.g. `'DE'`). */
  label: string;
}

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
  /** Additional (non-primary) locale entries for name/description, edited via the "Add locale" popup. */
  otherLocales: DeploymentCreationFormLocaleEntry[];
}

/** Translated, display-ready field errors for the shared form. */
export interface DeploymentCreationFormFieldErrors {
  /** Error message for the name field. */
  name?: string;
  /** Error message for the version field. */
  version?: string;
}

/** Label and placeholder text for a single field, supplied by the host app. */
export interface DeploymentCreationFormFieldLabels {
  /** Field label text. */
  label: string;
  /** Placeholder text shown when the field is empty. */
  placeholder?: string;
}

/** Pre-translated labels/placeholders for the "Add locale" summary row and popup, supplied by the host app. */
export interface DeploymentCreationFormLocaleLabels {
  /** Text preceding the list of configured locale codes, e.g. `'Locales'`. */
  summaryLabel: string;
  /** Label for the link that opens the "Add locale" popup. */
  editLabel: string;
  /** Title of the "Add locale" popup. */
  popupTitle: string;
  /** Label for the button that adds a new locale row. */
  addLocaleLabel: string;
  /** Label prefix for each row's heading (e.g. `'Locale'` -> `'Locale 1'`). Defaults to `'Locale'`. */
  localeRowLabel?: string;
  /** Label for the language select field. */
  languageLabel: string;
  /** Label for the per-locale name field. */
  nameLabel: string;
  /** Placeholder for the per-locale name field. */
  namePlaceholder?: string;
  /** Label for the per-locale description field. */
  descriptionLabel: string;
  /** Placeholder for the per-locale description field. */
  descriptionPlaceholder?: string;
  /** Accessible name for a row's delete button. */
  deleteAriaLabel: string;
  /** Label for the popup's cancel button. */
  cancelLabel?: string;
  /** Label for the popup's save button. */
  saveLabel?: string;
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
  /** Labels for the additional-locales summary row and popup. */
  otherLocales: DeploymentCreationFormLocaleLabels;
  /** Accessible name for the field set group. */
  ariaLabel?: string;
}

/** Optional per-slot class name overrides for visual composition by the host app. */
export interface DeploymentCreationFormStyles {
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
  /** Optional per-slot class name overrides. */
  styles?: DeploymentCreationFormStyles;
  /** Selectable language options for additional-locale rows. Defaults to an empty list (no locales addable). */
  availableLocaleOptions?: DeploymentCreationFormLocaleOption[];
}
