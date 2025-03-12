import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Operation } from '@/src/types/import-export';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ImportExportActions,
  ImportExportSelectors,
} from '@/src/store/import-export/importExport.reducers';

import { FullPageLoader } from '../Common/FullPageLoader';
import { withRenderWhen } from '../Common/RenderWhen';

function ImportExportLoaderView() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const operationName =
    useAppSelector(ImportExportSelectors.selectOperationName) ?? '';
  const stopLabel = operationName === Operation.Importing ? 'Stop' : 'Cancel';

  const handleCancelExport = useCallback(() => {
    dispatch(ImportExportActions.exportCancel());
  }, [dispatch]);

  const handleStopImport = useCallback(() => {
    dispatch(ImportExportActions.importStop());
  }, [dispatch]);

  const onStop =
    operationName === Operation.Importing
      ? handleStopImport
      : handleCancelExport;
  return (
    <FullPageLoader
      loaderLabel={t(operationName)}
      isOpen
      onClose={() => {
        return;
      }}
      onStop={onStop}
      stopLabel={t(stopLabel)}
    />
  );
}

export const ImportExportLoader = withRenderWhen(
  ImportExportSelectors.selectIsLoadingImportExport,
)(ImportExportLoaderView);
