import React, { useEffect } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { usePreventSpaceHandlers } from '@/src/hooks/usePreventSpaceHandlers';
import { useTranslation } from '@/src/hooks/useTranslation';

import { doesAgentSupportMcp } from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/applications';
import { CommonI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';

import {
  CustomAppForm as CustomAppFormType,
  MANDATORY_FIELD_PLACEHOLDER,
  getPendingAttachmentTypeProps,
} from '@/src/components/AppsEditor/form';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { ToolsetLinkButton } from '@/src/components/Marketplace/ToolsetLinkButton';

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);
const CopyUrlButton = withLabel(ToolsetLinkButton);

const getItemLabel = (item: unknown): string => item as string;

export const CustomAppForm = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const { control, register, clearErrors, setValue } =
    useFormContext<CustomAppFormType>();
  const { errors } = useFormState<CustomAppFormType>({ control });
  const completionUrl = useWatch({
    name: 'completionUrl',
    control,
  });
  const pendingAttachmentType = useWatch({
    name: 'pendingInputAttachmentType',
    control,
  });

  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const { onBeforeInput, onInput, onKeyDownOrPaste } =
    usePreventSpaceHandlers();

  useEffect(() => {
    if (completionUrl === MANDATORY_FIELD_PLACEHOLDER) {
      setValue('completionUrl', '', { shouldDirty: false, shouldTouch: false });
      clearErrors('completionUrl');
    }
  }, [clearErrors, completionUrl, setValue]);

  return (
    <div
      className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5"
      data-qa="entity-view-form"
    >
      <FieldTextArea
        {...register('features')}
        label={t(MarketplaceI18nKeys.FeaturesData)}
        info={t(MarketplaceI18nKeys.FeaturesDataInfo)}
        placeholder={`{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`}
        id="features"
        rows={4}
        data-qa="features-data"
        error={errors.features?.message}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <Controller
        name="inputAttachmentTypes"
        control={control}
        render={({ field }) => (
          <ComboBoxField
            label={t(MarketplaceI18nKeys.AttachmentTypes)}
            info={t(MarketplaceI18nKeys.InputMIMEType)}
            initialSelectedItems={field.value}
            getItemLabel={getItemLabel}
            getItemValue={getItemLabel}
            onChangeSelectedItems={field.onChange}
            placeholder={t(MarketplaceI18nKeys.EnterAttachmentTypes)}
            id="attachmentTypes"
            className={classNames(
              'input-form input-invalid peer mx-0 flex items-start py-1 ps-0 md:max-w-full',
              isAppPublic && 'hover:border-primary',
            )}
            hasDeleteAll
            hideSuggestions
            itemHeightClassName="h-[31px]"
            error={errors.inputAttachmentTypes?.message}
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
            dataQa="combobox"
            {...getPendingAttachmentTypeProps(pendingAttachmentType, setValue)}
          />
        )}
      />

      <ControlledField
        label={t(MarketplaceI18nKeys.MaxAttachmentsNumber)}
        placeholder={t(MarketplaceI18nKeys.EnterMaxAttachments)}
        id="maxInputAttachments"
        error={errors.maxInputAttachments?.message}
        control={control}
        name="maxInputAttachments"
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
        dataQa="max-attachment-number-field"
      />

      <Field
        {...register('completionUrl')}
        label={t(MarketplaceI18nKeys.ChatCompletionURL)}
        mandatory
        placeholder={t(MarketplaceI18nKeys.TypeChatCompletionURL)}
        id="completionUrl"
        error={errors.completionUrl?.message}
        data-qa="completion-url"
        onBeforeInput={onBeforeInput}
        onInput={onInput}
        onKeyDown={onKeyDownOrPaste}
        onPaste={onKeyDownOrPaste}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      {doesAgentSupportMcp(appDetails) && (
        <CopyUrlButton
          entity={appDetails}
          label={t(CommonI18nKeys.CopyApplicationEndpointURL)}
        />
      )}
    </div>
  );
};
