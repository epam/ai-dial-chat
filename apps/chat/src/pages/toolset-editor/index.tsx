import { getSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { useToolsetEditorValidation } from '@/src/hooks/useToolsetEditorValidation';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { canUserUseFeature } from '@/src/utils/session';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { Spinner } from '@/src/components/Common/Spinner';
import { ToolsetEditor } from '@/src/components/ToolsetEditor/ToolsetEditor';

import { getLayout } from '@/src/layout';
import { Feature, UploadStatus } from '@epam/ai-dial-shared';

function ToolsetEditorPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  useToolsetEditorValidation();

  const toolsetDetailsStatus = useAppSelector(
    ToolsetSelectors.selectToolsetDetailsStatus,
  );
  const areToolsetsLoaded = useAppSelector(
    ToolsetSelectors.selectAreToolsetsLoaded,
  );
  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const { [ToolsetEditorQuery.Id]: toolsetIdQuery } = router.query;
  const toolsetId = toolsetIdQuery?.toString();

  const isLoading =
    (toolsetId &&
      !toolsetDetails &&
      (toolsetDetailsStatus === UploadStatus.LOADING ||
        toolsetDetailsStatus === UploadStatus.UNINITIALIZED)) ||
    !areToolsetsLoaded;

  useEffect(() => {
    dispatch(ToolsetActions.initQueryParams());
  }, [dispatch]);

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={45} className="mx-auto" />
      </div>
    );

  return (
    <div className="flex size-full flex-col">
      <ToolsetEditor />
    </div>
  );
}

ToolsetEditorPage.getLayout = getLayout;

export default ToolsetEditorPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  const canCreateToolsets = canUserUseFeature(session, Feature.Toolsets);

  const id = context.query[ToolsetEditorQuery.Id];

  if (!id && !canCreateToolsets) {
    return {
      notFound: true,
    };
  }

  return getCommonPageProps(context);
};
