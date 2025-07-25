import { Icon } from '@tabler/icons-react';
import { ReactNode } from 'react';

import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  ModelsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface NavigationButtonProps {
  onClick: () => void;
  Icon: Icon;
  selected?: boolean;
  tooltip?: ReactNode;
  dataQa?: string;
  caption?: string;
  rounded?: boolean;
  allowClickSelected?: boolean;
}

export const NavigationButton = ({
  onClick,
  Icon,
  selected,
  tooltip,
  dataQa,
  caption,
  rounded = false,
  allowClickSelected = false,
}: NavigationButtonProps) => {
  const isLoading = useAppSelector(ModelsSelectors.selectAreModelsLoading);
  const streaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const disabled = isLoading || streaming;
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isClickAllowed = (!selected || allowClickSelected) && !disabled;
  return (
    <Tooltip
      tooltip={tooltip}
      isTriggerClickable
      triggerClassName={classNames(
        'flex shrink-0 select-none rounded transition-colors duration-200 md:min-w-min',
        rounded && 'rounded-full border border-transparent',
        rounded && selected && '!border-accent-primary',
        isOverlay ? 'max-h-[36px] min-w-[44px]' : 'max-h-[52px] min-w-[72px]',
        isOverlay && rounded && 'md:my-0',
        disabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:bg-accent-primary-alpha active:bg-accent-primary-alpha',
      )}
    >
      <button
        data-qa={dataQa}
        onClick={isClickAllowed ? onClick : undefined}
        className={classNames(
          'flex size-full flex-col items-center justify-center gap-[2px]',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          !isOverlay ? (rounded ? 'md:p-[9px]' : 'md:p-[10px]') : 'md:p-1',
        )}
        aria-selected={selected}
      >
        <Icon
          className={classNames(
            'min-h-[24px] min-w-[24px]',
            selected ? 'text-accent-primary' : 'text-secondary',
          )}
          width={24}
          height={24}
          size={24}
        />

        {!isOverlay && (
          <span
            className={classNames(
              'text-xs leading-[15px] md:hidden',
              selected ? 'text-accent-primary' : 'text-secondary',
            )}
            data-qa="caption"
          >
            {caption}
          </span>
        )}
      </button>
    </Tooltip>
  );
};
