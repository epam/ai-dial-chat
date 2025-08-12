import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { getLayout } from '@/src/pages/_app';

import { Spinner } from '@/src/components/Common/Spinner';
import { ToolsetEditor } from '@/src/components/ToolsetEditor/ToolsetEditor';

import { UploadStatus } from '@epam/ai-dial-shared';

function ToolsetEditorPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const toolsetDetailsStatus = useAppSelector(
    ToolsetSelectors.selectToolsetDetailsStatus,
  );
  const toolsetsStatus = useAppSelector(ToolsetSelectors.selectToolsetsStatus);
  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const { toolsetId: toolsetIdQuery } = router.query;
  const toolsetId = toolsetIdQuery?.toString();

  const isLoading =
    (toolsetId &&
      !toolsetDetails &&
      (toolsetDetailsStatus === UploadStatus.LOADING ||
        toolsetDetailsStatus === UploadStatus.UNINITIALIZED)) ||
    toolsetsStatus === UploadStatus.LOADING ||
    toolsetsStatus === UploadStatus.UNINITIALIZED;

  useEffect(() => {
    if (toolsetId) {
      dispatch(ToolsetActions.getToolsetDetails({ id: toolsetId }));
    }
  }, [dispatch, toolsetId]);

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
