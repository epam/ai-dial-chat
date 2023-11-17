import {
    FloatingFocusManager,
    FloatingOverlay,
    FloatingPortal,
    useDismiss,
    useFloating,
    useInteractions,
} from '@floating-ui/react';
import {
    MouseEvent,
    useCallback,
    useRef,
    useState
} from 'react';

import { useTranslation } from 'next-i18next';

import { IconCopy, IconX } from '@tabler/icons-react';
import { IconCheck } from '@tabler/icons-react';

export enum SharingType {
    Conversation = 'conversation',
    ConversationFolder = 'conversations_folder',
    Prompt = 'prompt',
    PromptFolder = 'prompts_folder'
}

interface Entity {
    id: string,
    name: string,
}

interface Props {
  entity: Entity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({
  entity,
  isOpen,
  onClose,
  type
}:Props) {
  const { t } = useTranslation('sidebar');
  const url = `http://localhost:3000/share/${entity.id}`; //TODO: generate some sharing id

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      onClose();
    },
  });
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onClose();
    },
    [onClose],
  );

  const handleCopy = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(url).then(() => {
        setUrlCopied(true);
        setTimeout(() => {
          setUrlCopied(false);
        }, 2000);
      });
    },
    [url],
  );

  return (
    <FloatingPortal id="theme-main">
      <FloatingOverlay
        lockScroll
        className="z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5"
      >
        <FloatingFocusManager context={context} initialFocus={copyButtonRef}>
          <form
            noValidate
            className="relative inline-block max-h-full w-full max-w-[424px] gap-4 rounded bg-gray-100 p-6 text-left dark:bg-gray-700"
            role="dialog"
            ref={refs.setFloating}
            {...getFloatingProps()}
            data-qa="prompt-modal"
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
                <h4 className=' max-h-[50px] text-base font-semibold'>
                    <span className='line-clamp-2 break-words'>{`${t('Share')}: ${entity.name.trim()}`}</span>
                </h4>
                <p className='text-sm'>
                    {t('share.modal.link.description')}
                </p>
                <p className='text-sm'>
                    {t(`share.modal.link.${type}`)}
                </p>
                <div className='relative mt-2'>
                    <div className='w-full gap-2 truncate rounded border border-gray-400 p-3 pr-10 dark:border-gray-600'>
                        {url}
                    </div>
                    <div className="absolute right-3 top-3">
                        {urlCopied ? (
                            <IconCheck size={20} className="text-gray-500" />
                        ) : (
                            <button className='outline-none' onClick={handleCopy} ref={copyButtonRef} autoFocus>
                                <IconCopy height={20} width={20} className='cursor-pointer text-gray-500 hover:text-blue-500'/>
                            </button>
                        )}
                    </div>
                </div>

            </div>

            <div className="flex justify-end">

            </div>
          </form>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
};
