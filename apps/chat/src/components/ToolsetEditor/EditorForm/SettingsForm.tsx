import { useEffect } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import {
  ENDPOINT_PLACEHOLDER,
  ToolsetEditorForm,
} from '@/src/components/ToolsetEditor/form';

import { ToolsetTransportType } from '@epam/ai-dial-shared';

const SelectorField = withLabel(DropdownSelector);
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));

const getComboBoxLabel = (item: unknown): string => item as string;

const protocolOptions = [
  { label: ToolsetTransportType.SSE, value: ToolsetTransportType.SSE },
  { label: ToolsetTransportType.HTTP, value: ToolsetTransportType.HTTP },
];
const toOption = (s: string) => ({
  label: s,
  value: s,
});

export const SettingsForm = () => {
  const { t } = useTranslation(Translation.Common);

  const {
    register,
    formState: { errors },
    clearErrors,
    setValue,
    control,
  } = useFormContext<ToolsetEditorForm>();
  const endpointField = useWatch<ToolsetEditorForm>({
    name: 'endpoint',
    control,
  });

  useEffect(() => {
    if (endpointField === ENDPOINT_PLACEHOLDER) {
      setValue('endpoint', '');
      clearErrors('endpoint');
    }
  }, [clearErrors, endpointField, setValue]);

  return (
    <div className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5">
      <Field
        {...register('endpoint')}
        label={t('Endpoint')}
        mandatory
        placeholder={t('Enter endpoint')}
        id="endpoint"
        error={errors.endpoint?.message}
      />
      <Controller
        name="protocol"
        control={control}
        render={({ field }) => (
          <SelectorField
            label={t('Transport protocol')}
            isSearchable={false}
            isClearable={false}
            value={toOption(field.value)}
            onChange={(option) =>
              field.onChange(
                (option as unknown as DropdownSelectorOption).value,
              )
            }
            mandatory
            id="protocol"
            options={protocolOptions}
            closeMenuOnSelect
          />
        )}
      />
      <Controller
        name="allowedTools"
        control={control}
        render={({ field }) => (
          <ComboBoxField
            label={t('Allowed tools')}
            initialSelectedItems={field.value}
            getItemLabel={getComboBoxLabel}
            getItemValue={getComboBoxLabel}
            onChangeSelectedItems={field.onChange}
            placeholder={t('Enter one or more tools')}
            id="allowedTools"
            className="input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full"
            hasDeleteAll
            hideSuggestions
            itemHeightClassName="h-[31px]"
          />
        )}
      />
    </div>
  );
};
