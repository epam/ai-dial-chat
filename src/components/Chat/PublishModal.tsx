import { ClipboardEvent, MouseEvent, useCallback, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import { getPublishActionByType } from '@/src/utils/app/share';

import { ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';

import Modal from '../Common/Modal';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  entity: ShareEntity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function PublishModal({ entity, isOpen, onClose, type }: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const publishAction = getPublishActionByType(type);
  const shareId = useRef(uuidv4());

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onClose();
    },
    [onClose],
  );

  const handlePublish = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dispatch(
        publishAction({ id: entity.id, shareUniqueId: shareId.current }),
      );
      onClose();
    },
    [dispatch, entity.id, onClose, publishAction],
  );

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block h-[747px] min-w-[550px] max-w-[1100px] p-6"
      dataQA="publish-modal"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="flex h-full flex-col justify-between gap-2">
        <h4 className=" max-h-[50px] text-base font-semibold">
          <span className="line-clamp-2 break-words">
            {`${t('Publication request for')}: ${entity.name.trim()}`}
          </span>
        </h4>
        <div className="flex justify-end gap-3">
          <button
            className="button button-secondary"
            onClick={handleClose}
            data-qa="cancel"
          >
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
            onClick={handlePublish}
            data-qa="publish"
            autoFocus
          >
            {t('Send request')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
