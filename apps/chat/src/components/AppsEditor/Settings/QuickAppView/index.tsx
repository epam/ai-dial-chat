import { useCallback, useEffect, useRef } from 'react';
import {
  Controller,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getQuickAppDocumentUrl,
  getSharedTooltip,
} from '@/src/utils/app/application';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { CONFIRM_DOCUMENT_VALUES } from '@/src/constants/applications';

import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withWarningMessage } from '@/src/components/Common/Forms/FieldWarningMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { QuickAppFormData, getQuickAppData } from '../form';

import isEqual from 'lodash-es/isEqual';

type Options<T extends Path<QuickAppFormData>> = Omit<
  RegisterOptions<QuickAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof QuickAppFormData]?: Options<K>;
};

const validators: Validators = {
  toolset: {
    required: 'Toolset config is required',
    validate: (v) => {
      try {
        JSON.parse(v);
      } catch {
        return 'Config is not a valid JSON object';
      }
      return true;
    },
  },
};

const LogoSelector = withErrorMessage(
  withWarningMessage(withLabel(CustomLogoSelect)),
);
const ToolsetEditor = withErrorMessage(withLabel(MonacoEditor));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));

const myFilesFilter = new Set([FileSourceType.MY_FILES]);

interface QuickAppViewProps {
  schema: ApiDetailedApplicationTypeSchema | null;
  isSharedWithMe: boolean;
  oldApplication: CustomApplicationModel;
  isShared?: boolean;
}

export const QuickAppView: React.FC<QuickAppViewProps> = ({
  schema,
  isSharedWithMe,
  oldApplication,
  isShared,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, defaultValues, isValid },
  } = useFormContext<QuickAppFormData>();

  const lastSubmittedValuesRef = useRef<QuickAppFormData | undefined>(
    defaultValues as QuickAppFormData,
  );

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );

  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );

  const confirmDocumentUrlValues = oldApplication?.isShared
    ? CONFIRM_DOCUMENT_VALUES
    : undefined;

  const handleSubmit = useCallback(
    (data: QuickAppFormData) => {
      if (
        (!isEqual(data, lastSubmittedValuesRef.current) || exitAfterSave) &&
        shouldSaveApplication
      ) {
        const applicationData = getQuickAppData(data);

        if (
          isShared &&
          getQuickAppDocumentUrl(applicationData as CustomApplicationModel) !==
            getQuickAppDocumentUrl(oldApplication)
        ) {
          dispatch(
            ShareActions.revokeAccess({
              resourceId: oldApplication.id,
              featureType: FeatureType.Application,
            }),
          );
          dispatch(ApplicationActions.setShouldSaveApplication(false));
          dispatch(ApplicationActions.setExitAfterSave(false));
          return;
        }

        dispatch(
          ApplicationActions.update({
            oldApplication,
            applicationData: {
              ...oldApplication,
              ...applicationData,
            },
            schema: schema ?? undefined,
          }),
        );
        lastSubmittedValuesRef.current = data;
      } else {
        dispatch(ApplicationActions.setShouldSaveApplication(false));
        dispatch(ApplicationActions.setExitAfterSave(false));
      }
    },
    [
      exitAfterSave,
      shouldSaveApplication,
      isShared,
      oldApplication,
      dispatch,
      schema,
    ],
  );

  const autoSaveHandler = useCallback(() => {
    submitWrapper(handleSubmit)();
  }, [submitWrapper, handleSubmit]);

  useEffect(() => {
    if (shouldSaveApplication) {
      if (!isValid) {
        dispatch(ApplicationActions.setShouldSaveApplication(false));
        dispatch(ApplicationActions.setExitAfterSave(false));
        dispatch(
          UIActions.showErrorToast(t('Please fill in all mandatory fields')),
        );
        return;
      }

      autoSaveHandler();
    }
  }, [autoSaveHandler, shouldSaveApplication, isValid, dispatch, t]);

  const files = useAppSelector(FilesSelectors.selectFiles);
  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="flex size-full flex-col bg-layer-2"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
        <Controller
          name="documentRelativeUrl"
          control={control}
          render={({ field }) => (
            <LogoSelector
              label={t('Document relative url')}
              localLogo={field.value?.split('/')?.pop()}
              onLogoSelect={(v) => field.onChange(getLogoId(v))}
              onDeleteLocalLogoHandler={() => field.onChange('')}
              customPlaceholder={t('No document relative url')}
              className="max-w-full"
              fileManagerModalTitle="Select document"
              error={errors.documentRelativeUrl?.message}
              allowedTypes={['*/*']}
              disabled={isSharedWithMe}
              tooltip={isSharedWithMe ? getSharedTooltip('file') : ''}
              sourceFilters={myFilesFilter}
              warning={confirmDocumentUrlValues?.description}
              confirmDialogValues={confirmDocumentUrlValues}
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
            />
          )}
        />

        <Controller
          name="toolset"
          control={control}
          rules={validators['toolset']}
          render={({ field }) => (
            <ToolsetEditor
              label={t('Configure toolset')}
              error={errors.toolset?.message}
              height={200}
              value={field.value}
              className="m-0.5 w-full overflow-hidden rounded border border-primary"
              language="json"
              onChange={(v) => field.onChange(v ?? '')}
            />
          )}
        />

        <FieldTextArea
          {...register('instructions')}
          label={t('Instructions')}
          placeholder={t('Instructions of your application')}
          rows={4}
          className="resize-none"
          id="instructions"
        />

        <Controller
          name="temperature"
          control={control}
          render={({ field }) => (
            <Slider
              label={t('Temperature')}
              temperature={field.value}
              onChangeTemperature={field.onChange}
            />
          )}
        />
      </div>
    </form>
  );
};
