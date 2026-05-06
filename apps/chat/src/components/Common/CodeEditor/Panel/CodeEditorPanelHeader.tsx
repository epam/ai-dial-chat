import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import MoveRightIcon from '@/public/images/icons/move-right.svg';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

interface CodeEditorPanelHeaderProps {
  isSidebarOpen: boolean;
  isFullScreen: boolean;
  onSidebarToggle: () => void;
  onFullScreenToggle: () => void;
}

export const CodeEditorPanelHeader = ({
  isSidebarOpen,
  isFullScreen,
  onSidebarToggle,
  onFullScreenToggle,
}: CodeEditorPanelHeaderProps) => {
  const { t } = useTranslation(Translation.Chat);

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  return (
    <div
      className={classNames(
        'flex w-full shrink-0',
        isSidebarOpen ? 'justify-end' : 'justify-between',
      )}
    >
      {!isSidebarOpen && (
        <div className="flex w-fit border-r border-tertiary px-3 py-2">
          <DialGhostIconButton
            tooltipProps={{
              tooltip: t(ChatI18nKeys.ShowFileList),
              isTriggerClickable: true,
              triggerClassName: 'mr-auto',
            }}
            size={ElementSize.Small}
            onClick={onSidebarToggle}
            icon={<MoveRightIcon size={DEFAULT_ICON_SIZES.SMALL} />}
          />
        </div>
      )}

      <div className="flex w-fit border-l border-tertiary px-3 py-2">
        <DialGhostIconButton
          tooltipProps={{
            tooltip: t(
              isFullScreen
                ? ChatI18nKeys.Minimize
                : ChatI18nKeys.FullScreenLabel,
            ),
          }}
          size={ElementSize.Small}
          onClick={(e) => {
            onFullScreenToggle();
            dispatchMouseLeaveEvent(e);
          }}
          icon={<FullScreenIcon size={DEFAULT_ICON_SIZES.SMALL} />}
        />
      </div>
    </div>
  );
};
