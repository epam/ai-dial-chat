import { ClipboardEvent, MouseEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getAttachments } from '@/src/utils/app/share';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import Modal from '../../Common/Modal';
import { PublicationItemsList } from './PublicationItemsList';

import compact from 'lodash-es/compact';
import flatMapDeep from 'lodash-es/flatMapDeep';

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
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const files = useAppSelector((state) =>
    getAttachments(type)(state, entity.id),
  );

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

      const mappedFiles =
        type === SharingType.Conversation ||
        type === SharingType.ConversationFolder
          ? (entities as Conversation[])
              .filter((c) =>
                (c.playback?.messagesStack || c.messages).some(
                  (m) => m.custom_content?.attachments,
                ),
              )
              .flatMap((c) => {
                const urls = compact(
                  flatMapDeep(c.playback?.messagesStack || c.messages, (m) =>
                    m.custom_content?.attachments?.map((a) => a.url),
                  ),
                );

                return urls.map((oldUrl) => ApiUtils.decodeApiUrl(oldUrl));
              })
          : [];

      dispatch(
        PublicationActions.deletePublication({
          targetFolder: `${getFolderIdFromEntityId(entity.id).split('/').slice(1).join('/')}/`,
          resources: [
            ...entities.map((entity) => ({ targetUrl: entity.id })),
            ...files.reduce<{ sourceUrl: string; targetUrl: string }[]>(
              (acc, file) => {
                const decodedFileId = ApiUtils.decodeApiUrl(file.id);
                const url = mappedFiles.find((id) => id === decodedFileId);

                if (url) {
                  acc.push({
                    sourceUrl: decodedFileId,
                    targetUrl: url,
                  });
                }

                return acc;
              },
              [],
            ),
          ],
        }),
      );

      onClose();
    },
    [dispatch, entities, entity.id, onClose, type],
  );

  return (
    <Modal
      portalId="theme-main"
      containerClassName="h-full py-4 align-bottom transition-all !max-h-[434px] sm:w-[424px] w-full"
      dataQa="unpublish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
    >
      <div className="flex h-full flex-col">
        <h4 className="px-6 text-base font-semibold">
          <span className="line-clamp-2 break-words">
            {`${t('Unpublish')}: ${entity.name.trim()}`}
          </span>
        </h4>
        <h5 className="mb-4 mt-2 px-6 text-secondary">{subtitle}</h5>
        <div className="flex h-full flex-col justify-between gap-4 divide-y divide-tertiary">
          <div className="max-h-[250px] overflow-scroll">
            <PublicationItemsList
              collapsibleSectionClassNames="!px-0"
              containerClassNames="px-6"
              type={type}
              entity={entity}
              entities={entities}
              path={''}
              files={files}
              publishAction={PublishActions.DELETE}
            />
          </div>
          <div className="flex justify-end gap-3 px-6 pt-4">
            <button
              className="button button-secondary"
              onClick={handleClose}
              data-qa="cancel"
            >
              {t('Cancel')}
            </button>
            <button
              className="button button-primary"
              onClick={handleUnpublish}
              data-qa="unpublish"
              autoFocus
            >
              {t('Unpublish')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
