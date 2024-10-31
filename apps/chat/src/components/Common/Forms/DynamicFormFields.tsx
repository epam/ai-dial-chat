import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMemo } from 'react';
import {
  Control,
  FieldArray,
  FieldArrayPath,
  FieldError,
  FieldErrorsImpl,
  FieldValues,
  Merge,
  Path,
  RegisterOptions,
  UseFormRegister,
  useFieldArray,
} from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { SelectOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { FieldErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';

export interface DynamicField extends SelectOption<string, string> {
  editableKey?: boolean;
  static?: boolean;
  visibleName?: string;
}

const mapField = (field: unknown): DynamicField => field as DynamicField;

interface DynamicFieldsProps<
  T extends FieldValues,
  K extends FieldArrayPath<T>,
> {
  creatable?: boolean;
  options?: SelectOption<string, string>[];
  addLabel?: string;
  keyLabel?: string;
  valueLabel?: string;
  errors?: Merge<
    FieldError,
    (Merge<FieldError, FieldErrorsImpl<DynamicField>> | undefined)[]
  >;
  keyOptions?: RegisterOptions<T, Path<T>>;
  valueOptions?: RegisterOptions<T, Path<T>>;

  control: Control<T>;
  register: UseFormRegister<T>;
  name: K;
}

export const DynamicFormFields = <
  T extends FieldValues,
  K extends FieldArrayPath<T>,
>({
  options,
  errors,
  addLabel,
  control,
  register,
  name,
  creatable,
  keyOptions,
  valueOptions,
  keyLabel = 'Name',
  valueLabel = 'Value',
}: DynamicFieldsProps<T, K>) => {
  const { t } = useTranslation(Translation.Chat);

  const { fields, append, remove } = useFieldArray<T, typeof name, 'id'>({
    control,
    name,
  });

  const handleAdd = (option?: SelectOption<string, string>) => {
    append({
      label: option?.value ?? '',
      value: '',
      editableKey: !option,
      visibleName: option?.label,
    } as FieldArray<T, K>);
  };

  const filteredOptions = useMemo(() => {
    const selectedOptions = fields.map((f) => mapField(f).label.toLowerCase());

    return (options ?? []).filter(
      ({ value }) => !selectedOptions.includes(value.toLowerCase()),
    );
  }, [options, fields]);

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, i) => (
        <div
          key={field.id}
          className="flex gap-3 rounded border border-tertiary bg-layer-3 px-3 py-2"
        >
          {!mapField(field).editableKey ? (
            <div className="w-[127px] px-2 py-1 text-sm text-primary">
              {mapField(field).visibleName ?? mapField(field).label}
            </div>
          ) : (
            <div className="w-[127px]">
              <input
                {...register(`${name}.${i}.label` as Path<T>, keyOptions)}
                className={classNames(
                  'w-full border-b border-primary bg-transparent px-2 py-1 text-sm text-primary placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none',
                  errors?.[i]?.label && '!border-error',
                )}
                placeholder={`Enter ${keyLabel?.toLowerCase()}`}
              />
              <FieldErrorMessage
                className="!mb-0"
                error={errors?.[i]?.label?.message}
              />
            </div>
          )}

          <div className="grow">
            <input
              {...register(`${name}.${i}.value` as Path<T>, valueOptions)}
              className={classNames(
                'w-full border-b border-primary bg-transparent px-2 py-1 text-sm text-primary placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none',
                errors?.[i]?.value && '!border-error',
              )}
              placeholder={`Enter ${valueLabel?.toLowerCase()}`}
            />
            <FieldErrorMessage
              className="!mb-0"
              error={errors?.[i]?.value?.message}
            />
          </div>

          <button
            type="button"
            disabled={mapField(field).static}
            className={classNames(
              'flex items-start rounded border border-transparent pt-1 text-secondary outline-none hover:text-error',
              mapField(field).static && 'invisible',
            )}
            onClick={() => remove(i)}
          >
            <IconTrash size={18} />
          </button>
        </div>
      ))}

      {(filteredOptions.length || creatable) && (
        <Menu
          className="max-w-[150px]"
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 rounded text-accent-primary"
              onClick={
                !filteredOptions.length && creatable
                  ? () => handleAdd()
                  : undefined
              }
            >
              <IconPlus size={18} />

              {t(addLabel ?? 'Add')}
            </button>
          }
        >
          <div className="w-full bg-layer-3">
            {filteredOptions.map((option) => (
              <MenuItem
                key={option.value}
                className="max-w-full text-xs hover:bg-accent-primary-alpha"
                item={option.label}
                value={option.value}
                onClick={() => handleAdd(option)}
              />
            ))}
          </div>
        </Menu>
      )}
    </div>
  );
};
