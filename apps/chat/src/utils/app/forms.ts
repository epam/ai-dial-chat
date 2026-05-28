import { KeyboardEvent, RefObject } from 'react';
import {
  FieldErrors,
  FieldValues,
  Path,
  UseFormGetFieldState,
} from 'react-hook-form';

import classNames from 'classnames';

import { getResourceMaxSegmentBytes } from '@/src/utils/app/resource-limits';

import { MIN_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import {
  formErrors,
  urlErrors,
  versionsErrors,
} from '@/src/constants/form-errors';

import {
  doesHaveDotsInTheEnd,
  getUtf8BytesLength,
  isVersionPartSizeValid,
  isVersionValid,
} from './common';
import { doesHaveNotAllowedSymbols } from './file';

export type InputElement = HTMLInputElement | HTMLTextAreaElement;
export const checkValidity = (
  inputsRefs: RefObject<InputElement | null>[],
): boolean => {
  let isValid = true;
  let focusableElement: InputElement | null = null;

  for (const ref of inputsRefs) {
    if (!ref || !ref.current) return false;
    const current = ref.current;

    const isEmpty =
      !current.value ||
      (current.value === 'on' && !(current as HTMLInputElement).checked);

    if (current.required && isEmpty) {
      current.focus();
      current.blur();
      isValid = false;

      if (!focusableElement) {
        focusableElement = current;
        break;
      }
    }
  }

  focusableElement?.focus();

  return isValid;
};

export const getFieldClassnames = <T extends FieldValues>(
  fieldName: keyof T,
  fieldType: 'input',
  formState: {
    errors: FieldErrors<T>;
    dirtyFields: Partial<Record<keyof T, unknown>>;
    touchedFields: Partial<Record<keyof T, unknown>>;
  },
) => {
  return classNames(fieldType, {
    invalid: formState.errors[fieldName],
    dirty: formState.dirtyFields[fieldName],
    touched: formState.touchedFields[fieldName],
  });
};

export const FormValidations = {
  checkUrl: (v: string | undefined): boolean | string => {
    if (!v) {
      return urlErrors.notValidUrl;
    }

    try {
      new URL(v);
      return true;
    } catch {
      return urlErrors.notValidUrl;
    }
  },
  notEmpty: (v: string | undefined): boolean | string => {
    return !!v && v.length ? true : formErrors.required;
  },
};

export const getValidFormFields = <T extends object>(
  data: T,
  getFieldState: UseFormGetFieldState<T>,
): Partial<T> => {
  const validValues: Partial<T> = {};

  Object.keys(data).forEach((key) => {
    if (!getFieldState(key as Path<T>).invalid) {
      validValues[key as keyof T] = data[key as keyof T];
    }
  });

  return validValues;
};

export const getStringValidationErrors = ({
  value,
  label,
  checkDotsInTheEnd,
  maxBytes,
  minLength = MIN_ENTITY_LENGTH,
  isNotUniqName,
  buildNameForByteValidation,
}: {
  value: string;
  label: string;
  maxBytes?: number;
  minLength?: number;
  checkDotsInTheEnd?: boolean;
  isNotUniqName?: boolean;
  buildNameForByteValidation?: (preparedName: string) => string;
}) => {
  const resolvedMaxBytes = maxBytes ?? getResourceMaxSegmentBytes();
  const errors: string[] = [];
  const trimmedValue = value.trim();
  if (!trimmedValue) errors.push(formErrors.required);

  if (trimmedValue.length > 0 && trimmedValue.length < minLength)
    errors.push(formErrors.tooShort(label));
  if (
    getUtf8BytesLength(
      buildNameForByteValidation?.(trimmedValue) ?? trimmedValue,
    ) > resolvedMaxBytes
  ) {
    errors.push(formErrors.tooLong(label));
  }

  if (doesHaveNotAllowedSymbols(trimmedValue)) {
    errors.push(formErrors.hasSpecialCharacters(label));
  }

  if (checkDotsInTheEnd && doesHaveDotsInTheEnd(trimmedValue)) {
    errors.push(formErrors.noDotInTheEnd(label));
  }

  if (isNotUniqName) {
    errors.push(formErrors.notUniqName(label, value));
  }

  return errors;
};

export const getVersionValidationErrors = (
  version: string | undefined,
  versionExists?: boolean,
  checkPartLength?: boolean,
) => {
  const errors: string[] = [];
  if (!version || !version.trim()) return [versionsErrors.required];

  if (versionExists) errors.push(versionsErrors.versionExists);

  const trimmedVersion = version.trim();

  if (!isVersionValid(trimmedVersion)) errors.push(versionsErrors.notValid);

  if (checkPartLength && !isVersionPartSizeValid(trimmedVersion)) {
    errors.push(versionsErrors.tooLongPart);
  }

  return errors;
};

export const preventEnterDown = (e: KeyboardEvent<HTMLFormElement>) => {
  if (
    e.key !== 'Enter' ||
    !e.target ||
    (e.target as HTMLElement).tagName !== 'INPUT'
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
};
