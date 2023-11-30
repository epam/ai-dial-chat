import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { SharedByMeFilters } from '@/src/utils/app/folders';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { ConversationView } from '../Chatbar/components/Conversation';

import { SharingType } from './ShareModal';

interface Props {
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function SharedByMeModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation('sidebar');
  const dispatch = useAppDispatch();
  const selectedConversationsIds = new Set(
    useAppSelector(ConversationsSelectors.selectSelectedConversationsIds),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      SharedByMeFilters.filterItem,
      false,
      searchTerm,
    ),
  );

  useEffect(() => setSearchTerm(''), [isOpen]);

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

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSearchTerm(e.target.value);
  }, []);

  if (!isOpen) return null;

  return (
    <FloatingPortal id="theme-main">
      <FloatingOverlay
        lockScroll
        className="z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70  md:p-5"
      >
        <FloatingFocusManager context={context} initialFocus={inputRef}>
          <form
            noValidate
            className="relative inline-block h-[348px] w-full max-w-[424px] rounded bg-gray-100 p-6 text-left dark:bg-gray-700"
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
            <div className="flex h-full flex-col gap-2">
              <h4 className="max-h-[50px] flex-none text-base font-semibold">
                <span className="line-clamp-2 break-words">
                  {t('Shared by me')}
                </span>
              </h4>
              <div className="relative mt-2 flex-none">
                <input
                  ref={inputRef}
                  placeholder={
                    t('Search by conversation name') ||
                    'Search by conversation name'
                  }
                  type="text"
                  className="w-full gap-2 truncate rounded border border-gray-400 bg-gray-100 p-3 pr-10 outline-none placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-700"
                  onChange={handleChange}
                  value={searchTerm}
                />
              </div>
              <div className="min-h-0 flex-auto flex-col overflow-y-auto">
                {conversations.map((item) => (
                  <button
                    className={classNames(
                      'group flex h-[34px] w-full cursor-pointer items-center gap-2 rounded border-l-2 px-3 transition-colors duration-200 hover:bg-green/15',
                      selectedConversationsIds.has(item.id)
                        ? 'border-l-green bg-green/15'
                        : 'border-l-transparent',
                    )}
                    key={item.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dispatch(
                        ConversationsActions.selectConversations({
                          conversationIds: [item.id],
                        }),
                      );
                    }}
                  >
                    <ConversationView conversation={item} isHighlited={selectedConversationsIds.has(item.id)}/>
                  </button>
                ))}
                {!conversations.length && <div>No items</div>}
              </div>
            </div>
          </form>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}
