import { useEffect } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isExecutableApp } from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { FEATURES_ENDPOINTS_NAMES } from '@/src/constants/applications';
import { ChatI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';

import { ReviewApplicationPropsSection } from '@/src/components/Chat/Publish/PublicationHandler/ReviewApplicationDialog/ReviewApplicationPropsSection';
import { CodeEditor } from '@/src/components/Common/CodeEditor/CodeEditor';
import { Spinner } from '@/src/components/Common/Spinner';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';

import isEmpty from 'lodash-es/isEmpty';

interface ReviewCodeAppSectionViewProps {
  config: NonNullable<CustomApplicationModel['function']>;
}

const ReviewCodeAppSectionView = ({
  config,
}: ReviewCodeAppSectionViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const { t: tMarketplace } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const isFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);

  useEffect(() => {
    dispatch(FilesActions.getFiles({ id: config.sourceFolder }));
  }, [dispatch, config.sourceFolder]);

  return (
    <>
      {!isEmpty(config.mapping) && (
        <ReviewApplicationPropsSection
          label={tMarketplace(MarketplaceI18nKeys.Endpoints)}
          appProps={config.mapping ?? {}}
          propsNames={FEATURES_ENDPOINTS_NAMES}
        />
      )}
      {!isEmpty(config.env) && (
        <ReviewApplicationPropsSection
          label={tMarketplace(MarketplaceI18nKeys.EnvironmentVariables)}
          appProps={config.env ?? {}}
        />
      )}

      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.SourceFolder)}
        value={
          isFilesLoading ? (
            <div className="flex size-full items-center justify-center rounded border border-tertiary">
              <Spinner size={30} />
            </div>
          ) : (
            <CodeEditor sourcesFolderId={config.sourceFolder} readOnly />
          )
        }
        valueClassName="min-h-[400px] max-w-full shrink grow"
      />
    </>
  );
};

interface ReviewCodeAppSectionProps {
  application: CustomApplicationModel;
}

export const ReviewCodeAppSection = ({
  application,
}: ReviewCodeAppSectionProps) => {
  if (!isExecutableApp(application) || !application.function) return null;

  return <ReviewCodeAppSectionView config={application.function} />;
};
