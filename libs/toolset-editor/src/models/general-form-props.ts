import type {
  AvatarPickerFileManagerModalProps,
  AvatarPickerModalLabels,
  DeploymentCreationFormLabels,
  DeploymentCreationFormLocaleOption,
} from '@epam/ai-dial-builder-form';
import type { ComponentType } from 'react';
import type {
  DeploymentGeneralFormData,
  ToolsetFormErrors,
} from './toolset-form';

/**
 * Pre-translated labels for the general (metadata) form. Each group is
 * optional and replaced as a whole; omitting one falls back to the library's
 * English defaults.
 */
export interface GeneralFormLabels {
  /** Labels for the embedded `DeploymentCreationForm` fields. */
  form?: DeploymentCreationFormLabels;
  /** Labels for the avatar picker modal. */
  avatarPicker?: AvatarPickerModalLabels;
}

/** Props of the general (metadata) form shared by the Toolset and Custom App editors. */
export interface GeneralFormProps {
  /** Current general form values. */
  form: DeploymentGeneralFormData;
  /** Field error messages keyed by field name; only `name` and `version` are read. */
  errors: ToolsetFormErrors;
  /** Storage bucket whose files the avatar picker browses. */
  bucket: string;
  /** Host file-manager modal rendered inside the avatar picker. */
  FileManagerModal: ComponentType<AvatarPickerFileManagerModalProps>;
  /** Resolves an icon URL into the previewable URL the form renders. */
  resolveIconUrl: (url: string) => string;
  /** MIME types the avatar picker accepts. */
  allowedMimeTypes: string[];
  /** Maximum avatar file size in bytes. */
  maxFileSizeBytes: number;
  /** Locale options offered by the "Add locale" popup. */
  availableLocaleOptions: DeploymentCreationFormLocaleOption[];
  /** Called with the changed subset of general form values. */
  onChange: (patch: Partial<DeploymentGeneralFormData>) => void;
  /** Called when the Name field loses focus. */
  onNameBlur?: () => void;
  /** Called when the Version field loses focus. */
  onVersionBlur?: () => void;
  /** Pre-translated labels; each group falls back to English defaults. */
  labels?: GeneralFormLabels;
}
