import { IconDownload, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { downloadApplicationLogs } from '@/src/utils/app/import-export';

import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { Spinner } from '@/src/components/Common/Spinner';

import { DialGhostIconButton, DialNeutralButton } from '@epam/ai-dial-ui-kit';

const view = withRenderWhen(ApplicationSelectors.selectLogsEntityId)(() => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const entityId = useAppSelector(ApplicationSelectors.selectLogsEntityId);
  const applicationLogs = useAppSelector(
    ApplicationSelectors.selectApplicationLogs,
  );
  const isLogsLoading = useAppSelector(
    ApplicationSelectors.selectIsLogsLoading,
  );

  const handleClose = useCallback(() => {
    dispatch(ApplicationActions.setLogsEntityId());
  }, [dispatch]);

  const uploadLogs = useCallback(
    () => dispatch(ApplicationActions.getLogs(entityId!)),
    [dispatch, entityId],
  );

  useEffect(() => {
    uploadLogs();
  }, [uploadLogs]);

  return (
    <Modal
      portalId="theme-main"
      state
      dataQa="marketplace-application-logs"
      containerClassName="group/modal flex w-full flex-col min-h-[350px] xl:max-w-[820px] max-w-[800px]"
      onClose={handleClose}
    >
      <div className="px-3 pb-4 pt-6 md:px-6">
        <h2 className="text-base font-semibold">
          {t(MarketplaceI18nKeys.ApplicationLogs)}
        </h2>
      </div>

      {isLogsLoading || !applicationLogs ? (
        <div className="flex w-full grow items-center justify-center p-4">
          {isLogsLoading ? (
            <Spinner size={30} className="mx-auto" />
          ) : (
            t(MarketplaceI18nKeys.NoLogsFound)
          )}
        </div>
      ) : (
        <div className="flex grow flex-col gap-1 overflow-y-auto break-all px-3 pb-6 md:px-6">
          <div className="flex flex-col gap-1">
            {applicationLogs.split('\n').map((log, index) => (
              <p key={index}>{log}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 divide-y-0 border-t border-tertiary px-3 py-4 md:px-6">
        <DialGhostIconButton
          tooltipProps={{ tooltip: t(MarketplaceI18nKeys.ReloadLogs) }}
          onClick={uploadLogs}
          data-qa="application-reload-logs"
          disabled={isLogsLoading}
          icon={<IconRefresh />}
        />
        {applicationLogs && (
          <DialNeutralButton
            tooltipProps={{ tooltip: t(MarketplaceI18nKeys.DownloadLogs) }}
            label={t(MarketplaceI18nKeys.Download)}
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
        )}
      </div>
    </Modal>
  );
});

export const ApplicationLogs = view;
