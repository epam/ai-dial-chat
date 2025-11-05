import { useEffect } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { PUBLIC_TOOLSET_TOOLTIP } from '@/src/constants/toolsets';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { AuthField } from '@/src/components/ToolsetEditor/EditorForm/AuthField';
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

interface FormSectionProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

const FormSection = ({
  children,
  className,
  title,
  subtitle,
}: FormSectionProps) => {
  return (
    <div className={classNames('flex flex-col gap-4', className)}>
      {(!!title || !!subtitle) && (
        <div>
          {!!title && (
            <h5 className="text-base font-semibold text-primary">{title}</h5>
          )}
          {!!subtitle && <h6 className="text-sm text-secondary">{subtitle}</h6>}
        </div>
      )}
      {children}
    </div>
  );
};

interface SettingsFormProps {
  isToolsetPublic: boolean;
}

export const SettingsForm = ({ isToolsetPublic }: SettingsFormProps) => {
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
    <div className="flex size-full grow flex-col space-y-4 divide-y divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5">
      <FormSection title={t('Definition')}>
        <Field
          {...register('endpoint')}
          label={t('Endpoint')}
          mandatory
          placeholder={t('Enter endpoint')}
          id="endpoint"
          error={errors.endpoint?.message}
          tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          disabled={isToolsetPublic}
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
              tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
              isDisabled={isToolsetPublic}
            />
          )}
        />
      </FormSection>

      <FormSection
        title={t('Authentication')}
        subtitle={t(
          'Select one of the methods below that will be used to authenticate',
        )}
        className="pt-4"
      >
        <AuthField
          tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          isDisabled={isToolsetPublic}
        />
      </FormSection>

      <FormSection
        title={t('Allowed tools')}
        subtitle={t(
          'The list of tools will be available after filling in the definition and authentication section',
        )}
        className="pt-4"
      >
        <Controller
          name="allowedTools"
          control={control}
          render={({ field }) => (
            <ComboBoxField
              initialSelectedItems={field.value}
              getItemLabel={getComboBoxLabel}
              getItemValue={getComboBoxLabel}
              onChangeSelectedItems={field.onChange}
              placeholder={t('Enter one or more tools')}
              id="allowedTools"
              disabled={isToolsetPublic}
              className={classNames(
                'input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full',
                isToolsetPublic && 'hover:border-primary',
              )}
              hasDeleteAll
              hideSuggestions
              itemHeightClassName="h-[31px]"
              tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
            />
          )}
        />
      </FormSection>
    </div>
  );
};
