import { describe, expect, it } from 'vitest';
import { PublishCalloutKind, PublishDerivationInput } from '../models/publish';
import { derivePublishState } from './publish-state';

const baseInput: PublishDerivationInput = {
  hasSelectedFolder: true,
  hasExistingVersionInFolder: false,
  hasWriteAccess: true,
  isSubmitting: false,
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
      derivePublishState({ ...baseInput, hasExistingVersionInFolder: true }),
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
        hasExistingVersionInFolder: true,
      }),
    ).toEqual({
      calloutKind: PublishCalloutKind.NoAccess,
      isSubmitDisabled: true,
      isSubmitLoading: false,
    });
  });
});
