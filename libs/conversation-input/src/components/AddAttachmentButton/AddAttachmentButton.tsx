import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconPaperclip, IconPlus, IconSettings } from '@tabler/icons-react';
import {
  CSSProperties,
  type FC,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { ChatSettingsConfig } from '../../models/Input';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { ChatSettingsModal } from '../ChatSettingsModal/ChatSettingsModal';

/** A single item injected into the attachment menu by the host app. */
export interface ExtraMenuItem {
  /** Unique key for the item. */
  key: string;
  /** Display label. */
  label: string;
  /** Icon node rendered to the left of the label. */
  icon: ReactNode;
  /** Callback when the item is selected. */
  onClick: () => void;
}

/** Props for the AddAttachmentButton component. */
interface AddAttachmentButtonProps {
  /** Callback invoked when the user picks "Attach file". */
  onAttachClick: () => void;
  /** Label for the "Attach file" menu item. */
  attachLabel: string;
  /** Aria-label for the + trigger button. */
  addMenuLabel: string;
  /** Title shown in the mobile bottom sheet. */
  menuTitle: string;
  /** Close label for the mobile bottom sheet. */
  menuCloseLabel: string;
  /** CSS custom-property overrides forwarded to the mobile BottomSheet. */
  style?: CSSProperties;
  /** Width class applied to the desktop dropdown list. Defaults to `'!w-[240px]'`. */
  listClassName?: string;
  /** When `true`, the trigger button is disabled and the menu cannot open. */
  isDisabled?: boolean;
  /** When provided, adds a "Chat settings" item that opens the settings modal. */
  chatSettings?: ChatSettingsConfig;
  /** Additional menu items appended after "Attach file". */
  extraMenuItems?: ExtraMenuItem[];
}

export const AddAttachmentButton: FC<AddAttachmentButtonProps> = ({
  onAttachClick,
  attachLabel,
  addMenuLabel,
  menuTitle,
  menuCloseLabel,
  style,
  listClassName = '!w-[240px] shadow-md',
  isDisabled = false,
  chatSettings,
  extraMenuItems,
}) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);

  const menuItems = useMemo(
    () => [
      {
        key: 'attach',
        label: attachLabel,
        icon: <IconPaperclip size={BASE_ICON_SIZE} aria-hidden />,
        onClick: onAttachClick,
      },
      ...(extraMenuItems ?? []),
      ...(chatSettings != null
        ? [
            {
              key: 'chat-settings',
              label: chatSettings.menuItemLabel ?? 'Chat settings',
              icon: <IconSettings size={BASE_ICON_SIZE} aria-hidden />,
              onClick: () => setIsChatSettingsOpen(true),
            },
          ]
        : []),
    ],
    [attachLabel, onAttachClick, chatSettings, extraMenuItems],
  );

  return (
    <>
      {isMobile ? (
        <>
          <DialGhostIconButton
            icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
            aria-label={addMenuLabel}
            className={mergeClasses(
              'size-10 flex-shrink-0',
              isDisabled && 'pointer-events-none opacity-50',
            )}
            onClick={() => setIsSheetOpen(true)}
          />
          <BottomSheet
            isOpen={isSheetOpen}
            title={menuTitle}
            closeLabel={menuCloseLabel}
            onClose={() => setIsSheetOpen(false)}
            style={style}
            items={menuItems}
          />
        </>
      ) : (
        <DialDropdown
          matchReferenceWidth={false}
          placement="bottom-start"
          listClassName={listClassName}
          items={menuItems}
        >
          <DialGhostIconButton
            icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
            aria-label={addMenuLabel}
            className="size-10 flex-shrink-0"
            disabled={isDisabled}
          />
        </DialDropdown>
      )}
      {chatSettings != null && isChatSettingsOpen && (
        <ChatSettingsModal
          features={chatSettings.features}
          initialSystemPrompt={chatSettings.systemPrompt}
          initialTemperature={chatSettings.temperature}
          onSave={chatSettings.onSave}
          onClose={() => setIsChatSettingsOpen(false)}
          title={chatSettings.title}
          systemPromptLabel={chatSettings.systemPromptLabel}
          systemPromptTooltip={chatSettings.systemPromptTooltip}
          temperatureLabel={chatSettings.temperatureLabel}
          temperatureLabels={chatSettings.temperatureLabels}
          temperatureHint={chatSettings.temperatureHint}
          saveLabel={chatSettings.saveLabel}
        />
      )}
    </>
  );
};
