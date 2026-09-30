import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DeploymentCreationFormValues } from '../../models/deployment-creation-form';
import { MetadataField } from '../../models/metadata-field';
import type { UseMetadataFormOptions } from '../../models/use-metadata-form';
import { DeploymentCreationFieldErrorCode } from '../../models/validation';
import { SEMVER_VERSION_PATTERN } from '../../utils/validate-deployment-creation-fields';
import { useMetadataForm } from '../useMetadataForm';

const emptyValues: DeploymentCreationFormValues = {
  name: '',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const renderMetadataForm = (options?: Partial<UseMetadataFormOptions>) =>
  renderHook((props: UseMetadataFormOptions) => useMetadataForm(props), {
    initialProps: { initialValues: emptyValues, ...options },
  });

describe('useMetadataForm', () => {
  it('keeps an error hidden until its field is touched', () => {
    const { result } = renderMetadataForm();

    expect(result.current.errorCodes.name).toBe(
      DeploymentCreationFieldErrorCode.Required,
    );
    expect(result.current.visibleErrorCodes.name).toBeUndefined();

    act(() => result.current.markTouched(MetadataField.Name));

    expect(result.current.visibleErrorCodes.name).toBe(
      DeploymentCreationFieldErrorCode.Required,
    );
  });

  it('shows every error after a failed submit attempt', () => {
    const { result } = renderMetadataForm({
      initialValues: { ...emptyValues, version: 'beta' },
      validationOptions: { validateVersionPattern: SEMVER_VERSION_PATTERN },
    });

    let isValid = true;
    act(() => {
      isValid = result.current.attemptSubmit();
    });

    expect(isValid).toBe(false);
    expect(result.current.visibleErrorCodes).toEqual({
      name: DeploymentCreationFieldErrorCode.Required,
      version: DeploymentCreationFieldErrorCode.InvalidFormat,
    });
  });

  it('reports a valid submit attempt once the values pass validation', () => {
    const { result } = renderMetadataForm();

    act(() => result.current.setValues({ name: 'My app' }));

    let isValid = false;
    act(() => {
      isValid = result.current.attemptSubmit();
    });

    expect(isValid).toBe(true);
  });

  it('keeps edits when the host re-renders with new initial values and the same reseed key', () => {
    const { result, rerender } = renderMetadataForm({ reseedKey: 'app-1' });

    act(() => result.current.setValues({ name: 'Typed name' }));
    rerender({
      initialValues: { ...emptyValues, name: 'Server name' },
      reseedKey: 'app-1',
    });

    expect(result.current.values.name).toBe('Typed name');
  });

  it('re-seeds from the initial values when the reseed key changes', () => {
    const { result, rerender } = renderMetadataForm({ reseedKey: 'app-1' });

    act(() => {
      result.current.setValues({ name: 'Typed name' });
      result.current.markTouched(MetadataField.Name);
    });
    rerender({
      initialValues: { ...emptyValues, name: 'Other app' },
      reseedKey: 'app-2',
    });

    expect(result.current.values.name).toBe('Other app');
    expect(result.current.touched).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it('flags a non-semver version only when the semver pattern is configured', () => {
    const { result: looseResult } = renderMetadataForm({
      initialValues: { ...emptyValues, name: 'App', version: '1.0-beta' },
      validationOptions: { validateVersionPattern: true },
    });
    const { result: strictResult } = renderMetadataForm({
      initialValues: { ...emptyValues, name: 'App', version: '1.0-beta' },
      validationOptions: { validateVersionPattern: SEMVER_VERSION_PATTERN },
    });

    expect(looseResult.current.errorCodes.version).toBeUndefined();
    expect(strictResult.current.errorCodes.version).toBe(
      DeploymentCreationFieldErrorCode.InvalidFormat,
    );
  });

  it('tracks whether the values differ from the seeded ones and clears it on reset', () => {
    const { result } = renderMetadataForm();

    act(() => result.current.setValues({ topics: ['search'] }));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.setValues({ topics: [] }));
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.setValues({ name: 'Saved' }));
    act(() => result.current.reset({ ...emptyValues, name: 'Saved' }));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.values.name).toBe('Saved');
  });

  it('keeps callback identities stable across edits', () => {
    const { result } = renderMetadataForm();
    const { setValues, markTouched, attemptSubmit, reset } = result.current;

    act(() => result.current.setValues({ name: 'Edited' }));
    act(() => result.current.markTouched(MetadataField.Version));

    expect(result.current.setValues).toBe(setValues);
    expect(result.current.markTouched).toBe(markTouched);
    expect(result.current.attemptSubmit).toBe(attemptSubmit);
    expect(result.current.reset).toBe(reset);
  });

  it('counts every submit attempt, valid or not', () => {
    const { result } = renderMetadataForm();
    expect(result.current.submitAttemptCount).toBe(0);

    act(() => {
      result.current.attemptSubmit();
    });
    act(() => {
      result.current.attemptSubmit();
    });

    expect(result.current.submitAttemptCount).toBe(2);
  });
});
