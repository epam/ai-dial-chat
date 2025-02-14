import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { isApplicationType } from '@/src/utils/app/application';
import { decode } from '@/src/utils/app/application-type-schema';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { GeneralInfoView } from '@/src/components/AppsEditor/GeneralInfoView/GeneralInfoView';
import { Spinner } from '@/src/components/Common/Spinner';

import { getLayout } from '../../_app';

export default function AppsEditor() {
  const {
    query: { slug = '', id = '' },
  } = useRouter();
  const dispatch = useAppDispatch();

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const isSchemaApplicationType = !isApplicationType(decode(slug.toString()));

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);

  useEffect(() => {
    const applicationId = modelsMap[id.toString()]?.id;
    if (!applicationData && id && applicationId) {
      dispatch(ApplicationActions.get({ applicationId }));
    }
  }, [modelsMap, applicationData, id, dispatch]);

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
                ? (schema?.['dial:applicationTypeDisplayName'] ?? '')
                : decode(slug.toString())
            }
            isEditApplication={!!applicationData}
          />
          <div className="flex size-full">
            <GeneralInfoView
              applicationData={applicationData}
              schema={isSchemaApplicationType ? schema : null}
            />
          </div>
        </>
      )}
    </div>
  );
}

AppsEditor.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = getCommonPageProps;
