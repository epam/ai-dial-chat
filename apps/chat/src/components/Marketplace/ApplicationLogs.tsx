import React from 'react';

import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppSelector } from '@/src/store/hooks';

import Modal from '../Common/Modal';
import { Spinner } from '../Common/Spinner';

interface LogLinesProps {
  logContent: string;
}

const LogLines = ({ logContent }: LogLinesProps) => {
  const ansiRegex = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[mK]', 'g');

  return logContent
    .split('\n')
    .map((line, index) => <p key={index}>{line.replace(ansiRegex, '')}</p>);
};

interface LogsViewProps {
  logs: { content: string; instance: string }[];
}

const LogsView = ({ logs }: LogsViewProps) => (
  <React.Fragment>
    {logs.map((log, index) => (
      <div key={index} className="flex flex-col gap-4">
        <LogLines logContent={log.content} />
      </div>
    ))}
  </React.Fragment>
);

interface ApplicationLogsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApplicationLogs = ({ isOpen, onClose }: ApplicationLogsProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const selectLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  const selectApplicationLogs = useAppSelector(
    ApplicationSelectors.selectApplicationLogs,
  );

  return (
    <Modal
      portalId="chat"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      dataQa="marketplace-application-logs"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col min-h-[350px] xl:max-w-[820px] max-w-[800px]"
      onClose={onClose}
    >
      <div className="px-3 pb-4 pt-6 md:px-6">
        <h2 className="text-base font-semibold">{t('Application logs')}</h2>
      </div>
      {selectLogsLoading ? (
        <div className="flex w-full grow items-center justify-center rounded-t  p-4">
          <Spinner size={30} className="mx-auto" />
        </div>
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-4 overflow-y-auto break-all px-3 pb-6 md:px-6">
          {selectApplicationLogs?.logs.length ? (
            <LogsView logs={selectApplicationLogs.logs} />
          ) : (
            <p>{t('No logs found')}</p>
          )}
        </div>
      )}
    </Modal>
  );
};
