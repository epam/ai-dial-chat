import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdownIcon,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { type CSSProperties, type FC, useState } from 'react';
import { useModelSelector } from '../../hooks/useModelSelector';
import type { InputProps } from '../../models/Input';
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
    <div
      className={mergeClasses(
        styles.modelSelectorCaret,
        'flex size-5 items-center justify-center rounded-full bg-layer-2',
      )}
    >
      <IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />
    </div>
  );

  if (isMobile) {
    return (
      <>
        <DialGhostIconButton
          icon={
            <div className="relative flex items-center">
              {selectorIcon}
              <div className="absolute right-[-12px]"> {caretIcon}</div>
            </div>
          }
          aria-label={selectorAriaLabel}
          onClick={() => setIsModelSheetOpen(true)}
          className={mergeClasses(
            styles.modelSelectorButton,
            disabledIconClassName,
          )}
        />
        <ModelSelectorBottomSheet
          isOpen={isModelSheetOpen}
          title={modelSelectorLabels?.ariaLabel ?? 'Select model'}
          closeLabel={modelSelectorLabels?.closeLabel ?? 'Close'}
          searchPlaceholder={modelSelectorLabels?.searchPlaceholder ?? 'Search'}
          onClose={() => setIsModelSheetOpen(false)}
          deployments={deployments}
          selectedDeploymentId={selectedDeploymentId}
          onSelect={(id) => onDeploymentChange?.(id)}
          loadingLabel={modelSelectorLabels?.loading}
          errorLabel={modelSelectorLabels?.error}
          emptyLabel={modelSelectorLabels?.empty}
          style={style}
        />
      </>
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
      listClassName="!w-[240px] !max-h-80 shadow-md"
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
