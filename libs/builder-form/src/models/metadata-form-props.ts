import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { ComponentType } from 'react';
import type {
  AvatarPickerFileManagerModalProps,
  AvatarPickerModalLabels,
} from './avatar-picker-modal';
import type {
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLabels,
  DeploymentCreationFormLocaleOption,
  DeploymentCreationFormValues,
} from './deployment-creation-form';
import type { MetadataField } from './metadata-field';

/**
 * Pre-translated labels for `MetadataForm`. Each group is optional and
 * replaced as a whole; omitting one falls back to the library's English defaults.
 */
export interface MetadataFormLabels {
  /** Labels for the embedded `DeploymentCreationForm` fields. */
  form?: DeploymentCreationFormLabels;
  /** Labels for the avatar picker modal. */
  avatarPicker?: AvatarPickerModalLabels;
}

/** Host-supplied wiring for the avatar picker; every value is resolved by the host. */
export interface MetadataFormAvatarPicker {
  /** Storage bucket whose files the avatar picker browses. */
  bucket: string;
  /** Host file-manager modal rendered inside the avatar picker. */
  FileManagerModal: ComponentType<AvatarPickerFileManagerModalProps>;
  /** Resolves the current icon value into the previewable URL the form renders. */
  resolveIconUrl: (url: string) => string;
  /** Returns the icon value to store for a picked file, or `undefined` to leave the icon unchanged. */
  resolveAttachedIconUrl: (result: AttachResult) => string | undefined;
  /** MIME types the avatar picker accepts. */
  allowedMimeTypes: string[];
  /** Maximum avatar file size in bytes. */
  maxFileSizeBytes: number;
}

/** Props of `MetadataForm`. */
export interface MetadataFormProps {
  /** Current metadata values. The component holds no field state of its own. */
  values: DeploymentCreationFormValues;
  /** Field error messages, already translated by the host. */
  errors: DeploymentCreationFormFieldErrors;
  /** Called with the changed subset of metadata values. */
  onChange: (patch: Partial<DeploymentCreationFormValues>) => void;
  /** Called when the Name field loses focus. */
  onNameBlur?: () => void;
  /** Called when the Version field loses focus. */
  onVersionBlur?: () => void;
  /** Avatar picker wiring. The Avatar field renders only when this is set and `fields` includes `Avatar`. */
  avatarPicker?: MetadataFormAvatarPicker;
  /** Locale options offered by the "Add locale" popup. Defaults to an empty list. */
  availableLocaleOptions?: DeploymentCreationFormLocaleOption[];
  /** Fields to render, in fixed order. Defaults to every field. */
  fields?: readonly MetadataField[];
  /** Renders the Name field read-only. Defaults to `false`. */
  isNameReadOnly?: boolean;
  /** Helper text rendered under the Name field. */
  nameCaption?: string;
  /** Marks the Description field as required. Defaults to `false`. */
  isDescriptionRequired?: boolean;
  /** Changes on every submit attempt to move focus to the first invalid field; see `DeploymentCreationFormProps.focusRequestKey`. */
  focusRequestKey?: number;
  /** Pre-translated labels; each group falls back to English defaults. */
  labels?: MetadataFormLabels;
}
