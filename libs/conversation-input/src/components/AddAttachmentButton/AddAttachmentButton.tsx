import {
  buildCssVars,
  mergeClasses,
  ResponseFormat,
  type ToolMenuItem,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  Dropdown,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronRight,
  IconPaperclip,
  IconPlus,
  IconPrompt,
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
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ChatSettingsBottomSheet } from '../ChatSettingsBottomSheet/ChatSettingsBottomSheet';
import { ChatSettingsModal } from '../ChatSettingsModal/ChatSettingsModal';
import { ToolsBottomSheet } from '../ToolsBottomSheet/ToolsBottomSheet';
import styles from './AddAttachmentButton.module.scss';

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
  /**
   * When provided, adds a "Prompts" item above "Chat settings" whose submenu
   * (desktop flyout / mobile bottom sheet) renders this host-owned overlay.
   * Receives a callback the overlay calls to close its own submenu, and, on
   * desktop only, a second callback to return to the main attachment menu
   * (the overlay replaces it there, so it needs its own back affordance).
   */
  promptsMenuOverlay?: (onClose: () => void, onBack?: () => void) => ReactNode;
  /** Label for the "Prompts" menu item and mobile sheet title. Defaults to `'Prompts'`. */
  promptsMenuTitle?: string;
  /** Accessible label for the back arrow in the mobile prompts bottom sheet. Defaults to `'Back'`. */
  promptsBackLabel?: string;
  /** Color overrides. */
  colors?: AddAttachmentButtonColors;
}

/** Color overrides for `AddAttachmentButton`, applied as CSS custom properties with app theme fallbacks. */
export interface AddAttachmentButtonColors {
  /** Checkmark icon color for a selected tool in the Tools submenu. Fallback: `--text-accent`. */
  selectedToolIcon?: string;
  /** Icon color for each tool row in the Tools submenu. Fallback: `--text-secondary`. */
  toolIcon?: string;
  /** Chevron icon color on the mobile "Tools"/"Chat settings" rows. Fallback: `--text-secondary`. */
  chevronIcon?: string;
}

/** "+" trigger button that opens an attachment/settings menu (desktop dropdown or mobile bottom sheet). */
export const AddAttachmentButton: FC<AddAttachmentButtonProps> = ({
  onAttachClick,
  attachLabel,
  addMenuTitle,
  menuTitle,
  menuCloseLabel,
  style,
  listClassName = 'w-[240px]',
  isDisabled = false,
  chatSettings,
  extraMenuItems,
  toolsMenuItems = [],
  onToolToggle,
  toolsMenuTitle = 'Tools',
  toolsBackLabel = 'Back',
  promptsMenuOverlay,
  promptsMenuTitle = 'Prompts',
  promptsBackLabel = 'Back',
  colors,
}) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false);
  const [isPromptsSheetOpen, setIsPromptsSheetOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isPromptsOverlayOpen, setIsPromptsOverlayOpen] = useState(false);

  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--aab-selected-tool-icon': colors?.selectedToolIcon,
        '--aab-tool-icon': colors?.toolIcon,
        '--aab-chevron-icon': colors?.chevronIcon,
      }),
    [colors?.selectedToolIcon, colors?.toolIcon, colors?.chevronIcon],
  );

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
                style={cssVars}
                className={styles.selectedToolIcon}
                aria-hidden
              />
            )}
          </span>
        ),
        icon: (
          <span
            style={cssVars}
            className={mergeClasses('flex items-center', styles.toolIcon)}
          >
            {item.icon}
          </span>
        ),
        onClick: () => onToolToggle?.(item.id),
      })),
    [toolsMenuItems, onToolToggle, cssVars],
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
                        style={cssVars}
                        className={mergeClasses(
                          'rtl:scale-x-[-1]',
                          styles.chevronIcon,
                        )}
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
      ...(promptsMenuOverlay != null
        ? [
            {
              key: 'prompts',
              label: promptsMenuTitle,
              icon: <IconPrompt size={BASE_ICON_SIZE} aria-hidden />,
              onClick: isMobile
                ? () => {
                    setIsPromptsSheetOpen(true);
                    setIsSheetOpen(false);
                  }
                : () => {
                    setIsDesktopMenuOpen(false);
                    setIsPromptsOverlayOpen(true);
                  },
              iconAfter: isMobile ? (
                <IconChevronRight
                  size={BASE_ICON_SIZE}
                  stroke={1.5}
                  style={cssVars}
                  className={mergeClasses(
                    'rtl:scale-x-[-1]',
                    styles.chevronIcon,
                  )}
                  aria-hidden
                />
              ) : null,
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
                  style={cssVars}
                  className={mergeClasses(
                    'rtl:scale-x-[-1]',
                    styles.chevronIcon,
                  )}
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
      promptsMenuOverlay,
      promptsMenuTitle,
      cssVars,
    ],
  );

  if (menuItems.length === 0) return null;

  const desktopTrigger = (
    <Dropdown
      matchReferenceWidth={false}
      placement="bottom-start"
      listClassName={listClassName}
      items={menuItems}
      open={promptsMenuOverlay != null ? isDesktopMenuOpen : undefined}
      onOpenChange={
        promptsMenuOverlay != null ? setIsDesktopMenuOpen : undefined
      }
    >
      <GhostIconButton
        icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
        aria-label={addMenuTitle}
        tooltipProps={{ tooltip: addMenuTitle }}
        disabled={isDisabled}
      />
    </Dropdown>
  );

  /*
   * `promptsMenuOverlay` renders rich, multi-row content, which does not fit
   * inside the main Dropdown's per-item `children` flyout (each nested item
   * is forced into a fixed-height, truncating button by the ui-kit).
   * Instead it opens as its own top-level `Dropdown` — the same
   * `renderOverlay` mechanism `ModelSelectorControl` uses for
   * `modelPickerOverlay` — anchored around the same trigger, which gets the
   * standard rounded/background/shadow chrome for free.
   */
  const desktopMenu =
    promptsMenuOverlay != null ? (
      <Dropdown
        matchReferenceWidth={false}
        placement="bottom-start"
        trigger={[]}
        open={isPromptsOverlayOpen}
        onOpenChange={setIsPromptsOverlayOpen}
        renderOverlay={() =>
          promptsMenuOverlay(
            () => setIsPromptsOverlayOpen(false),
            () => {
              setIsPromptsOverlayOpen(false);
              setIsDesktopMenuOpen(true);
            },
          )
        }
      >
        {desktopTrigger}
      </Dropdown>
    ) : (
      desktopTrigger
    );

  return (
    <>
      {isMobile ? (
        <>
          <GhostIconButton
            icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
            aria-label={addMenuTitle}
            size={ElementSize.Large}
            tooltipProps={{ tooltip: addMenuTitle }}
            disabled={isDisabled}
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
          {promptsMenuOverlay != null && (
            <BottomSheetShell
              isOpen={isPromptsSheetOpen}
              title={promptsMenuTitle}
              closeLabel={menuCloseLabel}
              onBack={() => {
                setIsPromptsSheetOpen(false);
                setIsSheetOpen(true);
              }}
              backLabel={promptsBackLabel}
              onClose={() => setIsPromptsSheetOpen(false)}
              style={style}
            >
              {promptsMenuOverlay(() => setIsPromptsSheetOpen(false))}
            </BottomSheetShell>
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
          {desktopMenu}

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
