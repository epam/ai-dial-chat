import { useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { useAppEditorValidation } from '@/src/hooks/useAppEditorValidation';

import { isApplicationType } from '@/src/utils/app/application';
import { decode } from '@/src/utils/app/application-type-schema';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { ApplicationSettings } from '@/src/components/AppsEditor/Settings';
import { Spinner } from '@/src/components/Common/Spinner';

import { getLayout } from '../../../_app';

import { UploadStatus } from '@epam/ai-dial-shared';

export default function AppsSettings() {
  const {
    query: { slug = '' },
  } = useRouter();

  const type = useMemo(
    () =>
      isApplicationType(slug.toString())
        ? slug.toString()
        : decode(slug?.toString() ?? ''),
    [slug],
  );

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const areModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );

  const isSchemaApplicationType = !isApplicationType(decode(slug.toString()));

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const initialDataStatus = useAppSelector(
    SettingsSelectors.selectInitialDataStatus,
  );

  useAppEditorValidation(true);

  const isLoading = useMemo(
    () =>
      initialDataStatus === UploadStatus.LOADING ||
      areModelsLoading ||
      (isSchemaApplicationType && !schema) ||
      !applicationData,
    [
      initialDataStatus,
      areModelsLoading,
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
            hasCustomEditor={
              !!schema?.[
                ApplicationTypeSchemaProperties.applicationTypeEditorUrl
              ]
            }
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
