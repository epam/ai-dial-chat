import { useEffect } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isExecutableApp } from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FEATURES_ENDPOINTS_NAMES } from '@/src/constants/applications';

import { ReviewApplicationPropsSection } from '@/src/components/Chat/Publish/ReviewApplicationDialog/ReviewApplicationPropsSection';
import { CodeEditor } from '@/src/components/Common/CodeEditor';
import { Spinner } from '@/src/components/Common/Spinner';

import isEmpty from 'lodash-es/isEmpty';

interface ReviewCodeAppSectionViewProps {
  config: NonNullable<CustomApplicationModel['function']>;
}

const ReviewCodeAppSectionView = ({
  config,
}: ReviewCodeAppSectionViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const isFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);

  useEffect(() => {
    dispatch(FilesActions.getFiles({ id: config.sourceFolder }));
  }, [dispatch, config.sourceFolder]);

  return (
    <>
      {!isEmpty(config.mapping) && (
        <ReviewApplicationPropsSection
          label="Endpoints"
          appProps={config.mapping ?? {}}
          propsNames={FEATURES_ENDPOINTS_NAMES}
        />
      )}
      {!isEmpty(config.env) && (
        <ReviewApplicationPropsSection
          label="Environment variables"
          appProps={config.env ?? {}}
        />
      )}

      <div className="flex gap-4">
        <span className="w-[122px] shrink-0 text-secondary">
          {t('Source folder: ')}
        </span>

        <div className="min-h-[400px] max-w-full shrink grow">
          {isFilesLoading ? (
            <div className="flex size-full items-center justify-center rounded border border-tertiary">
              <Spinner size={30} />
            </div>
          ) : (
            <CodeEditor sourcesFolderId={`${config.sourceFolder}`} readOnly />
          )}
        </div>
      </div>
    </>
  );
};

interface ReviewCodeAppSectionProps {
  application?: CustomApplicationModel;
}

export const ReviewCodeAppSection = ({
  application,
}: ReviewCodeAppSectionProps) => {
  const isCodeApp = application && isExecutableApp(application);

  if (!isCodeApp || !application?.function) return null;

  return <ReviewCodeAppSectionView config={application.function} />;
};
