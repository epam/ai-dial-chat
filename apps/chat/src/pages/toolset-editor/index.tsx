import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { useToolsetEditorValidation } from '@/src/hooks/useToolsetEditorValidation';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { getLayout } from '@/src/pages/_app';

import { Spinner } from '@/src/components/Common/Spinner';
import { ToolsetEditor } from '@/src/components/ToolsetEditor/ToolsetEditor';

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
  const areToolsetsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Toolsets),
  );
  const { [ToolsetEditorQuery.Id]: toolsetIdQuery } = router.query;
  const toolsetId = toolsetIdQuery?.toString();

  const isLoading =
    (toolsetId &&
      !toolsetDetails &&
      (toolsetDetailsStatus === UploadStatus.LOADING ||
        toolsetDetailsStatus === UploadStatus.UNINITIALIZED)) ||
    !areToolsetsLoaded;

  useEffect(() => {
    if (!areToolsetsEnabled) {
      void router.push(Routes.Chat);
    }
  }, [areToolsetsEnabled, router]);

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

export const getServerSideProps = getCommonPageProps;
