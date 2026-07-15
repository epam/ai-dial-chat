import { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useIsPublicationReview } from '@/src/hooks/useIsPublicationReview';
import { useReviewBucket } from '@/src/hooks/useReviewBucket';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { constructPath, getNextFileName } from '@/src/utils/app/file';
import { getFileRootId, isMyEntity } from '@/src/utils/app/id';
import {
  doesAgentSupportMcp,
  doesModelAllowTemperature,
} from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  FilesSelectors,
  ModelsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import {
  CONFIRM_DOCUMENT_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';
import {
  CommonI18nKeys,
  MarketplaceI18nKeys,
  SettingsI18nKeys,
} from '@/src/constants/i18n';

import { FormCollapsibleSection } from '@/src/components/AppsEditor/EditorForm/FormCollapsibleSection';
import { AgentSkillsField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/AgentSkillsField';
import { AgentsAndToolsetsField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/AgentsAndToolsetsField';
import { CodeInterpreterField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/CodeInterpreterField';
import { ConversationStartersList } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/ConversationStartersField';
import { ModelField } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/ModelField';
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
import { EditorTheme } from '@/src/components/Common/MarkdownEditor/MarkdownEditor';
import { DialMarkdownEditorContainer } from '@/src/components/Common/MarkdownEditor/MarkdownEditorContainer';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';
import { ToolsetLinkButton } from '@/src/components/Marketplace/ToolsetLinkButton';

import { DialFileNodeType, DialInput } from '@epam/ai-dial-ui-kit';
import { difference } from 'lodash-es';
import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelField));
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);
const StartersBehaviourField = withLabel(StartersBehaviourRadioGroup);
const ToggleSwitchField = withLabel(ToggleSwitch);
const CopyUrlButton = withLabel(ToolsetLinkButton);

const adminFilesFilter = new Set([
  FileSourceType.MY_FILES,
  FileSourceType.SHARED_WITH_ME,
  FileSourceType.PUBLIC,
  FileSourceType.REVIEW_FILES,
]);

const getItemLabel = (item: unknown): string => item as string;

interface AppsEditorProps {
  onAutoSave: (isSimpleViewSwitch?: boolean, ignoreDirty?: boolean) => void;
}

export const QuickApp2Form: FC<AppsEditorProps> = ({ onAutoSave }) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const isPublicationReview = useIsPublicationReview();
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const theme = useAppSelector(UISelectors.selectThemeState);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const { dialCoreExternalUrl } = useAppSelector(
    SettingsSelectors.selectDefaults,
  );
  const files = useAppSelector(FilesSelectors.selectFiles);

  const { control, setError, clearErrors, setValue, getValues } =
    useFormContext<QuickApp2FormType>();
  const { errors } = useFormState<QuickApp2FormType>({ control });

  const modelId = useWatch({ control, name: 'model' });
  const starters = useWatch({ control, name: 'starters' });
  const autoSubmit = useWatch({ control, name: 'autoSubmit' });
  const chatMessageInputDisabled = useWatch({
    control,
    name: 'chatMessageInputDisabled',
  });
  const documentRelativeUrls = useWatch({
    control,
    name: 'documentRelativeUrl',
  });

  const showTemperatureSlider = useMemo(() => {
    const selectedModel = modelsMap[modelId];
    return selectedModel ? doesModelAllowTemperature(selectedModel) : true;
  }, [modelId, modelsMap]);

  const showProcessLargeFiles =
    !!modelsMap[modelId]?.inputAttachmentTypes?.length;

  const hasStarters = useMemo(
    () => starters.some((s) => s.title.trim() && s.text.trim()),
    [starters],
  );

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);
  const isAppPublicTooltip = isAppPublic ? PUBLIC_APP_TOOLTIP : '';
  const startersSettingsTooltip = isAppPublic
    ? PUBLIC_APP_TOOLTIP
    : !hasStarters
      ? t(MarketplaceI18nKeys.AtLeastOneStarterIsRequiredToEnableSettings)
      : '';
  const filesFilter = isPublicationReview ? adminFilesFilter : undefined;

  const reviewBucket = useReviewBucket();

  const getStartersSettingsSnapshot = useCallback(() => {
    const { starters, introText, autoSubmit, chatMessageInputDisabled } =
      getValues();
    return JSON.stringify({
      starters,
      introText,
      autoSubmit,
      chatMessageInputDisabled,
    });
  }, [getValues]);

  const lastSavedStartersSettings = useRef<string | null>(null);
  if (lastSavedStartersSettings.current === null) {
    lastSavedStartersSettings.current = getStartersSettingsSnapshot();
  }

  const handleStartersSettingsAutoSave = useCallback(() => {
    if (isAppPublic) return;
    const snapshot = getStartersSettingsSnapshot();
    if (snapshot === lastSavedStartersSettings.current) return;
    lastSavedStartersSettings.current = snapshot;
    onAutoSave(false, true);
  }, [getStartersSettingsSnapshot, isAppPublic, onAutoSave]);

  const handleSelectFiles = useCallback(
    (fileIds: string[]) => {
      const currentValue = documentRelativeUrls ?? [];

      if (!isPublicationReview || !reviewBucket) {
        setValue('documentRelativeUrl', uniq([...currentValue, ...fileIds]), {
          shouldDirty: true,
        });
        return;
      }
      // Copy files selected from user's bucket to the review bucket
      const myFilesIds = fileIds.filter((id) => isMyEntity({ id }));
      const destinationFolder = getFileRootId(reviewBucket);
      const filesToCopy = myFilesIds.map((sourceUrl) => {
        const { name } = splitEntityId(sourceUrl);
        const newName = getNextFileName(
          name,
          files,
          0,
          true,
          destinationFolder,
        );
        const destinationUrl = constructPath(destinationFolder, newName);

        return {
          sourceUrl,
          destinationUrl,
          nodeType: DialFileNodeType.ITEM,
        };
      });

      if (filesToCopy.length) {
        dispatch(
          FilesActions.copyFiles({
            files: filesToCopy,
            destinationFolder,
          }),
        );
      }

      const selectedFilesIds = uniq([
        ...currentValue,
        ...difference(fileIds, myFilesIds),
        ...filesToCopy.map(({ destinationUrl }) => destinationUrl),
      ]);
      setValue('documentRelativeUrl', selectedFilesIds, { shouldDirty: true });
    },
    [
      dispatch,
      documentRelativeUrls,
      files,
      isPublicationReview,
      reviewBucket,
      setValue,
    ],
  );

  useEffect(() => {
    if (isPublicationReview && reviewBucket) {
      dispatch(
        FilesActions.getFilesWithFolders({ id: getFileRootId(reviewBucket) }),
      );
    }
  }, [dispatch, isPublicationReview, reviewBucket]);

  return (
    <div
      className="flex size-full grow flex-col divide-y divide-tertiary overflow-hidden overflow-y-auto bg-layer-2"
      data-qa="entity-view-form"
    >
      <FormCollapsibleSection
        name={t(MarketplaceI18nKeys.Orchestrator)}
        description={t(MarketplaceI18nKeys.OrchestratorDescription)}
        openByDefault
        dataQa="orchestrator-section"
      >
        <ModelsSelectorField
          label={t(MarketplaceI18nKeys.ModelMarketplace)}
          error={errors.model?.message}
          mandatory
        />

        {showTemperatureSlider && (
          <div className="w-full max-w-[500px]">
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <Slider
                  label={t(MarketplaceI18nKeys.TemperatureMarketplace)}
                  temperature={field.value}
                  disabled={isAppPublic}
                  tooltip={isAppPublicTooltip}
                  onChangeTemperature={field.onChange}
                />
              )}
            />
          </div>
        )}

        <div data-qa="instructions-field">
          <Controller
            name="instructions"
            control={control}
            render={({ field }) => (
              <DialMarkdownEditorContainer
                label={t(MarketplaceI18nKeys.InstructionsMarketplace)}
                placeholder={t(MarketplaceI18nKeys.InstructionsPlaceholder)}
                value={field.value}
                onChangeValue={field.onChange}
                height={200}
                theme={theme as EditorTheme}
              />
            )}
          />
        </div>

        {showProcessLargeFiles && (
          <Controller
            name="processLargeFiles"
            control={control}
            render={({ field }) => (
              <ToggleSwitchField
                isOn={field.value}
                handleSwitch={() => field.onChange(!field.value)}
                switchOnText="ON"
                switchOFFText="OFF"
                label={t(MarketplaceI18nKeys.ProcessFiles)}
                additionalText={t(
                  MarketplaceI18nKeys.AllowOrchestratorToProcessFiles,
                )}
                info={t(MarketplaceI18nKeys.ProcessFilesDescription)}
                className="flex items-center gap-2"
              />
            )}
          />
        )}
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t(MarketplaceI18nKeys.ContextAndTools)}
        description={t(MarketplaceI18nKeys.ContextAndToolsDescription)}
        openByDefault
        dataQa="context-tools-section"
      >
        <div data-qa="agents-and-toolsets-field">
          <AgentsAndToolsetsField onAutoSave={onAutoSave} />
        </div>

        <div data-qa="document-urls-field">
          <Controller
            name="documentRelativeUrl"
            control={control}
            render={({ field }) => (
              <FilesSelectorField
                label={t(MarketplaceI18nKeys.ContextFiles)}
                info={t(MarketplaceI18nKeys.ContextFilesInfo)}
                onAddFiles={handleSelectFiles}
                onRemoveFile={(document) =>
                  field.onChange(
                    field.value?.filter((field) => field !== document),
                  )
                }
                readonly={isSharedWithMe || isAppPublic}
                error={errors.documentRelativeUrl?.message}
                fileManagerTitle={t(MarketplaceI18nKeys.SelectDocuments)}
                files={field.value ?? []}
                addBtnTooltip={
                  isSharedWithMe
                    ? getSharedTooltip(
                        t(MarketplaceI18nKeys.DocumentsLowercase),
                      )
                    : undefined
                }
                confirmDialogValues={
                  appDetails?.isShared ? CONFIRM_DOCUMENT_VALUES : undefined
                }
                tooltip={isAppPublicTooltip}
                filesFilter={filesFilter}
              />
            )}
          />
        </div>

        <div data-qa="code-interpreter-field">
          <CodeInterpreterField />
        </div>

        <Controller
          name="fileTools"
          control={control}
          render={({ field }) => (
            <ToggleSwitchField
              isOn={field.value}
              handleSwitch={() => field.onChange(!field.value)}
              switchOnText="ON"
              switchOFFText="OFF"
              label={t(MarketplaceI18nKeys.FileTools)}
              additionalText={t(
                MarketplaceI18nKeys.AllowTheAgentToAccessAppFiles,
              )}
              info={t(MarketplaceI18nKeys.FileToolsDescription)}
              className="flex items-center gap-2"
            />
          )}
        />
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t(MarketplaceI18nKeys.AgentSkills)}
        description={t(MarketplaceI18nKeys.AgentSkillsDescription)}
        dataQa="agent-skills-section"
      >
        <AgentSkillsField />
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t(MarketplaceI18nKeys.UserAttachments)}
        description={t(MarketplaceI18nKeys.UserAttachmentsDescription)}
        dataQa="attachments-section"
      >
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
              tooltip={isAppPublicTooltip}
              dataQa="attachment-types-field"
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
          tooltip={isAppPublicTooltip}
          dataQa="max-attachment-number-field"
        />
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t(MarketplaceI18nKeys.ConversationStarters)}
        description={t(MarketplaceI18nKeys.StartersDescription)}
        dataQa="conversation-starters-section"
      >
        <Controller
          name="starters"
          control={control}
          render={({ field }) => (
            <ConversationStartersList
              value={field.value}
              onChange={field.onChange}
              onBlur={handleStartersSettingsAutoSave}
              disabled={isAppPublic}
            />
          )}
        />

        <div className="mt-1 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {t(MarketplaceI18nKeys.StartersSettings)}
            </h3>
            <p className="mt-1 text-sm text-secondary">
              {t(
                MarketplaceI18nKeys.AtLeastOneStarterIsRequiredToEnableSettings,
              )}
            </p>
          </div>
          <Controller
            name="introText"
            control={control}
            render={({ field }) => (
              <DialInput
                labelProps={{
                  label: t(MarketplaceI18nKeys.IntroText),
                  caption: t(
                    MarketplaceI18nKeys.OptionalTextShownAboveTheStarters,
                  ),
                }}
                placeholder={t(MarketplaceI18nKeys.EnterIntroText)}
                id="introText"
                name="introText"
                value={field.value}
                onChange={field.onChange}
                onBlur={handleStartersSettingsAutoSave}
                disabled={isAppPublic || !hasStarters}
                error={errors.introText?.message}
                tooltipText={startersSettingsTooltip}
              />
            )}
          />

          <Controller
            name="autoSubmit"
            control={control}
            render={({ field }) => (
              <StartersBehaviourField
                label={t(MarketplaceI18nKeys.StartersBehavior)}
                value={field.value}
                isSubgroup
                onChange={(value) => {
                  field.onChange(value);
                  handleStartersSettingsAutoSave();
                }}
                disabled={isAppPublic || !hasStarters}
                tooltip={startersSettingsTooltip}
              />
            )}
          />

          <Controller
            name="chatMessageInputDisabled"
            control={control}
            render={({ field }) => (
              <ToggleSwitchField
                label={t(MarketplaceI18nKeys.DisableChatInput)}
                isOn={field.value}
                handleSwitch={() => {
                  field.onChange(!field.value);
                  handleStartersSettingsAutoSave();
                }}
                isSubgroup
                className="mt-1 flex w-fit items-center gap-2"
                switchOnText={t(SettingsI18nKeys.ON)}
                switchOFFText={t(SettingsI18nKeys.OFF)}
                additionalText={t(
                  MarketplaceI18nKeys.DisableChatInputSoUsersCanOnlyUseStarters,
                )}
                warning={
                  !autoSubmit && chatMessageInputDisabled
                    ? t(MarketplaceI18nKeys.PayAttentionTheUserWontBeAbleToEdit)
                    : undefined
                }
                disabled={isAppPublic || !hasStarters}
                tooltip={startersSettingsTooltip}
              />
            )}
          />
        </div>
      </FormCollapsibleSection>

      <FormCollapsibleSection
        name={t(MarketplaceI18nKeys.AgentSettings)}
        description={t(MarketplaceI18nKeys.AgentSettingsDescription)}
        dataQa="agent-settings-section"
      >
        <Controller
          name="timestamp"
          control={control}
          render={({ field }) => (
            <ToggleSwitch
              isOn={field.value}
              handleSwitch={() => field.onChange(!field.value)}
              switchOnText="ON"
              switchOFFText="OFF"
              additionalText={t(MarketplaceI18nKeys.TimeAwareness)}
              className="flex items-center gap-2"
            />
          )}
        />
      </FormCollapsibleSection>

      {doesAgentSupportMcp(appDetails) && !!dialCoreExternalUrl && (
        <div className="flex flex-col gap-4 px-5 py-4">
          <h5 className="text-base font-semibold text-primary">
            {t(CommonI18nKeys.ConnectApplication)}
          </h5>
          <CopyUrlButton
            entity={appDetails}
            label={t(CommonI18nKeys.CopyApplicationEndpointURL)}
          />
        </div>
      )}
    </div>
  );
};
