import { IconArrowsMaximize } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getApplicationEntityFields } from '@/src/utils/app/application';
import { BucketService } from '@/src/utils/app/data/bucket-service';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { PreviewMode } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import Tooltip from '../../Common/Tooltip';
import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData, getDefaultValues } from './form';

interface Props {
  applicationData?: CustomApplicationModel;
  schema: ApiDetailedApplicationTypeSchema | null;
}

export const GeneralInfoView: React.FC<Props> = ({
  applicationData,
  schema,
}) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelFromState = applicationData
    ? modelsMap[applicationData.reference]
    : null;

  const [pythonVersion] = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );

  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsWithFolderId = models.map((model) => ({
    ...model,
    folderId: '',
  }));

  const isAppDeployed =
    applicationData?.functionStatus === ApplicationStatus.DEPLOYED;

  const methods = useForm<ApplicationGeneralInfoFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: getDefaultValues(
      applicationData,
      BucketService.getBucket(),
      pythonVersion,
      modelsWithFolderId,
    ),
  });

  const { t } = useTranslation(Translation.Chat);

  const formData = methods.watch();

  const screenState = useScreenState();

  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    screenState <= ScreenState.MD ? PreviewMode.closed : PreviewMode.half,
  );

  useEffect(() => {
    if (screenState > ScreenState.MD && previewMode !== PreviewMode.half) {
      setPreviewMode(PreviewMode.half);
    } else if (
      screenState <= ScreenState.MD &&
      previewMode === PreviewMode.half
    ) {
      setPreviewMode(PreviewMode.closed);
    }
  }, [screenState, previewMode]);

  return (
    <div className="flex w-full overflow-hidden">
      <div
        className={classNames(
          'overflow-hidden transition-all duration-300 ease-in-out',
          {
            'grow opacity-100': previewMode === PreviewMode.closed,
            'size-full': previewMode === PreviewMode.half,
            'w-0 opacity-0': previewMode === PreviewMode.full,
          },
        )}
      >
        <FormProvider {...methods}>
          <GeneralInfoEditor
            oldApplication={applicationData ? applicationData : undefined}
            schema={schema}
            isSharedWithMe={modelFromState?.sharedWithMe ?? false}
            isAppDeployed={isAppDeployed}
          />
        </FormProvider>
      </div>

      <div
        className={classNames(
          'relative flex min-h-0 flex-col overflow-hidden border-l border-primary transition-all duration-300 ease-in-out',
          {
            'w-full opacity-100': previewMode === PreviewMode.full,
            'size-full grow': previewMode === PreviewMode.half,
            'absolute w-0 opacity-0': previewMode === PreviewMode.closed,
          },
        )}
      >
        <GeneralInfoPreview
          entity={getApplicationEntityFields(
            formData,
            modelFromState as DialAIEntityModel,
          )}
          onClosePreview={() => setPreviewMode(PreviewMode.closed)}
        />
      </div>

      {previewMode === PreviewMode.closed && (
        <div className="hidden h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-4 hover:cursor-pointer max-xl:flex">
          <button
            className="text-secondary hover:text-accent-primary"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewMode(PreviewMode.full);
            }}
          >
            <Tooltip tooltip={t('Expand preview')}>
              <IconArrowsMaximize size={24} />
            </Tooltip>
          </button>
          <span
            className="select-none text-primary"
            style={{ writingMode: 'vertical-rl' }}
          >
            {t('Preview')}
          </span>
        </div>
      )}
    </div>
  );
};
