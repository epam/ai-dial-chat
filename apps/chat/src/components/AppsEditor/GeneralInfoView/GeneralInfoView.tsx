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
import { ModelsSelectors, SettingsSelectors } from '@/src/store/selectors';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { Tooltip } from '@/src/components/Common/Tooltip';

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

  const isPreviewClosed = previewMode === PreviewMode.closed;
  const isPreviewHalf = previewMode === PreviewMode.half;
  const isPreviewFull = previewMode === PreviewMode.full;

  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode);
  };

  const handleFullModeClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    handlePreviewModeChange(PreviewMode.full);
  };

  useEffect(() => {
    if (screenState > ScreenState.MD && !isPreviewHalf) {
      handlePreviewModeChange(PreviewMode.half);
    } else if (screenState <= ScreenState.MD && isPreviewHalf) {
      handlePreviewModeChange(PreviewMode.closed);
    }
  }, [screenState, previewMode, isPreviewHalf]);

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <div className="flex w-full justify-center gap-2 border-b border-primary px-3 py-2 text-primary md:hidden">
        <TabButton
          selected={isPreviewClosed}
          onClick={() => handlePreviewModeChange(PreviewMode.closed)}
          className="w-full"
        >
          {t('Info')}
        </TabButton>
        <TabButton
          selected={isPreviewFull}
          onClick={() => handlePreviewModeChange(PreviewMode.full)}
          className="w-full"
        >
          {t('Preview')}
        </TabButton>
      </div>
      <div className="flex w-full grow overflow-hidden">
        <div
          className={classNames(
            'overflow-hidden transition-all duration-300 ease-in-out',
            {
              'grow opacity-100': isPreviewClosed,
              'size-full': isPreviewHalf,
              'size-0 opacity-0': isPreviewFull,
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
              'w-full opacity-100': isPreviewFull,
              'size-full grow': isPreviewHalf,
              'absolute w-0 opacity-0': isPreviewClosed,
            },
          )}
        >
          <GeneralInfoPreview
            entity={getApplicationEntityFields(
              formData,
              modelFromState as DialAIEntityModel,
            )}
            onClosePreview={() => handlePreviewModeChange(PreviewMode.closed)}
          />
        </div>

        {isPreviewClosed && (
          <div
            className="hidden h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-4 hover:cursor-pointer md:flex"
            onClick={handleFullModeClick}
          >
            <button className="text-secondary hover:text-accent-primary">
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
    </div>
  );
};
