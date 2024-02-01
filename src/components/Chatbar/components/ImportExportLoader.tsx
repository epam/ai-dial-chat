import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Operation } from '@/src/types/importExport';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ImportExportActions,
  ImportExportSelectors,
} from '@/src/store/import-export/importExport.reducers';

import { TransparentLoader } from '../../Common/TransparentLoader';

interface Props {
  isOpen: boolean;
}
export const ImportExportLoader = ({ isOpen }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const operationName =
    useAppSelector(ImportExportSelectors.selectOperationName) ?? '';
  const stopLabel = operationName === Operation.Importing ? 'Stop' : 'Cancel';

  const handleOnClose = useCallback(() => {
    dispatch(ImportExportActions.resetState());
  }, [dispatch]);

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
    <TransparentLoader
      loaderLabel={t(operationName)}
      isOpen={isOpen}
      onClose={handleOnClose}
      onStop={onStop}
      stopLabel={t(stopLabel)}
    />
  );
};
