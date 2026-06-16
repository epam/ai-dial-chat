import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Operation } from '@/src/types/import-export';
import { Translation } from '@/src/types/translation';

import { ImportExportActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { FullPageLoader } from '@/src/components/Common/FullPageLoader';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

function ImportExportLoaderView() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const operationName =
    useAppSelector(ImportExportSelectors.selectOperationName) ?? '';
  const stopLabel =
    operationName === Operation.Importing
      ? ChatI18nKeys.Stop
      : ChatI18nKeys.Cancel;
  const loaderLabel =
    operationName === Operation.Importing
      ? ChatI18nKeys.Importing
      : ChatI18nKeys.Exporting;

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
      loaderLabel={t(loaderLabel)}
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
