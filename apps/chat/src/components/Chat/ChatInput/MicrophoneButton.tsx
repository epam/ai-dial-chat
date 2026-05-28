import { IconMicrophone } from '@tabler/icons-react';
import { MouseEvent, forwardRef, useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  error: string | null;
  disabled?: boolean;
}

export const MicrophoneButton = forwardRef<HTMLButtonElement, Props>(
  (
    { isRecording, onStartRecording, onStopRecording, error, disabled },
    ref,
  ) => {
    const { t } = useTranslation(Translation.Chat);
    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

    const handleClick = useCallback(() => {
      if (isRecording) {
        onStopRecording();
      } else {
        onStartRecording();
      }
    }, [isRecording, onStartRecording, onStopRecording]);

    // Prevent browser context menu on long-press (mobile), which would interrupt recording
    const handleContextMenu = useCallback((e: MouseEvent) => {
      e.preventDefault();
    }, []);

    const tooltipText = error
      ? t(ChatI18nKeys[error as keyof typeof ChatI18nKeys] || error)
      : isRecording
        ? t(ChatI18nKeys.StopRecording)
        : t(ChatI18nKeys.ClickToRecord);

    return (
      <DialButton
        ref={ref}
        className={classNames(
          'absolute max-h-[24px] !px-0 text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable',
          isOverlay ? 'bottom-2 end-3' : 'bottom-2.5 end-4 md:bottom-3',
          isRecording && 'z-20',
        )}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        disabled={disabled || !!error}
        data-qa="voice-record"
        aria-label={tooltipText}
        iconBefore={
          <Tooltip tooltip={tooltipText} isTriggerClickable>
            <IconMicrophone
              size={DEFAULT_ICON_SIZES.STANDARD}
              stroke="1.5"
              className={classNames(
                'shrink-0',
                isRecording
                  ? 'animate-pulse text-error'
                  : disabled || error
                    ? 'text-controls-disable'
                    : 'text-secondary hover:text-accent-primary',
              )}
            />
          </Tooltip>
        }
      />
    );
  },
);

MicrophoneButton.displayName = 'MicrophoneButton';
