import { FC, useMemo } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { doesModelAllowTemperature } from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, ModelsSelectors } from '@/src/store/selectors';

import {
  CONFIRM_DOCUMENT_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { AgentsAndToolsetsField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/AgentsAndToolsetsField';
import { CodeInterpreterField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/CodeInterpreterField';
import {
  QuickApp2Form as QuickApp2FormType,
  getAttachmentTypeErrorHandlers,
} from '@/src/components/AppsEditor/form';
import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);

const getItemLabel = (item: unknown): string => item as string;

interface AppsEditorProps {
  onAutoSave: () => void;
}

export const QuickApp2Form: FC<AppsEditorProps> = ({ onAutoSave }) => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolSupportingModels = useAppSelector(
    ModelsSelectors.selectToolSupportingModels,
  );

  const { control, register, setError, clearErrors } =
    useFormContext<QuickApp2FormType>();
  const { errors } = useFormState<QuickApp2FormType>({ control });

  const modelId = useWatch({
    control,
    name: 'model',
  });

  const showTemperatureSlider = useMemo(() => {
    const selectedModel = modelsMap[modelId];
    return selectedModel ? doesModelAllowTemperature(selectedModel) : true;
  }, [modelId, modelsMap]);

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  return (
    <div
      className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5"
      data-qa="entity-view-form"
    >
      <Controller
        name="documentRelativeUrl"
        control={control}
        render={({ field }) => (
          <FilesSelectorField
            label={t(MarketplaceI18nKeys.DocumentRelativeURLs)}
            onAddFiles={(documents) =>
              field.onChange(uniq([...(field.value ?? []), ...documents]))
            }
            onRemoveFile={(document) =>
              field.onChange(field.value?.filter((field) => field !== document))
            }
            readonly={isSharedWithMe || isAppPublic}
            error={errors.documentRelativeUrl?.message}
            fileManagerTitle={t(MarketplaceI18nKeys.SelectDocuments)}
            files={field.value ?? []}
            addBtnTooltip={
              isSharedWithMe
                ? getSharedTooltip(t(MarketplaceI18nKeys.DocumentsLowercase))
                : undefined
            }
            confirmDialogValues={
              appDetails?.isShared ? CONFIRM_DOCUMENT_VALUES : undefined
            }
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
          />
        )}
      />

      <Controller
        name="model"
        control={control}
        render={({ field }) => (
          <ModelsSelectorField
            label={t(MarketplaceI18nKeys.ModelMarketplace)}
            value={field.value}
            onChange={field.onChange}
            mandatory
            error={errors.model?.message}
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
            models={toolSupportingModels}
          />
        )}
      />

      <AgentsAndToolsetsField onAutoSave={onAutoSave} />

      <FieldTextArea
        {...register('instructions')}
        label={t(MarketplaceI18nKeys.InstructionsMarketplace)}
        placeholder={t(MarketplaceI18nKeys.InstructionsPlaceholder)}
        rows={4}
        id="instructions"
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
              'input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full',
              isAppPublic && 'hover:border-primary',
            )}
            hasDeleteAll
            hideSuggestions
            itemHeightClassName="h-[31px]"
            error={errors.inputAttachmentTypes?.message}
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
            dataQa={'attachment-types-field'}
            {...getAttachmentTypeErrorHandlers(setError, clearErrors)}
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
        dataQa={'max-attachment-number-field'}
      />

      <CodeInterpreterField />

      {showTemperatureSlider && (
        <Controller
          name="temperature"
          control={control}
          render={({ field }) => (
            <Slider
              label={t(MarketplaceI18nKeys.TemperatureMarketplace)}
              temperature={field.value}
              disabled={isAppPublic}
              tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
              onChangeTemperature={field.onChange}
            />
          )}
        />
      )}
    </div>
  );
};
