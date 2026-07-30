import {
  mergeClasses,
  ResponseFormat,
  type ToolMenuItem,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronRight,
  IconPaperclip,
  IconPlus,
  IconSettings,
  IconTool,
} from '@tabler/icons-react';
import {
  CSSProperties,
  type FC,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import type { ChatSettingsConfig } from '../../models/Input';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { ChatSettingsBottomSheet } from '../ChatSettingsBottomSheet/ChatSettingsBottomSheet';
import { ChatSettingsModal } from '../ChatSettingsModal/ChatSettingsModal';
import { ToolsBottomSheet } from '../ToolsBottomSheet/ToolsBottomSheet';

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
  /** Callback invoked when the user picks "Attach file". When absent, the "Attach file" item is not rendered. */
  onAttachClick?: () => void;
  /** Label for the "Attach file" menu item. */
  attachLabel: string;
  /** Aria-label for the + trigger button. */
  addMenuTitle: string;
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
  /** When provided, adds a "Chat settings" item that opens the settings modal on desktop and a stacked bottom sheet on mobile. */
  chatSettings?: ChatSettingsConfig;
  /** Additional menu items appended after "Attach file". */
  extraMenuItems?: ExtraMenuItem[];
  /** Resolved tool toggle items to render in a "Tools" submenu. When empty or absent, no Tools item is shown. */
  toolsMenuItems?: ToolMenuItem[];
  /** Called when a tool row is toggled. Receives the tool id. */
  onToolToggle?: (toolId: string) => void;
  /** Label for the "Tools" menu item and mobile sheet title. Defaults to `'Tools'`. */
  toolsMenuTitle?: string;
  /** Accessible label for the back arrow in the mobile tools bottom sheet. Defaults to `'Back'`. */
  toolsBackLabel?: string;
}

/** "+" trigger button that opens an attachment/settings menu (desktop dropdown or mobile bottom sheet). */
export const AddAttachmentButton: FC<AddAttachmentButtonProps> = ({
  onAttachClick,
  attachLabel,
  addMenuTitle,
  menuTitle,
  menuCloseLabel,
  style,
  listClassName = 'cp-dropdown-overlay !w-[240px]',
  isDisabled = false,
  chatSettings,
  extraMenuItems,
  toolsMenuItems = [],
  onToolToggle,
  toolsMenuTitle = 'Tools',
  toolsBackLabel = 'Back',
}) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false);

  const hasTools = toolsMenuItems.length > 0 && onToolToggle != null;

  const toolsSubmenuChildren = useMemo(
    () =>
      toolsMenuItems.map((item) => ({
        key: item.id,
        label: (
          <span className="flex flex-1 items-center gap-2">
            <span className="flex-1">{item.label}</span>
            {item.isSelected && (
              <IconCheck
                size={BASE_ICON_SIZE}
                className="text-accent-primary"
                aria-hidden
              />
            )}
          </span>
        ),
        icon: (
          <span className="flex items-center text-secondary">{item.icon}</span>
        ),
        onClick: () => onToolToggle?.(item.id),
      })),
    [toolsMenuItems, onToolToggle],
  );

  const menuItems = useMemo(
    () => [
      ...(onAttachClick != null
        ? [
            {
              key: 'attach',
              label: attachLabel,
              icon: <IconPaperclip size={BASE_ICON_SIZE} aria-hidden />,
              onClick: onAttachClick,
            },
          ]
        : []),
      ...(extraMenuItems ?? []),
      ...(hasTools
        ? [
            {
              key: 'tools',
              label: toolsMenuTitle,
              icon: <IconTool size={BASE_ICON_SIZE} aria-hidden />,
              onClick: isMobile
                ? () => {
                    setIsToolsSheetOpen(true);
                    setIsSheetOpen(false);
                  }
                : () => undefined,
              ...(isMobile
                ? {
                    iconAfter: (
                      <IconChevronRight
                        size={BASE_ICON_SIZE}
                        stroke={1.5}
                        className="text-secondary rtl:scale-x-[-1]"
                        aria-hidden
                      />
                    ),
                  }
                : {
                    children: toolsSubmenuChildren,
                  }),
            },
          ]
        : []),
      ...(chatSettings != null
        ? [
            {
              key: 'chat-settings',
              label: chatSettings.menuItemLabel ?? 'Chat settings',
              icon: <IconSettings size={BASE_ICON_SIZE} aria-hidden />,
              iconAfter: isMobile ? (
                <IconChevronRight
                  size={BASE_ICON_SIZE}
                  stroke={1.5}
                  className="text-secondary rtl:scale-x-[-1]"
                  aria-hidden
                />
              ) : null,
              onClick: () => setIsChatSettingsOpen(true),
            },
          ]
        : []),
    ],
    [
      attachLabel,
      onAttachClick,
      chatSettings,
      extraMenuItems,
      isMobile,
      hasTools,
      toolsMenuTitle,
      toolsSubmenuChildren,
    ],
  );

  if (menuItems.length === 0) return null;

  return (
    <>
      {isMobile ? (
        <>
          <DialGhostIconButton
            icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
            aria-label={addMenuTitle}
            tooltipProps={{ tooltip: addMenuTitle }}
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
            className="pb-4"
            btnTextClassName="flex-1"
          />
          {hasTools && (
            <ToolsBottomSheet
              isOpen={isToolsSheetOpen}
              onBack={() => {
                setIsToolsSheetOpen(false);
                setIsSheetOpen(true);
              }}
              backLabel={toolsBackLabel}
              onClose={() => setIsToolsSheetOpen(false)}
              closeLabel={menuCloseLabel}
              style={style}
              title={toolsMenuTitle}
              items={toolsMenuItems}
              onToolToggle={onToolToggle}
            />
          )}
          {chatSettings != null && (
            <ChatSettingsBottomSheet
              isOpen={isChatSettingsOpen}
              onBack={() => {
                setIsChatSettingsOpen(false);
                setIsSheetOpen(true);
              }}
              backLabel={chatSettings.backLabel ?? 'Back'}
              onClose={() => setIsChatSettingsOpen(false)}
              closeLabel={menuCloseLabel}
              style={style}
              features={chatSettings.features}
              initialResponseFormat={
                chatSettings.responseFormat ?? ResponseFormat.Markdown
              }
              initialSystemPrompt={chatSettings.systemPrompt}
              initialTemperature={chatSettings.temperature}
              onSave={chatSettings.onSave}
              title={chatSettings.title}
              responseFormatLabel={chatSettings.responseFormatLabel}
              responseFormatHint={chatSettings.responseFormatHint}
              responseFormatMarkdownLabel={
                chatSettings.responseFormatMarkdownLabel
              }
              responseFormatPlainTextLabel={
                chatSettings.responseFormatPlainTextLabel
              }
              systemPromptLabel={chatSettings.systemPromptLabel}
              systemPromptTooltip={chatSettings.systemPromptTooltip}
              temperatureLabel={chatSettings.temperatureLabel}
              temperatureLabels={chatSettings.temperatureLabels}
              temperatureHint={chatSettings.temperatureHint}
              saveLabel={chatSettings.saveLabel}
              saveDisabledTooltip={chatSettings.saveDisabledTooltip}
            />
          )}
        </>
      ) : (
        <>
          <DialDropdown
            matchReferenceWidth={false}
            placement="bottom-start"
            listClassName={listClassName}
            items={menuItems}
          >
            <DialGhostIconButton
              icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
              aria-label={addMenuTitle}
              tooltipProps={{ tooltip: addMenuTitle }}
              className="size-10 flex-shrink-0"
              disabled={isDisabled}
            />
          </DialDropdown>

          {chatSettings != null && isChatSettingsOpen && (
            <ChatSettingsModal
              features={chatSettings.features}
              initialResponseFormat={
                chatSettings.responseFormat ?? ResponseFormat.Markdown
              }
              initialSystemPrompt={chatSettings.systemPrompt}
              initialTemperature={chatSettings.temperature}
              onSave={chatSettings.onSave}
              onClose={() => setIsChatSettingsOpen(false)}
              title={chatSettings.title}
              responseFormatLabel={chatSettings.responseFormatLabel}
              responseFormatHint={chatSettings.responseFormatHint}
              responseFormatMarkdownLabel={
                chatSettings.responseFormatMarkdownLabel
              }
              responseFormatPlainTextLabel={
                chatSettings.responseFormatPlainTextLabel
              }
              systemPromptLabel={chatSettings.systemPromptLabel}
              systemPromptTooltip={chatSettings.systemPromptTooltip}
              temperatureLabel={chatSettings.temperatureLabel}
              temperatureLabels={chatSettings.temperatureLabels}
              temperatureHint={chatSettings.temperatureHint}
              saveLabel={chatSettings.saveLabel}
              saveDisabledTooltip={chatSettings.saveDisabledTooltip}
            />
          )}
        </>
      )}
    </>
  );
};
