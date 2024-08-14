import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Operation } from '@/src/types/import-export';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ImportExportActions,
  ImportExportSelectors,
} from '@/src/store/import-export/importExport.reducers';

import { FullPageLoader } from '../Common/FullPageLoader';

interface Props {
  isOpen: boolean;
}
export const ImportExportLoader = ({ isOpen }: Props) => {
  const { t } = useTranslation(Translation.ChatBar);
  const dispatch = useAppDispatch();
  const operationName =
    useAppSelector(ImportExportSelectors.selectOperationName) ?? '';
  const stopLabel =
    operationName === Operation.Importing
      ? t('chatbar.button.stop')
      : 'chatbar.button.cancel';

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
      isOpen={isOpen}
      onClose={() => {
        return;
      }}
      onStop={onStop}
      stopLabel={t(stopLabel)}
    />
  );
};
