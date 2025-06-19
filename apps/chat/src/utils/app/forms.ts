import { RefObject } from 'react';
import {
  FieldErrors,
  FieldValues,
  Path,
  UseFormGetFieldState,
} from 'react-hook-form';

import classNames from 'classnames';

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { formErrors } from '@/src/constants/form-errors';

import { doesHaveDotsInTheEnd } from './common';
import { doesHaveNotAllowedSymbols, notAllowedSpacesRegex } from './file';

export type InputElement = HTMLInputElement | HTMLTextAreaElement;
export const checkValidity = (
  inputsRefs: RefObject<InputElement>[],
): boolean => {
  let isValid = true;
  let focusableElement: InputElement | null = null;

  for (const { current } of inputsRefs) {
    if (!current) return false;

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
      return formErrors.notValidUrl;
    }

    try {
      new URL(v);
      return true;
    } catch (e) {
      return formErrors.notValidUrl;
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

export const validateStringField = ({
  valueToValidate,
  maxLength = MAX_ENTITY_LENGTH,
  minLength = 2,
  checkDotsInTheEnd,
}: {
  valueToValidate: string;
  maxLength?: number;
  minLength?: number;
  checkDotsInTheEnd?: boolean;
}) => {
  const trimmedValue = valueToValidate
    .trim()
    .replace(notAllowedSpacesRegex, ' ');

  return (
    trimmedValue.length <= maxLength &&
    trimmedValue.length >= minLength &&
    !doesHaveNotAllowedSymbols(trimmedValue) &&
    (!checkDotsInTheEnd || !doesHaveDotsInTheEnd(trimmedValue))
  );
};
