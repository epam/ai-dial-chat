import { getSession } from 'next-auth/react';
import { useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { useAppEditorValidation } from '@/src/hooks/useAppEditorValidation';

import { isApplicationType } from '@/src/utils/app/application';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { canUserUseFeature } from '@/src/utils/session';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { GeneralInfoView } from '@/src/components/AppsEditor/GeneralInfoView/GeneralInfoView';
import { Spinner } from '@/src/components/Common/Spinner';

import { getLayout } from '../../_app';

import { Feature, UploadStatus } from '@epam/ai-dial-shared';

export default function AppsEditor() {
  const {
    query: { slug = '', id = '' },
  } = useRouter();

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const initialDataStatus = useAppSelector(
    SettingsSelectors.selectInitialDataStatus,
  );
  const areModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );

  const isSchemaApplicationType = !isApplicationType(
    decodeURIComponent(slug.toString()),
  );

  useAppEditorValidation(false);

  const isLoading = useMemo(
    () =>
      initialDataStatus === UploadStatus.LOADING ||
      areModelsLoading ||
      (id && !applicationData),
    [initialDataStatus, areModelsLoading, id, applicationData],
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
            applicationTypeDisplayName={
              isSchemaApplicationType
                ? (schema?.[
                    ApplicationTypeSchemaProperties.applicationTypeDisplayName
                  ] ?? '')
                : decodeURIComponent(slug.toString())
            }
            isEditApplication={!!id}
            hasCustomEditor={
              !!schema?.[
                ApplicationTypeSchemaProperties.applicationTypeEditorUrl
              ]
            }
          />
          <div className="flex size-full">
            <GeneralInfoView
              applicationData={id ? applicationData : undefined}
              schema={isSchemaApplicationType ? schema : null}
            />
          </div>
        </>
      )}
    </div>
  );
}

AppsEditor.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  const canCreateCodeApps = canUserUseFeature(session, Feature.CodeApps);

  const { slug, id } = context.query;

  if (!id && slug === ApplicationType.CODE_APP && !canCreateCodeApps) {
    return {
      notFound: true,
    };
  }

  return getCommonPageProps(context);
};
