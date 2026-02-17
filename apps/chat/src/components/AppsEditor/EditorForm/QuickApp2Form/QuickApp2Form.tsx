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
  const modelTypeAgents = useAppSelector(ModelsSelectors.selectModelTypeAgents);

  const toolSupportingModels = useMemo(
    () => modelTypeAgents.filter((model) => model.features?.tools),
    [modelTypeAgents],
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
            label={t('Document relative URLs')}
            onAddFiles={(documents) =>
              field.onChange(uniq([...(field.value ?? []), ...documents]))
            }
            onRemoveFile={(document) =>
              field.onChange(field.value?.filter((field) => field !== document))
            }
            readonly={isSharedWithMe || isAppPublic}
            error={errors.documentRelativeUrl?.message}
            fileManagerTitle={t('Select documents')}
            files={field.value ?? []}
            addBtnTooltip={
              isSharedWithMe ? getSharedTooltip(t('documents')) : undefined
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
            label={t('Model')}
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
        label={t('Instructions')}
        placeholder={t('Instructions of your application')}
        rows={4}
        className="resize-none"
        id="instructions"
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <Controller
        name="inputAttachmentTypes"
        control={control}
        render={({ field }) => (
          <ComboBoxField
            label={t('Attachment types')}
            info={t("Input the MIME type and press 'Enter' to add")}
            initialSelectedItems={field.value}
            getItemLabel={getItemLabel}
            getItemValue={getItemLabel}
            onChangeSelectedItems={field.onChange}
            placeholder={t('Enter one or more attachment types')}
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
        label={t('Max. attachments number')}
        placeholder={t('Enter the maximum number of attachments')}
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
              label={t('Temperature')}
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
