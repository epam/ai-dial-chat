import { IconRefresh } from '@tabler/icons-react';

import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

interface Props {
  onRegenerate: () => void;
  isErrorButton: boolean;
  tooltip?: string;
}

export const RegenerateMessageButton = ({
  onRegenerate,
  tooltip,
  isErrorButton,
}: Props) => {
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  return (
    <button
      className={classNames(
        'absolute top-[calc(50%_-_12px)] rounded hover:text-accent-primary',
        isOverlay ? 'right-3' : 'right-4',
        isErrorButton && 'text-error',
      )}
      onClick={onRegenerate}
      data-qa="regenerate"
    >
      <Tooltip tooltip={tooltip} isTriggerClickable>
        <IconRefresh size={24} stroke="1.5" />
      </Tooltip>
    </button>
  );
};
