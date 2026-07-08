import {
  PublishCalloutKind,
  PublishDerivationInput,
  PublishDerivedState,
} from '../models/publish';

/**
 * Derives the publish panel's callout and submit-button state from the
 * current destination-folder context. Priority (highest first): a request
 * in flight, no folder selected yet, missing write access, replacing an
 * existing version, then the default informational callout.
 */
export const derivePublishState = (
  input: PublishDerivationInput,
): PublishDerivedState => {
  if (input.isSubmitting) {
    return {
      calloutKind: PublishCalloutKind.None,
      isSubmitDisabled: true,
      isSubmitLoading: true,
    };
  }

  if (!input.hasSelectedFolder) {
    return {
      calloutKind: PublishCalloutKind.None,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    };
  }

  if (!input.hasWriteAccess) {
    return {
      calloutKind: PublishCalloutKind.NoAccess,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    };
  }

  if (input.hasExistingVersionInFolder) {
    return {
      calloutKind: PublishCalloutKind.ReplaceWarning,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    };
  }

  return {
    calloutKind: PublishCalloutKind.Info,
    isSubmitDisabled: false,
    isSubmitLoading: false,
  };
};
