import { useCallback, useMemo, useState } from 'react';
import {
  Controller,
  useController,
  useFormContext,
  useFormState,
} from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Toolsets } from '@/src/types/applications';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import {
  CONFIRM_DOCUMENT_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';

import { QuickAppForm as QuickAppFormType } from '@/src/components/AppsEditor/form';
import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';

import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const ToolsetEditor = withErrorMessage(withLabel(MonacoEditor));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));

const myFilesFilter = new Set([FileSourceType.MY_FILES]);

export const QuickAppForm = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const { control, register } = useFormContext<QuickAppFormType>();
  const { errors } = useFormState<QuickAppFormType>({ control });

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const editorOptions = useMemo(
    () => ({
      readOnly: isAppPublic,
    }),
    [isAppPublic],
  );

  const [activeTabId, setActiveTabId] = useState(Toolsets.WebApiToolset);

  const toolsetController = useController({
    name: Toolsets.WebApiToolset,
    control,
  });
  const mcpToolsetController = useController({
    name: Toolsets.McpToolset,
    control,
  });

  const editorTabs = useMemo(() => {
    return [
      {
        id: Toolsets.WebApiToolset,
        label: 'Web API',
        value: toolsetController.field.value ?? '',
        language: 'json',
      },
      {
        id: Toolsets.McpToolset,
        label: 'MCP',
        value: mcpToolsetController.field.value ?? '',
        language: 'json',
      },
    ];
  }, [toolsetController.field.value, mcpToolsetController.field.value]);

  const fieldControllers = useMemo(
    () => ({
      [Toolsets.WebApiToolset]: toolsetController,
      [Toolsets.McpToolset]: mcpToolsetController,
    }),
    [toolsetController, mcpToolsetController],
  );

  const handleFileChange = useCallback(
    (fileId: Toolsets, value: string) => {
      const controller = fieldControllers[fileId]?.field;
      if (controller) {
        controller.onChange(value);
        controller.onBlur();
      }
    },
    [fieldControllers],
  );

  const handleTabChange = (id: string) => {
    setActiveTabId(id as Toolsets);
  };

  const handleFileChangeWrapper = (fileId: string, value: string) => {
    handleFileChange(fileId as Toolsets, value);
  };

  return (
    <div className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5">
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
            filesFilter={myFilesFilter}
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
          />
        )}
      />

      <ToolsetEditor
        label={t('Configure toolsets')}
        error={errors[activeTabId]?.message}
        height={200}
        allowFullScreen
        files={editorTabs}
        onTabChange={handleTabChange}
        activeFileId={activeTabId}
        onChangeFile={handleFileChangeWrapper}
        options={editorOptions}
      />

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
    </div>
  );
};
