import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialDropdownIcon,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { type CSSProperties, type FC, useState } from 'react';
import { useModelSelector } from '../../hooks/useModelSelector';
import type { InputProps } from '../../models/Input';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ModelSelectorBottomSheet } from '../ModelSelectorBottomSheet/ModelSelectorBottomSheet';
import styles from './Input.module.scss';

interface Props {
  deployments: InputProps['deployments'];
  selectedDeploymentId: InputProps['selectedDeploymentId'];
  onDeploymentChange: InputProps['onDeploymentChange'];
  modelSelectorLabels: InputProps['modelSelectorLabels'];
  isStreaming: boolean;
  isMobile: boolean;
  isInputDisabled?: boolean;
  style: CSSProperties;
  modelPickerOverlay: InputProps['modelPickerOverlay'];
  /** Whether the model picker popover is open (controlled from Input). */
  isPickerOpen?: boolean;
  /** Toggles the model picker popover open/closed. */
  onPickerToggle?: () => void;
  /** Called by DialDropdown when open state changes (e.g. outside click). */
  onPickerOpenChange?: (open: boolean) => void;
}

/**
 * Renders model selection control as a dropdown on desktop and as a bottom sheet on mobile.
 */
export const ModelSelectorControl: FC<Props> = ({
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  isStreaming,
  isMobile,
  isInputDisabled = false,
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

  const disabledIconClassName = isStreaming
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
        <DialGhostIconButton
          icon={
            <div className="flex items-center gap-1">
              {selectorIcon}
              {caretIcon}
            </div>
          }
          aria-label={selectorAriaLabel}
          onClick={() => setIsModelSheetOpen(true)}
          className={mergeClasses(
            styles.modelSelectorButton,
            disabledIconClassName,
          )}
        />
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
      <DialDropdown
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
        <button
          type="button"
          aria-label={selectorAriaLabel}
          className={mergeClasses(
            'flex items-center justify-center gap-1 rounded-md p-2',
            styles.modelSelectorButton,
            isInputDisabled || isStreaming ? disabledIconClassName : undefined,
            isInputDisabled && styles.modelSelectorButtonDisabled,
          )}
          onClick={() => {
            if (!isInputDisabled && !isStreaming) {
              onPickerToggle?.();
            }
          }}
        >
          {selectorIcon}
          {caretIcon}
        </button>
      </DialDropdown>
    );
  }

  return (
    <DialDropdownIcon
      icon={selectorIcon}
      ariaLabel={selectorAriaLabel}
      items={menuItems}
      menuHeader={menuHeader}
      placement="bottom-end"
      matchReferenceWidth={false}
      listClassName="cp-dropdown-overlay !w-[240px] !max-h-80"
      onOpenChange={handleModelSelectorOpenChange}
      size={ElementSize.Standard}
      caretIcon={caretIcon}
      iconClassName={isInputDisabled ? disabledIconClassName : undefined}
      buttonClassName={mergeClasses(
        'bg-transparent',
        styles.modelSelectorButton,
        isInputDisabled &&
          disabledIconClassName &&
          styles.modelSelectorButtonDisabled,
      )}
    />
  );
};
