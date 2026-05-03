import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

interface CodeEditorSidebarHeaderProps {
  onToggle: () => void;
}

export const CodeEditorSidebarHeader = ({
  onToggle,
}: CodeEditorSidebarHeaderProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex w-fit shrink-0 border-r border-tertiary px-3 py-2">
      <DialGhostIconButton
        tooltipProps={{
          tooltip: t(ChatI18nKeys.HideFileList),
          isTriggerClickable: true,
        }}
        size={ElementSize.Small}
        onClick={onToggle}
        icon={<MoveLeftIcon size={DEFAULT_ICON_SIZES.SMALL} />}
      />
    </div>
  );
};
