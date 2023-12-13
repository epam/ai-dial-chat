import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconCheck, IconCopy, IconX } from '@tabler/icons-react';
import {
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { getShareActionByType } from '@/src/utils/app/share';

import { ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';

import Tooltip from '../Common/Tooltip';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  entity: ShareEntity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ entity, isOpen, onClose, type }: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const shareAction = getShareActionByType(type);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [urlWasCopied, setUrlWasCopied] = useState(false);
  const shareId = useRef(uuidv4());
  const url = `${window?.location.origin}/share/${shareId.current}`;
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

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

  const handleCopy = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(url).then(() => {
        setUrlCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setUrlCopied(false);
        }, 2000);
        if (!urlWasCopied) {
          setUrlWasCopied(true);
          dispatch(
            shareAction({ id: entity.id, shareUniqueId: shareId.current }),
          );
        }
      });
    },
    [dispatch, entity.id, shareAction, url, urlWasCopied],
  );

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <FloatingPortal id="theme-main">
      <FloatingOverlay
        lockScroll
        className="z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5"
      >
        <FloatingFocusManager context={context} initialFocus={copyButtonRef}>
          <form
            noValidate
            className="relative inline-block max-h-full w-full max-w-[424px] rounded bg-gray-100 p-6 text-left dark:bg-gray-700"
            role="dialog"
            ref={refs.setFloating}
            {...getFloatingProps()}
            data-qa="share-modal"
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
                <Tooltip tooltip={entity.name.trim()}>
                  <span className="line-clamp-2 break-words">
                    {`${t('Share')}: ${entity.name.trim()}`}
                  </span>
                </Tooltip>
              </h4>
              <p className="text-sm text-gray-500">
                {t('share.modal.link.description')}
              </p>
              <p className="text-sm text-gray-500">
                {t('share.modal.link', { context: type })}
              </p>
              <div className="relative mt-2">
                <Tooltip tooltip={url}>
                  <input
                    type="text"
                    readOnly
                    className="w-full gap-2 truncate rounded border border-gray-400 bg-gray-100 p-3 pr-10 outline-none dark:border-gray-600 dark:bg-gray-700"
                    onCopyCapture={handleCopy}
                    value={url}
                  />
                </Tooltip>
                <div className="absolute right-3 top-3">
                  {urlCopied ? (
                    <Tooltip tooltip={t('Copied!')}>
                      <IconCheck size={20} className="text-gray-500" />
                    </Tooltip>
                  ) : (
                    <Tooltip tooltip={t('Copy URL')}>
                      <button
                        className="outline-none"
                        onClick={handleCopy}
                        ref={copyButtonRef}
                      >
                        <IconCopy
                          height={20}
                          width={20}
                          className="text-gray-500 hover:text-blue-500"
                        />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </form>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}
