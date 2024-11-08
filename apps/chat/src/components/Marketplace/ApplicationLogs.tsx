import { IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { ApplicationLogsType } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Modal from '../Common/Modal';
import { Spinner } from '../Common/Spinner';
import Tooltip from '../Common/Tooltip';

const LogsHeader = () => {
  const { t } = useTranslation(Translation.Marketplace);
  return (
    <div className="px-3 pb-4 pt-6 md:px-6">
      <h2 className="text-base font-semibold">{t('Application logs')}</h2>
    </div>
  );
};
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
  applicationLogs?: ApplicationLogsType;
}

const LogsView = ({ applicationLogs }: LogsViewProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const isLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  if (isLogsLoading || !applicationLogs?.logs.length) {
    return (
      <div className="flex w-full grow items-center justify-center p-4">
        {isLogsLoading ? (
          <Spinner size={30} className="mx-auto" />
        ) : (
          t('No logs found')
        )}
      </div>
    );
  }

  return (
    <div className="flex grow flex-col items-center gap-1 overflow-y-auto break-all px-3 pb-6 md:px-6">
      {applicationLogs.logs.map((log, index) => (
        <div key={index} className="flex flex-col gap-1">
          <LogLines logContent={log.content} />
        </div>
      ))}
    </div>
  );
};

interface LogsFooterProps {
  entityId: string;
  applicationLogs?: ApplicationLogsType;
}

const LogsFooter = ({ entityId }: LogsFooterProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const isLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  return (
    <div className="flex items-center justify-between gap-3 divide-y-0 border-t border-tertiary px-3 py-4 md:px-6">
      <Tooltip tooltip={t('Reload logs')}>
        <button
          onClick={() => dispatch(ApplicationActions.getLogs(entityId))}
          className="icon-button"
          data-qa="application-reload-logs"
          disabled={isLogsLoading}
        >
          <IconRefresh
            className={classNames(
              isLogsLoading
                ? 'cursor-not-allowed text-controls-disable'
                : 'text-secondary hover:text-accent-primary',
            )}
            size={24}
          />
        </button>
      </Tooltip>
    </div>
  );
};

interface ApplicationLogsProps {
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ApplicationLogs = ({
  entityId,
  isOpen,
  onClose,
}: ApplicationLogsProps) => {
  const applicationLogs = useAppSelector(
    ApplicationSelectors.selectApplicationLogs,
  );

  return (
    <Modal
      portalId="chat"
      state={isOpen}
      dataQa="marketplace-application-logs"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col min-h-[350px] xl:max-w-[820px] max-w-[800px]"
      onClose={onClose}
    >
      <LogsHeader />
      <LogsView applicationLogs={applicationLogs} />
      <LogsFooter applicationLogs={applicationLogs} entityId={entityId} />
    </Modal>
  );
};
