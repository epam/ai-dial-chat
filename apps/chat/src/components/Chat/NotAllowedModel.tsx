import { IconExclamationCircle } from '@tabler/icons-react';
import { useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

interface Props {
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onShowChangeModel: (conversationId: string) => void;
  notAllowedItemsForDisplay: {
    id: string;
    displayName: string;
  }[];
}

const ICON_SIZE = 24;
const BUTTON_CLASS_NAME = 'underline underline-offset-2';
const INTERNAL_CLICK_MARKER = '__INTERNAL_CLICK_ACTION_MARKER__';

export const NotAllowedModel: React.FC<Props> = ({
  showScrollDownButton,
  onScrollDownClick,
  onShowChangeModel,
  notAllowedItemsForDisplay: items,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const handleShowChangeModel = useCallback(
    (itemId: string) => {
      onShowChangeModel(itemId);
    },
    [onShowChangeModel],
  );

  if (!items || items.length === 0) {
    return null;
  }

  let errorContent: JSX.Element | null = null;

  if (items.length === 1 && items[0]) {
    const agentIdWithQuotes = ` "${items[0].displayName}" `;

    const messageWithMarker = t('chat.error.agent-not-available', {
      click: INTERNAL_CLICK_MARKER,
      agentId: agentIdWithQuotes,
    });
    const parts = messageWithMarker.split(INTERNAL_CLICK_MARKER);

    errorContent = (
      <>
        {parts[0] && <span>{parts[0]}</span>}
        <button
          onClick={() => handleShowChangeModel(items[0].id)}
          className={BUTTON_CLASS_NAME}
        >
          {t('change the agent')}
        </button>
        {parts[1] && <span>{parts[1]}</span>}
      </>
    );
  } else if (items.length >= 2) {
    const rawMessageWithPlaceholders = t('chat.error.agents-not-available');
    const messageParts = rawMessageWithPlaceholders.split('{{agentId}}');

    const item1 = items[0];
    const item2 = items[1];

    errorContent = (
      <>
        {messageParts[0] && <span>{messageParts[0]}</span>}
        {item1 && (
          <button
            onClick={() => handleShowChangeModel(item1.id)}
            className={BUTTON_CLASS_NAME}
          >
            {` "${item1.displayName}" `}
          </button>
        )}
        {messageParts[1] && <span>{messageParts[1]}</span>}
        {item2 && (
          <button
            onClick={() => handleShowChangeModel(item2.id)}
            className={BUTTON_CLASS_NAME}
          >
            {` "${item2.displayName}" `}
          </button>
        )}
        {messageParts[2] && <span>{messageParts[2]}</span>}
      </>
    );
  }

  return (
    <div
      className={classNames(
        'flex w-full flex-col items-center justify-center p-2 md:px-4 lg:px-6',
        { 'lg:pl-20 lg:pr-[84px]': isChatFullWidth },
      )}
    >
      <div
        className={classNames(
          'relative flex w-full items-center gap-2 rounded border border-error bg-error p-3 text-sm',
          { 'lg:max-w-3xl': !isChatFullWidth },
        )}
        data-qa="not-allowed-model-error"
      >
        <IconExclamationCircle
          size={ICON_SIZE}
          className="mt-0.5 shrink-0 text-error"
        />
        <span className="flex flex-wrap items-start gap-x-1 break-words">
          {errorContent}
        </span>
        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-16 right-0 text-primary md:-top-20"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
    </div>
  );
};
