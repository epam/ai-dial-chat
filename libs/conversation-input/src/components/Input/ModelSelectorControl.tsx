import {
  DeploymentItem,
  mergeClasses,
  SELECT_LIST_MAX_HEIGHT_PX,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  GhostIconButton,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { type CSSProperties, type FC, ReactNode, useState } from 'react';
import { CONVERSATION_INPUT_CLASS } from '../../constants/public-class-names';
import { useModelSelector } from '../../hooks/useModelSelector';
import type { ModelMenuStyles, ModelSelectorLabels } from '../../models/Input';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ModelSelectorBottomSheet } from '../ModelSelectorBottomSheet/ModelSelectorBottomSheet';
import styles from './Input.module.scss';

interface Props {
  deployments?: DeploymentItem[];
  selectedDeploymentId?: string | null;
  onDeploymentChange?: (id: string) => void;
  modelSelectorLabels?: ModelSelectorLabels;
  /** Host styling hooks for the menu panel, search row and deployment rows. */
  menuStyles?: ModelMenuStyles;
  isStreaming: boolean;
  isMobile: boolean;
  /**
   * When `true`, the control renders dimmed and does not open — the current
   * model stays visible. Only this prop (and `isStreaming`) blocks the
   * selector: a disabled composer input never does, so the user can always
   * switch model.
   */
  isDisabled?: boolean;
  style: CSSProperties;
  modelPickerOverlay?: (onClose: () => void) => ReactNode;
  /** Whether the model picker popover is open (controlled from Input). */
  isPickerOpen?: boolean;
  /** Toggles the model picker popover open/closed. */
  onPickerToggle?: () => void;
  /** Called by Dropdown when open state changes (e.g. outside click). */
  onPickerOpenChange?: (open: boolean) => void;
}

/** Model-selector control: desktop dropdown or mobile bottom sheet, depending on viewport. */
export const ModelSelectorControl: FC<Props> = ({
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  menuStyles,
  isStreaming,
  isMobile,
  isDisabled = false,
  style,
  modelPickerOverlay,
  isPickerOpen,
  onPickerToggle,
  onPickerOpenChange,
}) => {
  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);

  const {
    selectorIcon,
    selectorAriaLabel,
    selectedLabel,
    selectedVersion,
    menuItems,
    menuHeader,
    menuStyle,
    onOpenChange: handleModelSelectorOpenChange,
  } = useModelSelector({
    deployments,
    selectedDeploymentId,
    onDeploymentChange,
    modelSelectorLabels,
    styles: menuStyles,
  });

  if (!deployments) {
    return null;
  }

  const disabledIconClassName =
    isStreaming || isDisabled
      ? 'pointer-events-none opacity-50 cursor-not-allowed'
      : undefined;

  const caretIcon = (
    <IconChevronDown
      size={DIAL_ICON_SIZE.SM}
      className={mergeClasses(
        styles.modelSelectorCaret,
        CONVERSATION_INPUT_CLASS.modelSelectorCaret,
      )}
      aria-hidden
      stroke={DIAL_KIT_ICON_STROKE}
    />
  );

  /*
   * The icon comes from `DeploymentIcon`, which takes no class of its own, so
   * the host styling hook needs a wrap. It is layout-neutral: the icon is a
   * fixed-size, non-shrinking box in all three presentations.
   */
  const iconNode = (
    <span
      className={mergeClasses(
        'flex shrink-0 items-center',
        CONVERSATION_INPUT_CLASS.modelSelectorIcon,
      )}
    >
      {selectorIcon}
    </span>
  );

  if (isMobile) {
    return (
      <>
        <GhostIconButton
          tooltipProps={{ tooltip: selectedLabel }}
          icon={
            <div className="flex items-center gap-1">
              {iconNode}
              {caretIcon}
            </div>
          }
          aria-label={selectorAriaLabel}
          onClick={() => {
            if (!isDisabled) setIsModelSheetOpen(true);
          }}
          className={mergeClasses(
            'w-[50px]',
            styles.modelSelectorButton,
            disabledIconClassName,
            CONVERSATION_INPUT_CLASS.modelSelectorButton,
          )}
        />
        {modelPickerOverlay ? (
          <BottomSheetShell
            isOpen={isModelSheetOpen}
            title={modelSelectorLabels?.ariaLabel ?? 'Select model'}
            closeLabel={modelSelectorLabels?.closeLabel ?? 'Close'}
            onClose={() => setIsModelSheetOpen(false)}
            style={style}
            className={mergeClasses(
              menuStyles?.className,
              CONVERSATION_INPUT_CLASS.modelMenu,
            )}
          >
            {modelPickerOverlay(() => setIsModelSheetOpen(false))}
          </BottomSheetShell>
        ) : (
          <ModelSelectorBottomSheet
            isOpen={isModelSheetOpen}
            title={modelSelectorLabels?.ariaLabel ?? 'Select model'}
            closeLabel={modelSelectorLabels?.closeLabel ?? 'Close'}
            searchPlaceholder={
              modelSelectorLabels?.searchPlaceholder ?? 'Search'
            }
            onClose={() => setIsModelSheetOpen(false)}
            deployments={deployments}
            selectedDeploymentId={selectedDeploymentId}
            onSelect={(id) => onDeploymentChange?.(id)}
            loadingLabel={modelSelectorLabels?.loading}
            errorLabel={modelSelectorLabels?.error}
            emptyLabel={modelSelectorLabels?.empty}
            style={style}
            menuStyles={menuStyles}
          />
        )}
      </>
    );
  }

  if (modelPickerOverlay) {
    const chipTooltip = selectedVersion
      ? `${selectedLabel} · ${selectedVersion}`
      : selectedLabel;

    return (
      <Dropdown
        placement="top-end"
        matchReferenceWidth={false}
        open={isPickerOpen}
        onOpenChange={onPickerOpenChange}
        trigger={[]}
        outsideClosable
        renderOverlay={() =>
          modelPickerOverlay(() => onPickerOpenChange?.(false))
        }
        listClassName={mergeClasses(
          '!w-[368px] !bg-layer-raised',
          menuStyles?.className,
          CONVERSATION_INPUT_CLASS.modelMenu,
        )}
      >
        <Tooltip tooltip={chipTooltip}>
          <button
            type="button"
            aria-label={selectorAriaLabel}
            aria-disabled={isDisabled || undefined}
            className={mergeClasses(
              'flex min-w-0 items-center gap-1.5 rounded-full py-1.5 pe-2 ps-1.5',
              styles.modelSelectorButton,
              disabledIconClassName,
              isDisabled && styles.modelSelectorButtonDisabled,
              CONVERSATION_INPUT_CLASS.modelSelectorButton,
            )}
            onClick={() => {
              if (!isStreaming && !isDisabled) {
                onPickerToggle?.();
              }
            }}
          >
            {iconNode}
            <span className="flex min-w-0 max-w-[180px] items-baseline gap-1">
              <span
                className={mergeClasses(
                  'dial-small-text max-w-[180px] shrink-0 truncate',
                  styles.modelSelectorName,
                )}
              >
                {selectedLabel}
              </span>
              {selectedVersion && (
                <span
                  className={mergeClasses(
                    'dial-tiny-text min-w-0 truncate',
                    styles.modelSelectorVersion,
                  )}
                >
                  {selectedVersion}
                </span>
              )}
            </span>
            {caretIcon}
          </button>
        </Tooltip>
      </Dropdown>
    );
  }

  return (
    <div
      className={mergeClasses(isDisabled && disabledIconClassName)}
      aria-disabled={isDisabled || undefined}
    >
      <Dropdown
        items={menuItems}
        menuHeader={menuHeader}
        placement="bottom-end"
        matchReferenceWidth={false}
        /* The design's maximum list length. `Dropdown` caps the whole panel
           rather than the options alone, so the sticky search row eats into
           it — unlike the kit's own `Select`, which scrolls the options
           inside a header that stays put. */
        maxDropdownHeight={SELECT_LIST_MAX_HEIGHT_PX}
        listClassName={mergeClasses(
          '!w-[240px]',
          menuStyles?.className,
          CONVERSATION_INPUT_CLASS.modelMenu,
        )}
        listStyle={menuStyle}
        disabled={isDisabled}
        onOpenChange={isDisabled ? undefined : handleModelSelectorOpenChange}
      >
        <Tooltip tooltip={selectedLabel}>
          <button
            type="button"
            aria-label={selectorAriaLabel}
            aria-disabled={isDisabled || undefined}
            className={mergeClasses(
              'flex items-center gap-1 rounded-full p-1.5',
              styles.modelSelectorButton,
              isDisabled && styles.modelSelectorButtonDisabled,
              CONVERSATION_INPUT_CLASS.modelSelectorButton,
            )}
          >
            {iconNode}
            {caretIcon}
          </button>
        </Tooltip>
      </Dropdown>
    </div>
  );
};
