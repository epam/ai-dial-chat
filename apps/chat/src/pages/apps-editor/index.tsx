import { getSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { useAppEditorValidation } from '@/src/hooks/useAppEditorValidation';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { canUserUseFeature } from '@/src/utils/session';

import { ApplicationType } from '@/src/types/applications';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';

import { getLayout } from '@/src/pages/_app';

import { AppsEditor } from '@/src/components/AppsEditor/AppsEditor';
import { Spinner } from '@/src/components/Common/Spinner';

import { Feature, UploadStatus } from '@epam/ai-dial-shared';

function AppsEditorPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const initialDataStatus = useAppSelector(
    SettingsSelectors.selectInitialDataStatus,
  );
  const areModelsLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  useAppEditorValidation();

  const applicationId = router.query[AppsEditorQuery.Id]?.toString() ?? '';

  const isLoading =
    initialDataStatus === UploadStatus.LOADING ||
    !areModelsLoaded ||
    (!!applicationId && !appDetails);

  useEffect(() => {
    dispatch(ApplicationActions.initQueryParams());
  }, [dispatch]);

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={45} className="mx-auto" />
      </div>
    );

  return (
    <div className="size-full">
      <AppsEditor />
    </div>
  );
}

AppsEditorPage.getLayout = getLayout;

export default AppsEditorPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  const canCreateCodeApps = canUserUseFeature(session, Feature.CodeApps);

  const { [AppsEditorQuery.Schema]: schema, [AppsEditorQuery.Id]: id } =
    context.query;

  if (!id && schema === ApplicationType.CODE_APP && !canCreateCodeApps) {
    return {
      notFound: true,
    };
  }

  return getCommonPageProps(context);
};
