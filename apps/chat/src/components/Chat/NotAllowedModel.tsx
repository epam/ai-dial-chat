import { IconExclamationCircle } from '@tabler/icons-react';
import { FC, useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { NotAllowedItem } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

const ICON_SIZE = 24;
const BUTTON_CLASS_NAME =
  'underline underline-offset-2 hover:text-accent-primary transition-colors';
const INTERNAL_CLICK_MARKER = '__INTERNAL_CLICK_ACTION_MARKER__';

interface NotAllowedModelProps {
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onShowChangeModel: (conversationId: string) => void;
  notAllowedItemsForDisplay: NotAllowedItem[];
}

interface ErrorMessageContentProps {
  items: NotAllowedItem[];
  onChangeModel: (id: string) => void;
}

const ErrorMessageContent: FC<ErrorMessageContentProps> = ({
  items,
  onChangeModel,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const handleChangeModel = useCallback(
    (itemId: string) => {
      onChangeModel(itemId);
    },
    [onChangeModel],
  );

  if (!items?.length) return null;

  if (items.length === 1) {
    const [item] = items;
    const messageWithMarker = t('chat.error.agent-not-available', {
      click: INTERNAL_CLICK_MARKER,
      agentId: ` "${item.agentName}" `,
    });
    const [beforeText, afterText] = messageWithMarker.split(
      INTERNAL_CLICK_MARKER,
    );

    return (
      <>
        {beforeText && <span>{beforeText}</span>}
        <button
          onClick={() => handleChangeModel(item.conversationId)}
          className={BUTTON_CLASS_NAME}
        >
          {t('change the agent')}
        </button>
        {afterText && <span>{afterText}</span>}
      </>
    );
  }

  const messageParts = t('chat.error.agents-not-available').split(
    '{{agentId}}',
  );
  const [firstItem, secondItem] = items;

  return (
    <>
      {messageParts[0] && <span>{messageParts[0]}</span>}
      <button
        onClick={() => handleChangeModel(firstItem.conversationId)}
        className={BUTTON_CLASS_NAME}
      >
        {` "${firstItem.agentName}" `}
      </button>
      {messageParts[1] && <span>{messageParts[1]}</span>}
      {items.length > 1 && (
        <>
          <button
            onClick={() => handleChangeModel(secondItem.conversationId)}
            className={BUTTON_CLASS_NAME}
          >
            {` "${secondItem.agentName}" `}
          </button>
          {messageParts[2] && <span>{messageParts[2]}</span>}
        </>
      )}
    </>
  );
};

export const NotAllowedModel: FC<NotAllowedModelProps> = ({
  showScrollDownButton,
  onScrollDownClick,
  onShowChangeModel,
  notAllowedItemsForDisplay,
}) => {
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  if (!notAllowedItemsForDisplay?.length) return null;

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
          <ErrorMessageContent
            items={notAllowedItemsForDisplay}
            onChangeModel={onShowChangeModel}
          />
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
