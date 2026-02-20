import { IconPlus } from '@tabler/icons-react';
import { useMemo } from 'react';
import {
  FieldArrayPath,
  FieldError,
  FieldErrorsImpl,
  FieldValues,
  Merge,
  Path,
  PathValue,
  RegisterOptions,
  useFormContext,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { SelectOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { FieldErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { CloseButtonSmall } from '../CloseButtons';

import { DialButton } from '@epam/ai-dial-ui-kit';
import { nanoid } from 'nanoid';

export interface DynamicField extends SelectOption<string, string> {
  editableKey?: boolean;
  static?: boolean;
  visibleName?: string;
  id: string;
}

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
  disabled?: boolean;
  tooltip?: string;

  name: K;
}

export const DynamicFormFields = <
  T extends FieldValues,
  K extends FieldArrayPath<T>,
>({
  options,
  errors,
  addLabel,
  name,
  creatable,
  keyOptions,
  valueOptions,
  disabled,
  tooltip,
  keyLabel = 'Name',
  valueLabel = 'Value',
}: DynamicFieldsProps<T, K>) => {
  const { t } = useTranslation(Translation.Chat);
  const { register, control, setValue } = useFormContext<T>();

  const fields = useWatch({
    control,
    name: name as Path<T>,
  }) as DynamicField[];

  const handleAdd = (option?: SelectOption<string, string>) => {
    setValue(
      name as Path<T>,
      [
        ...fields,
        {
          label: option?.value ?? '',
          value: option?.defaultValue ?? '',
          editableKey: !option,
          visibleName: option?.label,
          id: nanoid(),
        },
      ] as PathValue<T, Path<T>>,
      { shouldDirty: true, shouldTouch: true },
    );
  };

  const handleRemove = (index: number) => {
    setValue(
      name as Path<T>,
      fields.filter((_, i) => i !== index) as PathValue<T, Path<T>>,
      { shouldDirty: true, shouldTouch: true },
    );
  };

  const filteredOptions = useMemo(() => {
    const selectedOptions = fields.map((f) => f.label.toLowerCase());

    return (options ?? []).filter(
      ({ value }) => !selectedOptions.includes(value.toLowerCase()),
    );
  }, [options, fields]);

  return (
    <Tooltip triggerClassName="w-full" tooltip={tooltip}>
      <div className="flex flex-col gap-2">
        {fields.map((field, i) => (
          <div
            key={field.id}
            className="flex w-full flex-wrap items-center gap-3 rounded border border-tertiary bg-layer-3 p-[11px] md:flex-nowrap md:py-[7px]"
          >
            <div className="flex grow flex-col gap-2 md:flex-row md:items-center md:gap-3">
              {!field.editableKey ? (
                <div className="w-full px-2 py-[5px] text-sm text-primary md:w-[127px] md:shrink-0 md:py-1">
                  {field.visibleName ?? field.label}
                </div>
              ) : (
                <div className="w-full md:w-[127px] md:shrink-0">
                  <input
                    {...register(`${name}.${i}.label` as Path<T>, keyOptions)}
                    disabled={disabled}
                    className={classNames(
                      'w-full border-b border-primary bg-transparent px-2 pb-[4px] pt-[5px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none md:py-1',
                      errors?.[i]?.label && '!border-error',
                      disabled
                        ? 'cursor-not-allowed'
                        : 'hover:border-accent-primary',
                    )}
                    placeholder={`Enter ${keyLabel?.toLowerCase()}`}
                  />
                  <FieldErrorMessage
                    className="!mb-0"
                    error={errors?.[i]?.label?.message}
                  />
                </div>
              )}

              <div className="w-full grow">
                <input
                  {...register(`${name}.${i}.value` as Path<T>, valueOptions)}
                  disabled={disabled}
                  className={classNames(
                    'w-full border-b border-primary bg-transparent px-2 pb-[4px] pt-[5px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none md:py-1',
                    errors?.[i]?.value && '!border-error',
                    disabled
                      ? 'cursor-not-allowed'
                      : 'hover:border-accent-primary',
                  )}
                  placeholder={`Enter ${valueLabel?.toLowerCase()}`}
                />
                <FieldErrorMessage
                  className="!mb-0"
                  error={errors?.[i]?.value?.message}
                />
              </div>
            </div>

            <CloseButtonSmall
              disabled={field.static || disabled}
              className={classNames(field.static && 'invisible')}
              onClick={() => handleRemove(i)}
            />
          </div>
        ))}

        {(filteredOptions.length || creatable) && (
          <Menu
            isTriggerEnabled={!disabled}
            className="max-w-[150px]"
            trigger={
              <DialButton
                className={classNames('flex items-center text-accent-primary')}
                onClick={
                  !filteredOptions.length && creatable
                    ? () => handleAdd()
                    : undefined
                }
                iconBefore={<IconPlus size={18} />}
                label={t(addLabel ?? 'Add')}
              />
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
    </Tooltip>
  );
};
