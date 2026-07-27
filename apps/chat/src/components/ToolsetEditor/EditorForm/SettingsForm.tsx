import React, { useEffect, useMemo } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_TOOLSET_TOOLTIP } from '@/src/constants/toolsets';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ToolsetLinkButton } from '@/src/components/Marketplace/ToolsetLinkButton';
import { AllowedToolsField } from '@/src/components/ToolsetEditor/EditorForm/AllowedToolsField';
import { AuthField } from '@/src/components/ToolsetEditor/EditorForm/AuthField';
import {
  ENDPOINT_PLACEHOLDER,
  ToolsetEditorForm,
} from '@/src/components/ToolsetEditor/form';

import { ToolsetTransportType } from '@epam/ai-dial-shared';

const SelectorField = withLabel(DropdownSelector);
const CopyUrlButton = withLabel(ToolsetLinkButton);

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
        <div className="flex flex-col gap-2">
          {!!title && (
            <h5
              className="text-base font-semibold text-primary"
              data-qa={title
                .toLowerCase()
                .split(' ')
                .join('-')
                .concat('-label')}
            >
              {title}
            </h5>
          )}
          {!!subtitle && (
            <h6
              className="text-sm text-secondary"
              data-qa={title
                ?.toLowerCase()
                .split(' ')
                .join('-')
                .concat('-subtitle')}
            >
              {subtitle}
            </h6>
          )}
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

  const toolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const isLoggedIn = toolset && isToolsetSignedIn(toolset);
  const { register, clearErrors, setValue, control } =
    useFormContext<ToolsetEditorForm>();
  const { errors } = useFormState<ToolsetEditorForm>({ control });
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

  const disabledReason = useMemo(() => {
    if (isToolsetPublic) return PUBLIC_TOOLSET_TOOLTIP;
    if (isLoggedIn) return t(CommonI18nKeys.LogOutBeforeEditingToolset);

    return undefined;
  }, [isLoggedIn, isToolsetPublic, t]);

  return (
    <div
      className="flex size-full grow flex-col space-y-4 divide-y divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 py-4 xl:py-5"
      data-qa="entity-view-form"
    >
      <FormSection
        title={t(CommonI18nKeys.Definition)}
        className="px-3 md:px-5"
      >
        <Field
          {...register('endpoint')}
          label={t(CommonI18nKeys.Endpoint)}
          mandatory
          placeholder={t(CommonI18nKeys.EnterEndpoint)}
          id="endpoint"
          error={errors.endpoint?.message}
          tooltip={disabledReason}
          disabled={!!disabledReason}
        />
        <Controller
          name="protocol"
          control={control}
          render={({ field }) => (
            <SelectorField
              label={t(CommonI18nKeys.TransportProtocol)}
              isSearchable={false}
              isClearable={false}
              value={toOption(field.value)}
              onChange={(option) =>
                field.onChange(
                  (option as unknown as DropdownSelectorOption).value,
                )
              }
              id="protocol"
              options={protocolOptions}
              closeMenuOnSelect
              tooltip={disabledReason}
              isDisabled={!!disabledReason}
            />
          )}
        />
      </FormSection>

      <FormSection
        title={t(CommonI18nKeys.AuthenticationCommon)}
        subtitle={t(CommonI18nKeys.SelectAuthMethod)}
        className="px-3 pt-4 md:px-5"
      >
        <AuthField
          tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          isDisabled={isToolsetPublic}
        />
      </FormSection>

      <FormSection
        title={t(CommonI18nKeys.AllowedTools)}
        className="px-3 pt-4 md:px-5"
      >
        <AllowedToolsField isToolsetPublic={isToolsetPublic} />
      </FormSection>

      <FormSection
        title={t(CommonI18nKeys.ConnectToolset)}
        className="px-3 pt-4 md:px-5"
      >
        <CopyUrlButton
          entity={toolset}
          label={t(CommonI18nKeys.CopyToolsetEndpointURL)}
          id="copy-section"
        />
      </FormSection>
    </div>
  );
};
