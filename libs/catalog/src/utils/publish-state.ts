import {
  PublishCalloutKind,
  PublishDerivationInput,
  PublishDerivedState,
} from '../models/publish';

/** Derives the callout kind and submit-button state for the publish panel from the current folder context. */
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

  if (input.hasSubmitError) {
    return {
      calloutKind: PublishCalloutKind.SubmitError,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    };
  }

  if (input.hasExistingPublicationInFolder) {
    return {
      calloutKind: PublishCalloutKind.ReplaceWarning,
      isSubmitDisabled: input.allowReplace === false,
      isSubmitLoading: false,
    };
  }

  return {
    calloutKind: PublishCalloutKind.Info,
    isSubmitDisabled: false,
    isSubmitLoading: false,
  };
};
