import { useEffect, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { isApplicationType } from '@/src/utils/app/application';
import { decode } from '@/src/utils/app/application-type-schema';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { ApplicationSettings } from '@/src/components/AppsEditor/Settings';
import { Spinner } from '@/src/components/Common/Spinner';

import { getLayout } from '../../../_app';

import { UploadStatus } from '@epam/ai-dial-shared';

export default function AppsSettings() {
  const dispatch = useAppDispatch();
  const {
    query: { slug = '', id = '' },
  } = useRouter();
  const type = useMemo(
    () =>
      isApplicationType(slug.toString())
        ? slug.toString()
        : decode(slug?.toString() ?? ''),
    [slug],
  );

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const isLoadingModels = useAppSelector(ModelsSelectors.selectModelsIsLoading);

  const isSchemaApplicationType = !isApplicationType(decode(slug.toString()));

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const initialDataStatus = useAppSelector(
    SettingsSelectors.selectInitialDataStatus,
  );

  useEffect(() => {
    if (!id) return;
    const applicationId = modelsMap[id.toString()]?.id;
    if (!applicationData && applicationId) {
      dispatch(ApplicationActions.get({ applicationId }));
    }
  }, [modelsMap, applicationData, id, dispatch]);

  const isLoading = useMemo(
    () =>
      initialDataStatus === UploadStatus.LOADING ||
      isLoadingModels ||
      (isSchemaApplicationType && !schema) ||
      !applicationData,
    [
      initialDataStatus,
      isLoadingModels,
      isSchemaApplicationType,
      schema,
      applicationData,
    ],
  );

  return (
    <div className="flex size-full flex-col">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={45} className="mx-auto" />
        </div>
      ) : (
        <>
          <AppsEditorHeader
            isEditApplication
            applicationTypeDisplayName={
              isSchemaApplicationType
                ? (schema?.[
                    ApplicationTypeSchemaProperties.applicationTypeDisplayName
                  ] ?? '')
                : decode(slug.toString())
            }
            hasCustomEditor={!!schema?.['dial:applicationTypeEditorUrl']}
          />
          <div className="flex size-full grow overflow-hidden">
            {applicationData && (
              <ApplicationSettings
                applicationData={applicationData}
                schema={isSchemaApplicationType ? schema : null}
                type={type ?? ''}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

AppsSettings.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = getCommonPageProps;
