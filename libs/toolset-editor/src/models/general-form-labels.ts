import type {
  AvatarPickerModalLabels,
  DeploymentCreationFormLabels,
} from '@epam/ai-dial-builder-form';

/**
 * Pre-translated labels for the general (metadata) form. Each group is
 * optional and replaced as a whole; omitting one falls back to the library's
 * English defaults.
 * @deprecated Use `MetadataFormLabels` from `@epam/ai-dial-builder-form`.
 */
export interface GeneralFormLabels {
  /** Labels for the embedded `DeploymentCreationForm` fields. */
  form?: DeploymentCreationFormLabels;
  /** Labels for the avatar picker modal. */
  avatarPicker?: AvatarPickerModalLabels;
}
