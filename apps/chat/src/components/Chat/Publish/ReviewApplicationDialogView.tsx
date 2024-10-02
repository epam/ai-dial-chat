import { Fragment } from 'react';

import { useTranslation } from 'next-i18next';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { PublicationControls } from './PublicationChatControls';

export function ReviewApplicationDialogView() {
  const { t } = useTranslation(Translation.Chat);

  const application = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const controlsEntity = application
    ? {
        id: ApiUtils.decodeApiUrl(application.id),
        name: application.name,
        folderId: getFolderIdFromEntityId(application.id),
      }
    : null;

  return (
    <>
      <div className="flex flex-col gap-2 overflow-auto px-3 py-4 text-sm md:p-6">
        <div className="flex justify-between">
          <h2 className="text-base font-semibold">{t('Application')}</h2>
        </div>
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">{t('Name: ')}</span>
          <span className="max-w-[414px] text-primary">
            {application?.name}
          </span>
        </div>
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">{t('Version: ')}</span>
          <span className="max-w-[414px] text-primary">
            {application?.version}
          </span>
        </div>
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">{t('Icon: ')}</span>
          {application && (
            <ModelIcon
              entity={application}
              entityId={application.id}
              size={60}
            />
          )}
        </div>
        {application?.description && (
          <div className="flex gap-4">
            <span className="w-[122px] text-secondary">
              {t('Description: ')}
            </span>
            <span className="max-w-[414px] text-primary">
              {application?.description}
            </span>
          </div>
        )}
        {application?.features &&
          Object.keys(application?.features).length !== 0 && (
            <div className="flex gap-4">
              <span className="w-[122px] text-secondary">
                {t('Features data:')}
              </span>
              <div className="flex flex-col justify-start break-all">
                {'{'}
                <div className="max-w-[414px] whitespace-pre-wrap leading-5 text-primary">
                  {Object.entries(application?.features || {}).map(
                    ([key, value], index, array) => (
                      <Fragment key={key}>
                        {`"${key}" : "${value}"${index !== array.length - 1 ? ',\n' : ''}`}
                      </Fragment>
                    ),
                  )}
                </div>
                {'}'}
              </div>
            </div>
          )}
        {application?.inputAttachmentTypes &&
          application?.inputAttachmentTypes.length !== 0 && (
            <div className="flex gap-4">
              <span className="w-[122px] text-secondary">
                {t('Attachment types:')}
              </span>
              <div className="flex max-w-[414px] flex-wrap text-primary">
                {application?.inputAttachmentTypes.map((item) => (
                  <span
                    key={item}
                    className="m-1 h-[31] items-center justify-between gap-2 rounded bg-accent-primary-alpha px-2 py-1.5"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        {application?.maxInputAttachments && (
          <div className="flex gap-4">
            <span className="w-[122px] text-secondary">
              {t(' Max. attachments number:')}
            </span>
            <span className="max-w-[414px] text-primary">
              {application?.maxInputAttachments}
            </span>
          </div>
        )}
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">
            {t('Completion URL:')}
          </span>
          <span className="max-w-[414px] break-all text-primary">
            {application?.completionUrl}
          </span>
        </div>
      </div>
      <div className="flex w-full items-center justify-end border-t-[1px] border-tertiary px-3 py-4 md:px-5">
        {controlsEntity && (
          <PublicationControls
            entity={controlsEntity}
            controlsClassNames="text-sm"
          />
        )}
      </div>
    </>
  );
}
