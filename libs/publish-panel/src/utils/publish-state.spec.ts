import { describe, expect, it } from 'vitest';
import { PublishCalloutKind, PublishDerivationInput } from '../models/publish';
import { derivePublishState } from './publish-state';

const baseInput: PublishDerivationInput = {
  hasSelectedFolder: true,
  hasExistingPublicationInFolder: false,
  hasWriteAccess: true,
  isSubmitting: false,
  hasSubmitError: false,
};

describe('derivePublishState', () => {
  it('shows the info callout and an enabled submit button for a fresh folder', () => {
    expect(derivePublishState(baseInput)).toEqual({
      calloutKind: PublishCalloutKind.Info,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    });
  });

  it('disables submit with no callout when no folder is selected', () => {
    expect(
      derivePublishState({ ...baseInput, hasSelectedFolder: false }),
    ).toEqual({
      calloutKind: PublishCalloutKind.None,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    });
  });

  it('shows the no-access callout and disables submit without write access', () => {
    expect(derivePublishState({ ...baseInput, hasWriteAccess: false })).toEqual(
      {
        calloutKind: PublishCalloutKind.NoAccess,
        isSubmitDisabled: true,
        isSubmitLoading: false,
      },
    );
  });

  it('shows the replace-warning callout but keeps submit enabled when the version already exists', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasExistingPublicationInFolder: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.ReplaceWarning,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    });
  });

  it('hides any callout and shows the loading submit state while submitting', () => {
    expect(derivePublishState({ ...baseInput, isSubmitting: true })).toEqual({
      calloutKind: PublishCalloutKind.None,
      isSubmitDisabled: true,
      isSubmitLoading: true,
    });
  });

  it('prioritizes the in-flight state over a missing write access', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasWriteAccess: false,
        isSubmitting: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.None,
      isSubmitDisabled: true,
      isSubmitLoading: true,
    });
  });

  it('prioritizes missing write access over an existing version in the folder', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasWriteAccess: false,
        hasExistingPublicationInFolder: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.NoAccess,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    });
  });

  it('shows the submit-error callout but keeps submit enabled after a failed attempt', () => {
    expect(derivePublishState({ ...baseInput, hasSubmitError: true })).toEqual({
      calloutKind: PublishCalloutKind.SubmitError,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    });
  });

  it('prioritizes a submit error over an existing version in the folder', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasSubmitError: true,
        hasExistingPublicationInFolder: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.SubmitError,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    });
  });

  it('prioritizes missing write access over a submit error', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasWriteAccess: false,
        hasSubmitError: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.NoAccess,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    });
  });

  it('disables submit for an existing publication when allowReplace is false (conversations)', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasExistingPublicationInFolder: true,
        allowReplace: false,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.ReplaceWarning,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    });
  });

  it('keeps submit enabled for an existing publication when allowReplace is omitted (catalog default)', () => {
    expect(
      derivePublishState({
        ...baseInput,
        hasExistingPublicationInFolder: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.ReplaceWarning,
      isSubmitDisabled: false,
      isSubmitLoading: false,
    });
  });
});
