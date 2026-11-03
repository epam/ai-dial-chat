import {
  buildCssVars,
  mergeClasses,
  ResponseFormat,
  type ToolMenuItem,
  useIsMobile,
  useIsPhone,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  GhostIconButton,
  MenuItemMark,
  MenuItem,
  DropdownTrigger,
  DropdownOverlayRole,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconMicrophone,
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
  type KeyboardEvent,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import type { ChatSettingsConfig, MenuOverlayConfig } from '../../models/Input';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ChatSettingsBottomSheet } from '../ChatSettingsBottomSheet/ChatSettingsBottomSheet';
import { ChatSettingsModal } from '../ChatSettingsModal/ChatSettingsModal';
import { ToolsBottomSheet } from '../ToolsBottomSheet/ToolsBottomSheet';
import styles from './AddAttachmentButton.module.scss';

const focusMenuItem = (
  event: KeyboardEvent,
  refs: (HTMLButtonElement | null)[],
) => {
  const nodes = refs.filter((node) => node?.isConnected && !node.disabled);
  const index = nodes.findIndex((node) => node === event.target);
  if (index < 0) return;
  let next = index;
  if (event.key === 'ArrowDown') next = (index + 1) % nodes.length;
  else if (event.key === 'ArrowUp')
    next = (index - 1 + nodes.length) % nodes.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = nodes.length - 1;
  else return;
  event.preventDefault();
  event.stopPropagation();
  nodes[next]?.focus();
};

/* Own the active submenu through the public Dropdown composition API so its
 * state survives replacing the desktop menu with phone sheets. */
const AttachmentSubmenu = ({
  item,
  open,
  onOpenChange,
  items,
  renderOverlay,
  triggerRef,
}: {
  triggerRef?: (node: HTMLButtonElement | null) => void;
  item: DropdownItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: DropdownItem[];
  renderOverlay?: () => ReactNode;
}) => {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isRtl, setIsRtl] = useState(false);
  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={[DropdownTrigger.Click, DropdownTrigger.Hover]}
      placement={isRtl ? 'left-start' : 'right-start'}
      matchReferenceWidth={false}
      overlayRole={DropdownOverlayRole.None}
      renderOverlay={() => (
        <div
          role="menu"
          onKeyDown={(event) => {
            focusMenuItem(event, itemRefs.current);
            const rtl =
              getComputedStyle(event.currentTarget).direction === 'rtl';
            if (
              event.key === 'Escape' ||
              (items && event.key === (rtl ? 'ArrowRight' : 'ArrowLeft'))
            ) {
              event.preventDefault();
              event.stopPropagation();
              onOpenChange(false);
            }
          }}
        >
          {items
            ? items.map((entry, index) => (
                <MenuItem
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  key={entry.key}
                  role="menuitemcheckbox"
                  aria-checked={entry.checked}
                  selected={entry.checked}
                  mark={entry.mark}
                  label={entry.label}
                  icon={entry.icon}
                  onClick={(event) =>
                    entry.onClick?.({ key: entry.key, domEvent: event })
                  }
                />
              ))
            : renderOverlay?.()}
        </div>
      )}
    >
      <MenuItem
        ref={(node) => {
          triggerRef?.(node);
          if (node) setIsRtl(getComputedStyle(node).direction === 'rtl');
        }}
        role="menuitem"
        aria-haspopup="menu"
        label={item.label}
        icon={item.icon}
        onKeyDown={(event) => {
          const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
          if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        trailing={
          <IconChevronRight
            size={BASE_ICON_SIZE}
            stroke={DIAL_KIT_ICON_STROKE}
            className="rtl:scale-x-[-1]"
            aria-hidden
          />
        }
      />
    </Dropdown>
  );
};

/** A single item injected into the attachment menu by the host app. */
interface ExtraMenuItem {
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
  /** Starts recording an audio attachment immediately, before the settings item. */
  onRecordVoice?: () => void;
  /** Label for the audio recording item. Defaults to 'Record voice'. */
  recordVoiceLabel?: string;
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
  /** Width class applied to the desktop dropdown list. Defaults to `'w-[240px]'`. */
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
   * Host-injected overlay entries, rendered as menu items between the
   * "Tools" item and "Chat settings", in array order. Each item's submenu
   * (desktop flyout / mobile stacked bottom sheet) renders the entry's
   * host-owned overlay. On desktop this is a real nested `Dropdown` submenu
   * (through controlled `Dropdown` composition) that stays open alongside the main attachment
   * menu, mirroring how the "Tools" item's submenu behaves. Each overlay's
   * `renderOverlay` receives a callback to close the whole menu once
   * selection is complete.
   */
  menuOverlays?: MenuOverlayConfig[];
  /**
   * Called to read the host's textarea caret position when a `menuOverlays`
   * entry opens, forwarded as that entry's `renderOverlay`'s second
   * argument. Absent (or returning `undefined`) reports `0`.
   */
  getCaretPosition?: () => number;
  /** Color overrides. */
  colors?: AddAttachmentButtonColors;
}

/** Color overrides for `AddAttachmentButton`, applied as CSS custom properties with app theme fallbacks. */
interface AddAttachmentButtonColors {
  /** Icon color for each tool row in the Tools submenu. Fallback: `--text-secondary`. */
  toolIcon?: string;
  /** Chevron icon color on the mobile "Tools"/"Chat settings" rows. Fallback: `--text-secondary`. */
  chevronIcon?: string;
}

/** "+" trigger button that opens an attachment/settings menu (desktop dropdown or mobile bottom sheet). */
export const AddAttachmentButton: FC<AddAttachmentButtonProps> = ({
  onAttachClick,
  onRecordVoice,
  recordVoiceLabel = 'Record voice',
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
  menuOverlays,
  getCaretPosition,
  colors,
}) => {
  const isMobile = useIsMobile();
  const isPhone = useIsPhone();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const desktopInitialFocusRef = useRef<0 | -1>(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false);
  const [openMenuOverlayKey, setOpenMenuOverlayKey] = useState<string | null>(
    null,
  );
  const handleMenuOpenChange = useCallback((open: boolean) => {
    if (open) desktopInitialFocusRef.current = 0;
    setIsMenuOpen(open);
    if (!open) {
      setIsToolsSheetOpen(false);
      setOpenMenuOverlayKey(null);
    }
  }, []);

  const previousPhoneRef = useRef(isPhone);
  useEffect(() => {
    if (previousPhoneRef.current === isPhone) return;
    previousPhoneRef.current = isPhone;
    if (isPhone) {
      setIsSheetOpen(
        isMenuOpen && !isToolsSheetOpen && openMenuOverlayKey === null,
      );
      setIsMenuOpen(false);
    } else {
      desktopInitialFocusRef.current =
        isToolsSheetOpen || openMenuOverlayKey !== null ? -1 : 0;
      setIsMenuOpen(
        isSheetOpen || isToolsSheetOpen || openMenuOverlayKey !== null,
      );
      setIsSheetOpen(false);
    }
  }, [isPhone, isMenuOpen, isSheetOpen, isToolsSheetOpen, openMenuOverlayKey]);

  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--aab-tool-icon': colors?.toolIcon,
        '--aab-chevron-icon': colors?.chevronIcon,
      }),
    [colors?.toolIcon, colors?.chevronIcon],
  );

  const hasTools = toolsMenuItems.length > 0 && onToolToggle != null;

  const toolsSubmenuChildren = useMemo(
    () =>
      toolsMenuItems.map((item) => ({
        key: item.id,
        label: item.label,
        icon: (
          <span
            style={cssVars}
            className={mergeClasses('flex items-center', styles.toolIcon)}
          >
            {item.icon}
          </span>
        ),
        selectable: true,
        mark: MenuItemMark.Check,
        checked: item.isSelected,
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
              icon: (
                <IconPaperclip
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
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
              icon: (
                <IconTool
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              onClick: isPhone
                ? () => {
                    setIsToolsSheetOpen(true);
                  }
                : () => undefined,
              ...(isPhone
                ? {
                    iconAfter: (
                      <IconChevronRight
                        size={BASE_ICON_SIZE}
                        stroke={DIAL_KIT_ICON_STROKE}
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
                    renderSubmenuTrigger: (
                      item: DropdownItem,
                      index: number,
                    ) => (
                      <AttachmentSubmenu
                        triggerRef={(node) => {
                          menuItemRefs.current[index] = node;
                        }}
                        item={item}
                        open={isToolsSheetOpen}
                        onOpenChange={(open) => {
                          setIsToolsSheetOpen(open);
                          if (open) setOpenMenuOverlayKey(null);
                        }}
                        items={toolsSubmenuChildren}
                      />
                    ),
                  }),
            },
          ]
        : []),
      ...(menuOverlays ?? []).map((overlay) => ({
        key: overlay.key,
        label: overlay.title,
        icon: overlay.icon,
        onClick: isPhone
          ? () => {
              setOpenMenuOverlayKey(overlay.key);
            }
          : () => undefined,
        ...(isPhone
          ? {
              iconAfter: (
                <IconChevronRight
                  size={BASE_ICON_SIZE}
                  stroke={DIAL_KIT_ICON_STROKE}
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
              renderSubmenuTrigger: (item: DropdownItem, index: number) => (
                <AttachmentSubmenu
                  triggerRef={(node) => {
                    menuItemRefs.current[index] = node;
                  }}
                  item={item}
                  open={openMenuOverlayKey === overlay.key}
                  onOpenChange={(open) => {
                    setOpenMenuOverlayKey(open ? overlay.key : null);
                    if (open) setIsToolsSheetOpen(false);
                  }}
                  renderOverlay={() =>
                    overlay.renderOverlay(
                      () => handleMenuOpenChange(false),
                      getCaretPosition?.() ?? 0,
                    )
                  }
                />
              ),
            }),
      })),
      ...(onRecordVoice != null
        ? [
            {
              key: 'record-voice',
              label: recordVoiceLabel,
              icon: (
                <IconMicrophone
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              onClick: () => {
                handleMenuOpenChange(false);
                onRecordVoice();
              },
            },
          ]
        : []),
      ...(chatSettings != null
        ? [
            {
              key: 'chat-settings',
              label: chatSettings.menuItemLabel ?? 'Chat settings',
              icon: (
                <IconSettings
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              iconAfter: isMobile ? (
                <IconChevronRight
                  size={BASE_ICON_SIZE}
                  stroke={DIAL_KIT_ICON_STROKE}
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
      handleMenuOpenChange,
      attachLabel,
      onAttachClick,
      onRecordVoice,
      recordVoiceLabel,
      chatSettings,
      extraMenuItems,
      isMobile,
      isPhone,
      hasTools,
      isToolsSheetOpen,
      openMenuOverlayKey,
      toolsMenuTitle,
      toolsSubmenuChildren,
      menuOverlays,
      getCaretPosition,
      cssVars,
    ],
  );

  if (menuItems.length === 0) return null;

  const desktopTrigger = (
    <Dropdown
      matchReferenceWidth={false}
      placement="bottom-start"
      listClassName={listClassName}
      overlayContentClassName="flex flex-col gap-1"
      initialFocus={desktopInitialFocusRef.current}
      overlayRole={DropdownOverlayRole.None}
      renderOverlay={() => (
        <div
          role="menu"
          className="flex flex-col gap-1"
          onKeyDown={(event) => {
            focusMenuItem(event, menuItemRefs.current);
          }}
        >
          {menuItems.map((item, index) =>
            'renderSubmenuTrigger' in item && item.renderSubmenuTrigger ? (
              <div key={item.key}>{item.renderSubmenuTrigger(item, index)}</div>
            ) : (
              <MenuItem
                key={item.key}
                ref={(node) => {
                  menuItemRefs.current[index] = node;
                }}
                role="menuitem"
                label={item.label}
                icon={item.icon}
                onClick={() => {
                  item.onClick?.();
                  handleMenuOpenChange(false);
                }}
              />
            ),
          )}
        </div>
      )}
      disabled={isDisabled}
      open={isMenuOpen}
      onOpenChange={handleMenuOpenChange}
    >
      <GhostIconButton
        icon={
          <IconPlus
            size={DIAL_ICON_SIZE.LG}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        }
        aria-label={addMenuTitle}
        aria-haspopup="menu"
        tooltipProps={{ tooltip: addMenuTitle }}
        disabled={isDisabled}
      />
    </Dropdown>
  );

  return (
    <>
      {isPhone ? (
        <>
          <GhostIconButton
            icon={
              <IconPlus
                size={DIAL_ICON_SIZE.LG}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            aria-label={addMenuTitle}
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
              onClose={() => handleMenuOpenChange(false)}
              closeLabel={menuCloseLabel}
              style={style}
              title={toolsMenuTitle}
              items={toolsMenuItems}
              onToolToggle={onToolToggle}
            />
          )}
          {menuOverlays?.map((overlay) => (
            <BottomSheetShell
              key={overlay.key}
              isOpen={openMenuOverlayKey === overlay.key}
              title={overlay.title}
              closeLabel={menuCloseLabel}
              onBack={() => {
                setOpenMenuOverlayKey(null);
                setIsSheetOpen(true);
              }}
              backLabel={overlay.backLabel ?? 'Back'}
              onClose={() => handleMenuOpenChange(false)}
              style={style}
            >
              {/*
               * The same `role="menu"` container the desktop submenu panel
               * provides, so an overlay's `menuitem` rows sit inside a menu in
               * both presentations.
               */}
              <div role="menu" aria-label={overlay.title}>
                {overlay.renderOverlay(
                  () => handleMenuOpenChange(false),
                  getCaretPosition?.() ?? 0,
                )}
              </div>
            </BottomSheetShell>
          ))}
        </>
      ) : (
        <>{desktopTrigger}</>
      )}
      {isMobile && chatSettings != null && (
        <ChatSettingsBottomSheet
          isOpen={isChatSettingsOpen}
          onBack={() => {
            setIsChatSettingsOpen(false);
            if (isPhone) setIsSheetOpen(true);
            else setIsMenuOpen(true);
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
          responseFormatMarkdownLabel={chatSettings.responseFormatMarkdownLabel}
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
      {!isMobile && chatSettings != null && isChatSettingsOpen && (
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
          responseFormatMarkdownLabel={chatSettings.responseFormatMarkdownLabel}
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
          colors={chatSettings.modalColors}
        />
      )}
    </>
  );
};
