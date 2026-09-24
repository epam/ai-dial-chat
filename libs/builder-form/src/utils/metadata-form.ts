import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormValues,
} from '../models/deployment-creation-form';
import type { DeploymentCreationFormErrorCodes } from '../models/validation';

const areLocaleEntriesEqual = (
  left: DeploymentCreationFormLocaleEntry[],
  right: DeploymentCreationFormLocaleEntry[],
): boolean =>
  left.length === right.length &&
  left.every(
    (entry, index) =>
      entry.id === right[index].id &&
      entry.language === right[index].language &&
      entry.name === right[index].name &&
      entry.description === right[index].description,
  );

/** Returns whether two metadata value sets hold the same field values. */
export const areMetadataValuesEqual = (
  left: DeploymentCreationFormValues,
  right: DeploymentCreationFormValues,
): boolean =>
  left.name === right.name &&
  left.description === right.description &&
  left.iconUrl === right.iconUrl &&
  left.version === right.version &&
  left.topics.length === right.topics.length &&
  left.topics.every((topic, index) => topic === right.topics[index]) &&
  areLocaleEntriesEqual(left.otherLocales, right.otherLocales);

/** Returns whether an error-code set holds no error. */
export const hasNoMetadataErrors = (
  errorCodes: DeploymentCreationFormErrorCodes,
): boolean => Object.values(errorCodes).every((code) => code == null);
