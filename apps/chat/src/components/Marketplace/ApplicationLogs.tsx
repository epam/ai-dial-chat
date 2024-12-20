import { IconDownload, IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { downloadApplicationLogs } from '@/src/utils/app/import-export';

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

const LogsView = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const applicationLogs = useAppSelector(
    ApplicationSelectors.selectApplicationLogs,
  );
  const isLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  if (isLogsLoading || !applicationLogs) {
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
    <div className="flex grow flex-col gap-1 overflow-y-auto break-all px-3 pb-6 md:px-6">
      <div className="flex flex-col gap-1">
        {applicationLogs.split('\n').map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </div>
  );
};

const LogsFooter = ({ entityId }: { entityId: string }) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const applicationLogs = useAppSelector(
    ApplicationSelectors.selectApplicationLogs,
  );
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
                ? 'button-secondary'
                : 'text-secondary hover:text-accent-primary',
            )}
            size={24}
          />
        </button>
      </Tooltip>
      {applicationLogs && (
        <Tooltip tooltip={t('Download logs')}>
          <button
            onClick={() => downloadApplicationLogs(applicationLogs)}
            className="button button-secondary flex h-[38px] items-center gap-1"
            data-qa="application-download-logs"
            disabled={isLogsLoading}
          >
            <IconDownload
              className={classNames(
                isLogsLoading
                  ? 'button-secondary'
                  : 'shrink-0 text-secondary hover:text-accent-primary',
              )}
              size={18}
            />
            <span className="text-sm">{t('Download')}</span>
          </button>
        </Tooltip>
      )}
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
  return (
    <Modal
      portalId="theme-main"
      state={isOpen}
      dataQa="marketplace-application-logs"
      containerClassName="group/modal flex w-full flex-col min-h-[350px] xl:max-w-[820px] max-w-[800px]"
      onClose={onClose}
    >
      <LogsHeader />
      <LogsView />
      <LogsFooter entityId={entityId} />
    </Modal>
  );
};
