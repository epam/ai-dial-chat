import {
  IconPlaystationSquare,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  ModelsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Spinner } from '@/src/components/Common/Spinner';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  onSend: () => void;
  isDisabled: boolean;
  isLastMessageError: boolean;
  tooltip?: string;
  isLoading?: boolean;
  microphoneButtonHidden?: boolean;
}

export const SendMessageButton = Inversify.register(
  'SendMessageButton',
  ({
    isLastMessageError,
    onSend,
    isDisabled,
    tooltip,
    isLoading,
    microphoneButtonHidden,
  }: Props) => {
    const { t } = useTranslation(Translation.Chat);

    const areModelsLoading = useAppSelector(
      ModelsSelectors.selectAreModelsLoading,
    );
    const isOptimisticDefaultModelLoad = useAppSelector(
      SettingsSelectors.selectIsOptimisticDefaultModelLoad,
    );
    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

    const messageIsStreaming = useAppSelector(
      ConversationsSelectors.selectIsConversationsStreaming,
    );

    const isLastAssistantMessageEmpty = useAppSelector(
      ConversationsSelectors.selectIsLastAssistantMessageEmpty,
    );

    const canRecordAudio = useAppSelector(
      ConversationsSelectors.selectCanRecordAudio,
    );

    const rightClass =
      canRecordAudio && !isLastMessageError && !microphoneButtonHidden
        ? isOverlay
          ? 'end-10'
          : 'end-11'
        : isOverlay
          ? 'end-3'
          : 'end-4';

    if (
      isLastMessageError ||
      (isLastAssistantMessageEmpty && !messageIsStreaming)
    ) {
      return (
        <DialButton
          className={classNames(
            'max-h-[24px] !px-0 text-secondary hover:text-accent-primary',
            isLastMessageError && 'text-error',
          )}
          aria-label={t(ChatI18nKeys.SendAMessage)}
          onClick={onSend}
          data-qa="regenerate"
          tooltipProps={{
            tooltip: tooltip,
            isTriggerClickable: true,
            triggerClassName: classNames(
              'absolute max-h-[24px]',
              isOverlay ? 'bottom-2' : 'bottom-2.5 md:bottom-3',
              rightClass,
            ),
          }}
          iconBefore={
            <IconRefresh size={DEFAULT_ICON_SIZES.STANDARD} stroke="1.5" />
          }
        />
      );
    }

    // On the optimistic fast path the default model is already usable, so the
    // models listing still loading must not turn the send button into a spinner.
    const isSpinner =
      isLoading || (areModelsLoading && !isOptimisticDefaultModelLoad);
    const [Icon, dataQa, disabled] = messageIsStreaming
      ? [IconPlaystationSquare, 'stop-generating', false]
      : [IconSend, 'send', isDisabled];

    return (
      <DialButton
        className="max-h-[24px] !px-0 text-secondary hover:text-accent-primary disabled:text-controls-disable"
        onClick={onSend}
        disabled={disabled}
        data-qa={dataQa}
        aria-label={t(ChatI18nKeys.SendAMessage)}
        tooltipProps={{
          hideTooltip: !disabled && !messageIsStreaming,
          tooltip,
          isTriggerClickable: true,
          triggerClassName: classNames(
            'absolute max-h-[24px]',
            isOverlay ? 'bottom-2' : 'bottom-2.5 md:bottom-3',
            rightClass,
          ),
        }}
        iconBefore={
          isSpinner ? (
            <Spinner size={20} />
          ) : (
            <Icon size={DEFAULT_ICON_SIZES.STANDARD} stroke="1.5" />
          )
        }
      />
    );
  },
);
