import { IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import { ApplicationLogsType } from '@/src/types/applications';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppSelector } from '@/src/store/hooks';

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
  entity: DialAIEntityModel;
  applicationLogs?: ApplicationLogsType;
  onLogsClick: (entity: string) => void;
}

const LogsFooter = ({ entity, onLogsClick }: LogsFooterProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const isLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  return (
    <div className="flex items-center justify-between gap-3 divide-y-0 border-t border-tertiary px-3 py-4 md:px-6">
      <Tooltip tooltip={t('Reload logs')}>
        <button
          onClick={() => onLogsClick(entity.id)}
          className="icon-button"
          data-qa="application-reload-logs"
        >
          {isLogsLoading ? (
            <Spinner size={24} className="mx-auto" />
          ) : (
            <IconRefresh
              className="text-secondary hover:text-accent-primary"
              size={24}
            />
          )}
        </button>
      </Tooltip>
    </div>
  );
};

interface ApplicationLogsProps {
  entity: DialAIEntityModel;
  isOpen: boolean;
  onClose: () => void;
  onLogsClick: (entity: string) => void;
}

export const ApplicationLogs = ({
  entity,
  isOpen,
  onClose,
  onLogsClick,
}: ApplicationLogsProps) => {
  const applicationLogs = useAppSelector(
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
      <LogsHeader />
      <LogsView applicationLogs={applicationLogs} />
      <LogsFooter
        applicationLogs={applicationLogs}
        onLogsClick={onLogsClick}
        entity={entity}
      />
    </Modal>
  );
};
