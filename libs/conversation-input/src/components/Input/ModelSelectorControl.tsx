import { DeploymentItem, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Dropdown,
  DialDropdownIcon,
  DialTooltip,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { type CSSProperties, type FC, ReactNode, useState } from 'react';
import { useModelSelector } from '../../hooks/useModelSelector';
import type { ModelSelectorLabels } from '../../models/Input';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ModelSelectorBottomSheet } from '../ModelSelectorBottomSheet/ModelSelectorBottomSheet';
import styles from './Input.module.scss';

interface Props {
  deployments?: DeploymentItem[];
  selectedDeploymentId?: string | null;
  onDeploymentChange?: (id: string) => void;
  modelSelectorLabels?: ModelSelectorLabels;
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
    menuItems,
    menuHeader,
    onOpenChange: handleModelSelectorOpenChange,
  } = useModelSelector({
    deployments,
    selectedDeploymentId,
    onDeploymentChange,
    modelSelectorLabels,
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
      className={styles.modelSelectorCaret}
      aria-hidden
    />
  );

  if (isMobile) {
    return (
      <>
        <DialTooltip tooltip={selectedLabel}>
          <GhostIconButton
            icon={
              <div className="flex items-center gap-1">
                {selectorIcon}
                {caretIcon}
              </div>
            }
            aria-label={selectorAriaLabel}
            onClick={() => {
              if (!isDisabled) setIsModelSheetOpen(true);
            }}
            className={mergeClasses(
              styles.modelSelectorButton,
              disabledIconClassName,
            )}
          />
        </DialTooltip>
        {modelPickerOverlay ? (
          <BottomSheetShell
            isOpen={isModelSheetOpen}
            title={modelSelectorLabels?.ariaLabel ?? 'Select model'}
            closeLabel={modelSelectorLabels?.closeLabel ?? 'Close'}
            onClose={() => setIsModelSheetOpen(false)}
            style={style}
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
          />
        )}
      </>
    );
  }

  if (modelPickerOverlay) {
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
        listClassName="cp-dropdown-overlay !w-[320px]"
      >
        <DialTooltip tooltip={selectedLabel}>
          <button
            type="button"
            aria-label={selectorAriaLabel}
            aria-disabled={isDisabled || undefined}
            className={mergeClasses(
              'flex items-center justify-center gap-1 rounded-full p-2',
              styles.modelSelectorButton,
              disabledIconClassName,
              isDisabled && styles.modelSelectorButtonDisabled,
            )}
            onClick={() => {
              if (!isStreaming && !isDisabled) {
                onPickerToggle?.();
              }
            }}
          >
            {selectorIcon}
            {caretIcon}
          </button>
        </DialTooltip>
      </Dropdown>
    );
  }

  return (
    <div
      className={mergeClasses(isDisabled && disabledIconClassName)}
      aria-disabled={isDisabled || undefined}
    >
      <DialTooltip tooltip={selectedLabel}>
        <DialDropdownIcon
          icon={selectorIcon}
          ariaLabel={selectorAriaLabel}
          items={menuItems}
          menuHeader={menuHeader}
          placement="bottom-end"
          matchReferenceWidth={false}
          listClassName="cp-dropdown-overlay !w-[240px] !max-h-80"
          onOpenChange={isDisabled ? undefined : handleModelSelectorOpenChange}
          size={ElementSize.Standard}
          caretIcon={caretIcon}
          iconClassName={isDisabled ? disabledIconClassName : undefined}
          buttonClassName={mergeClasses(
            'bg-transparent',
            styles.modelSelectorButton,
            isDisabled && styles.modelSelectorButtonDisabled,
          )}
        />
      </DialTooltip>
    </div>
  );
};
