import React from 'react';

import { ModalState } from '@/src/types/modal';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppSelector } from '@/src/store/hooks';

import Modal from '../Common/Modal';
import { Spinner } from '../Common/Spinner';

interface LogLinesProps {
  logContent: string;
}

const LogLines = ({ logContent }: LogLinesProps) => {
  return logContent
    .split('\n')
    .map((line, index) => (
      <p key={index}>{line.replace(/\\u001b\[([0-9;]*m)?/g, '')}</p>
    ));
};

interface ApplicationLogsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApplicationLogs = ({ isOpen, onClose }: ApplicationLogsProps) => {
  const { selectedLogsLoading, selectedApplicationLogs } = useAppSelector(
    (state) => ({
      selectedLogsLoading: ApplicationSelectors.selectIsLogsLoading(state),
      selectedApplicationLogs:
        ApplicationSelectors.selectApplicationLogs(state),
    }),
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
        <h2 className="text-base font-semibold">Application logs</h2>
      </div>
      {selectedLogsLoading ? (
        <div className="flex w-full grow items-center justify-center rounded-t  p-4">
          <Spinner size={30} className="mx-auto" />
        </div>
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-4 overflow-y-auto break-all px-3 pb-6 md:px-6">
          {selectedApplicationLogs?.logs.length ? (
            selectedApplicationLogs?.logs.map((log) => {
              return (
                <React.Fragment key={log.content}>
                  {selectedApplicationLogs?.logs?.map((log, index) => (
                    <div key={index} className="flex flex-col gap-2">
                      <LogLines logContent={log.content} />
                    </div>
                  ))}
                </React.Fragment>
              );
            })
          ) : (
            <p>No logs found</p>
          )}
        </div>
      )}
    </Modal>
  );
};
