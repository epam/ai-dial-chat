import { IconDownload, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { downloadApplicationLogs } from '@/src/utils/app/import-export';

import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

import {
  ButtonSize,
  DialButton,
  DialNeutralButton,
} from '@epam/ai-dial-ui-kit';

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

const LogsFooter = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const entityId = useAppSelector(ApplicationSelectors.selectLogsEntityId);

  const applicationLogs = useAppSelector(
    ApplicationSelectors.selectApplicationLogs,
  );
  const isLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  const uploadLogs = useCallback(
    () => dispatch(ApplicationActions.getLogs(entityId!)),
    [dispatch, entityId],
  );

  useEffect(() => {
    uploadLogs();
  }, [uploadLogs]);

  return (
    <div className="flex items-center justify-between gap-3 divide-y-0 border-t border-tertiary px-3 py-4 md:px-6">
      <Tooltip tooltip={t('Reload logs')}>
        <DialButton
          onClick={uploadLogs}
          data-qa="application-reload-logs"
          disabled={isLogsLoading}
          iconBefore={
            <IconRefresh
              className={classNames(
                isLogsLoading
                  ? 'text-controls-disable'
                  : 'text-secondary hover:text-accent-primary',
              )}
            />
          }
        />
      </Tooltip>
      {applicationLogs && (
        <Tooltip tooltip={t('Download logs')}>
          <DialNeutralButton
            label={t('Download')}
            size={ButtonSize.Small}
            onClick={() => downloadApplicationLogs(applicationLogs)}
            data-qa="application-download-logs"
            disabled={isLogsLoading}
            iconBefore={
              <IconDownload
                className={classNames(isLogsLoading && 'button-secondary')}
                size={18}
              />
            }
          />
        </Tooltip>
      )}
    </div>
  );
};

const ApplicationLogsView = () => {
  const dispatch = useAppDispatch();

  const handleClose = useCallback(() => {
    dispatch(ApplicationActions.setLogsEntityId());
  }, [dispatch]);

  return (
    <Modal
      portalId="theme-main"
      state
      dataQa="marketplace-application-logs"
      containerClassName="group/modal flex w-full flex-col min-h-[350px] xl:max-w-[820px] max-w-[800px]"
      onClose={handleClose}
    >
      <LogsHeader />
      <LogsView />
      <LogsFooter />
    </Modal>
  );
};

export const ApplicationLogs = withRenderWhen(
  ApplicationSelectors.selectLogsEntityId,
)(ApplicationLogsView);
