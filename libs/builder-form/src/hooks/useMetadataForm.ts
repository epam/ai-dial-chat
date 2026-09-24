import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DeploymentCreationFormValues } from '../models/deployment-creation-form';
import { MetadataField } from '../models/metadata-field';
import type {
  UseMetadataFormOptions,
  UseMetadataFormResult,
} from '../models/use-metadata-form';
import type { DeploymentCreationFormErrorCodes } from '../models/validation';
import {
  areMetadataValuesEqual,
  hasNoMetadataErrors,
} from '../utils/metadata-form';
import { validateDeploymentCreationFields } from '../utils/validate-deployment-creation-fields';

interface MetadataFormState {
  reseedKey: string | number | undefined;
  values: DeploymentCreationFormValues;
  baseline: DeploymentCreationFormValues;
  touched: Partial<Record<MetadataField, boolean>>;
  hasAttemptedSubmit: boolean;
}

const createState = (
  values: DeploymentCreationFormValues,
  reseedKey: string | number | undefined,
): MetadataFormState => ({
  reseedKey,
  values,
  baseline: values,
  touched: {},
  hasAttemptedSubmit: false,
});

/**
 * Owns metadata values, touched state, and validation for an entity editor.
 *
 * Every editor used to hand-roll its own rule for when a metadata error shows
 * up (on blur, on submit, always). This hook gives all of them one rule:
 * an error is visible once its field was touched, and every error is visible
 * after a submit attempt. It returns error codes, so translation stays with
 * the host.
 */
export const useMetadataForm = ({
  initialValues,
  validationOptions,
  reseedKey,
}: UseMetadataFormOptions): UseMetadataFormResult => {
  const [state, setState] = useState(() =>
    createState(initialValues, reseedKey),
  );

  // Adjust state during render when the host asks for a re-seed, so edits are never overwritten otherwise.
  if (state.reseedKey !== reseedKey) {
    setState(createState(initialValues, reseedKey));
  }

  const validateNamePattern = validationOptions?.validateNamePattern;
  const validateVersionPattern = validationOptions?.validateVersionPattern;

  const errorCodes = useMemo(
    () =>
      validateDeploymentCreationFields(state.values, {
        validateNamePattern,
        validateVersionPattern,
      }),
    [state.values, validateNamePattern, validateVersionPattern],
  );

  const visibleErrorCodes = useMemo<DeploymentCreationFormErrorCodes>(() => {
    if (state.hasAttemptedSubmit) {
      return errorCodes;
    }

    return {
      name: state.touched[MetadataField.Name] ? errorCodes.name : undefined,
      version: state.touched[MetadataField.Version]
        ? errorCodes.version
        : undefined,
    };
  }, [errorCodes, state.hasAttemptedSubmit, state.touched]);

  // Read by the stable callbacks below, which must not change identity on every edit.
  const errorCodesRef = useRef(errorCodes);
  const initialValuesRef = useRef(initialValues);
  useLayoutEffect(() => {
    errorCodesRef.current = errorCodes;
    initialValuesRef.current = initialValues;
  });

  const setValues = useCallback(
    (patch: Partial<DeploymentCreationFormValues>) =>
      setState((prev) => ({ ...prev, values: { ...prev.values, ...patch } })),
    [],
  );

  const markTouched = useCallback(
    (field: MetadataField) =>
      setState((prev) =>
        prev.touched[field]
          ? prev
          : { ...prev, touched: { ...prev.touched, [field]: true } },
      ),
    [],
  );

  const attemptSubmit = useCallback(() => {
    setState((prev) =>
      prev.hasAttemptedSubmit ? prev : { ...prev, hasAttemptedSubmit: true },
    );
    return hasNoMetadataErrors(errorCodesRef.current);
  }, []);

  const reset = useCallback(
    (values?: DeploymentCreationFormValues) =>
      setState((prev) =>
        createState(values ?? initialValuesRef.current, prev.reseedKey),
      ),
    [],
  );

  const isDirty = useMemo(
    () => !areMetadataValuesEqual(state.values, state.baseline),
    [state.values, state.baseline],
  );

  return useMemo(
    () => ({
      values: state.values,
      setValues,
      touched: state.touched,
      markTouched,
      errorCodes,
      visibleErrorCodes,
      attemptSubmit,
      isDirty,
      reset,
    }),
    [
      state.values,
      setValues,
      state.touched,
      markTouched,
      errorCodes,
      visibleErrorCodes,
      attemptSubmit,
      isDirty,
      reset,
    ],
  );
};
