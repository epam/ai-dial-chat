import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import { ClipboardEvent, MouseEvent, useCallback, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import { getUnpublishActionByType } from '@/src/utils/app/share';

import { Entity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  entity: Entity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function UnpublishModal({
  entity,
  isOpen,
  onClose,
  type,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const publishAction = getUnpublishActionByType(type);
  const shareId = useRef(uuidv4());

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      onClose();
    },
  });
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

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
    <FloatingPortal id="theme-main">
      <FloatingOverlay
        lockScroll
        className="z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5"
      >
        <FloatingFocusManager context={context}>
          <form
            noValidate
            className="relative inline-block max-h-full w-full max-w-[424px] rounded bg-gray-100 p-6 text-left dark:bg-gray-700"
            role="dialog"
            ref={refs.setFloating}
            {...getFloatingProps()}
            data-qa="publish-modal"
          >
            <button
              type="button"
              role="button"
              className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
              onClick={handleClose}
            >
              <IconX height={24} width={24} />
            </button>
            <div className="flex flex-col justify-between gap-2">
              <h4 className=" max-h-[50px] text-base font-semibold">
                <span className="line-clamp-2 break-words">
                  {`${t('Unpublish')}: ${entity.name.trim()}`}
                </span>
              </h4>
              <div className="flex gap-3">
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
                >
                  {t('Unpublish')}
                </button>
              </div>
            </div>
          </form>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}
