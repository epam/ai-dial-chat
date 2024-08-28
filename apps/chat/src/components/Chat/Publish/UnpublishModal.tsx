import { ClipboardEvent, MouseEvent, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getAttachments } from '@/src/utils/app/share';
import { ApiUtils } from '@/src/utils/server/api';

import { Entity } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import Modal from '../../Common/Modal';
import Tooltip from '../../Common/Tooltip';
import { PublicationItemsList } from './PublicationItemsList';

interface Props {
  subtitle: string;
  entity: Entity;
  entities: Entity[];
  isOpen: boolean;
  type: SharingType;
  onClose: () => void;
}

export function UnpublishModal({
  entity,
  entities,
  isOpen,
  onClose,
  type,
  subtitle,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const files = useAppSelector((state) =>
    getAttachments(type)(state, entity.id),
  );

  const [unpublishRequestName, setUnpublishRequestName] = useState('');

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onClose();
    },
    [onClose],
  );

  const handleUnpublish = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dispatch(
        PublicationActions.deletePublication({
          name: unpublishRequestName.trim(),
          targetFolder: `${getFolderIdFromEntityId(entity.id).split('/').slice(1).join('/')}/`,
          resources: [
            ...entities.map((entity) => ({ targetUrl: entity.id })),
            ...files.map((f) => ({
              sourceUrl: ApiUtils.decodeApiUrl(f.id),
              targetUrl: ApiUtils.decodeApiUrl(f.id),
            })),
          ],
        }),
      );

      onClose();
    },
    [dispatch, entities, entity.id, files, onClose, unpublishRequestName],
  );

  return (
    <Modal
      portalId="theme-main"
      containerClassName="unpublish-modal flex min-h-[579px] md:h-[747px] sm:w-[525px] w-full"
      dataQa="unpublish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
    >
      <div className="flex w-full flex-col overflow-y-auto">
        <div className="px-3 py-4 md:pl-4 md:pr-10">
          <input
            autoFocus
            onChange={(e) => setUnpublishRequestName(e.target.value)}
            value={unpublishRequestName}
            placeholder={t('chat.publish.unpublish_request_name.text') ?? ''}
            className="w-full bg-transparent text-base font-semibold outline-none"
          />
        </div>
        <h5 className="px-3 text-secondary-bg-dark md:px-6">{subtitle}</h5>
        <div className="flex grow flex-col overflow-y-auto">
          <div className="overflow-y-scroll">
            <PublicationItemsList
              collapsibleSectionClassNames="!px-0"
              containerClassNames="px-3 md:px-6"
              type={type}
              entity={entity}
              entities={entities}
              path={''}
              files={files}
              publishAction={PublishActions.DELETE}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-primary px-3 py-4 md:px-6">
          <button
            className="button button-ghost button-medium"
            onClick={handleClose}
            data-qa="cancel"
          >
            {t('chat.publish.button.cancel.label')}
          </button>
          <Tooltip
            hideTooltip={!!unpublishRequestName.trim().length}
            tooltip={t('chat.publish.name_for_unpublish_request.text')}
          >
            <button
              className="button button-primary button-medium"
              onClick={handleUnpublish}
              data-qa="unpublish"
              disabled={!unpublishRequestName.trim().length}
            >
              {t('chat.publish.button.unpublish.label')}
            </button>
          </Tooltip>
        </div>
      </div>
    </Modal>
  );
}
