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
import {
  ApplicationSelectors,
  ModelsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import {
  CONFIRM_DOCUMENT_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';

import { FormCollapsibleSection } from '@/src/components/AppsEditor/EditorForm/FormCollapsibleSection';
import { AgentsAndToolsetsField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/AgentsAndToolsetsField';
import { CodeInterpreterField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/CodeInterpreterField';
import { ConversationStartersList } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/ConversationStartersField';
import { StartersBehaviourRadioGroup } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/StartersBehaviourRadioGroup';
import {
  QuickApp2Form as QuickApp2FormType,
  getAttachmentTypeErrorHandlers,
} from '@/src/components/AppsEditor/form';
import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { EditorThemes } from '@/src/components/Common/MarkdownEditor/MarkdownEditor';
import { DialMarkdownEditorContainer } from '@/src/components/Common/MarkdownEditor/MarkdownEditorContainer';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';

import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);
const StartersBehaviourField = withLabel(StartersBehaviourRadioGroup);
const ConversationStartersField = withLabel(ConversationStartersList);
const ToggleSwitchField = withLabel(ToggleSwitch);

const getItemLabel = (item: unknown): string => item as string;

interface AppsEditorProps {
  onAutoSave: () => void;
}

export const QuickApp2Form: FC<AppsEditorProps> = ({ onAutoSave }) => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const theme = useAppSelector(UISelectors.selectThemeState);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolSupportingModels = useAppSelector(
    ModelsSelectors.selectToolSupportingModels,
  );

  const { control, setError, clearErrors } =
    useFormContext<QuickApp2FormType>();
  const { errors } = useFormState<QuickApp2FormType>({ control });

  const modelId = useWatch({ control, name: 'model' });

  const showTemperatureSlider = useMemo(() => {
    const selectedModel = modelsMap[modelId];
    return selectedModel ? doesModelAllowTemperature(selectedModel) : true;
  }, [modelId, modelsMap]);

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);
  const isAppPublicTooltip = isAppPublic ? PUBLIC_APP_TOOLTIP : '';

  return (
    <div
      className="flex size-full grow flex-col divide-y divide-tertiary overflow-hidden overflow-y-auto bg-layer-2"
      data-qa="entity-view-form"
    >
      <FormCollapsibleSection
        name={t('Orchestrator')}
        openByDefault
        dataQa="orchestrator-section"
      >
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
              tooltip={isAppPublicTooltip}
              models={toolSupportingModels}
            />
          )}
        />

        {showTemperatureSlider && (
          <div className="w-full max-w-[500px]">
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <Slider
                  label={t('Temperature')}
                  temperature={field.value}
                  disabled={isAppPublic}
                  tooltip={isAppPublicTooltip}
                  onChangeTemperature={field.onChange}
                />
              )}
            />
          </div>
        )}

        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <DialMarkdownEditorContainer
              label={t('Instructions')}
              value={field.value}
              onChangeValue={field.onChange}
              height={200}
              theme={theme as EditorThemes}
            />
          )}
        />
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t('Context & Tools')}
        openByDefault
        dataQa="context-tools-section"
      >
        <AgentsAndToolsetsField onAutoSave={onAutoSave} />

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
                field.onChange(
                  field.value?.filter((field) => field !== document),
                )
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
              tooltip={isAppPublicTooltip}
            />
          )}
        />

        <CodeInterpreterField />
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t('Attachments')}
        dataQa="attachments-section"
      >
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
              tooltip={isAppPublicTooltip}
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
          tooltip={isAppPublicTooltip}
          dataQa={'max-attachment-number-field'}
        />
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t('Conversation starters')}
        description={t(
          'Starters are buttons close the chat input that offer prompts to help users initiate a conversation',
        )}
        dataQa="conversation-starters-section"
      >
        <ControlledField
          label={t('Intro text')}
          placeholder={t('e.g., What do you want to talk about?')}
          id="introText"
          error={errors.introText?.message}
          control={control}
          name="introText"
          info={t('Optional text shown above the conversation starters')}
          disabled={isAppPublic}
          tooltip={isAppPublicTooltip}
        />

        <Controller
          name="autoSubmit"
          control={control}
          render={({ field }) => (
            <StartersBehaviourField
              label={t('Starters behaviour')}
              value={field.value}
              onChange={field.onChange}
              disabled={isAppPublic}
              tooltip={isAppPublicTooltip}
            />
          )}
        />

        <Controller
          name="starters"
          control={control}
          render={({ field }) => (
            <ConversationStartersField
              label={t('Conversation starters')}
              value={field.value}
              onChange={field.onChange}
              disabled={isAppPublic}
            />
          )}
        />

        <Controller
          name="chatMessageInputDisabled"
          control={control}
          render={({ field }) => (
            <ToggleSwitchField
              label={t('Disable chat input')}
              isOn={field.value}
              handleSwitch={() => field.onChange(!field.value)}
              className="mt-1 flex w-fit items-center gap-2"
              switchOnText={t('ON')}
              switchOFFText={t('OFF')}
              additionalText={t(
                'Disable chat input so users can only use starters',
              )}
              disabled={isAppPublic}
              tooltip={isAppPublicTooltip}
            />
          )}
        />
      </FormCollapsibleSection>
    </div>
  );
};
