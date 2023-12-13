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

import { Translation } from '@/src/types/translation';

import Tooltip from '../Common/Tooltip';

import { v4 as uuidv4 } from 'uuid';

export enum SharingType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
}

interface Entity {
  id: string;
  name: string;
}

interface Props {
  entity: Entity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
  onShare: (shareId: string) => void;
}

export default function ShareModal({
  entity,
  isOpen,
  onClose,
  onShare,
  type,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);
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
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLDivElement>) => {
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
          onShare(shareId.current);
        }
      });
    },
    [onShare, shareId, url, urlWasCopied],
  );

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <FloatingPortal id="theme-main">
      <FloatingOverlay
        lockScroll
        className="bg-gray-900/30 z-50 flex items-center justify-center p-3 md:p-5"
      >
        <FloatingFocusManager context={context} initialFocus={copyButtonRef}>
          <form
            noValidate
            className="bg-gray-100 relative inline-block max-h-full w-full max-w-[424px] rounded p-6 text-left"
            role="dialog"
            ref={refs.setFloating}
            {...getFloatingProps()}
            data-qa="share-modal"
          >
            <button
              type="button"
              role="button"
              className="hover:text-blue-700 absolute right-2 top-2 rounded text-secondary"
              onClick={handleClose}
            >
              <IconX height={24} width={24} />
            </button>
            <div className="flex flex-col justify-between gap-2">
              <h4 className=" max-h-[50px] text-base font-semibold">
                <span className="line-clamp-2 break-words">
                  {`${t('Share')}: ${entity.name.trim()}`}
                </span>
              </h4>
              <p className="text-sm text-secondary">
                {t('share.modal.link.description')}
              </p>
              <p className="text-sm text-secondary">
                {t('share.modal.link', { context: type })}
              </p>
              <div className="relative mt-2">
                <input
                  type="text"
                  readOnly
                  className="border-gray-400 bg-gray-100 w-full gap-2 truncate rounded border p-3 pr-10 outline-none"
                  onCopyCapture={handleCopy}
                  value={url}
                />
                <div className="absolute right-3 top-3">
                  {urlCopied ? (
                    <Tooltip tooltip={t('Copied!')}>
                      <IconCheck size={20} className="text-secondary" />
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
                          className="hover:text-blue-500 text-secondary"
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
