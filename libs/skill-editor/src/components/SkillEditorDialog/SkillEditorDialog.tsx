import {
  buildCssVars,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  BottomSheet,
  ButtonAppearance,
  ButtonVariant,
  NeutralButton,
  Popup,
  PopupSize,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { SkillEditorDialogProps } from '../../models/skill-editor-dialog-props';
import styles from './SkillEditorDialog.module.scss';

/** A Cancel/Confirm dialog of the skill editor: a centred `Popup` on desktop and a `BottomSheet` below the desktop breakpoint. */
export const SkillEditorDialog: FC<SkillEditorDialogProps> = ({
  isOpen,
  title,
  closeAriaLabel,
  onClose,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
  isConfirmDisabled = false,
  isConfirming = false,
  children,
  colors,
}) => {
  const isMobile = useIsMobile();
  const confirmIcon = isConfirming ? (
    <Spinner size={16} ariaLabel="" />
  ) : undefined;

  if (isMobile) {
    // The sheet renders in a portal outside the editor root, so the footer carries its own vars.
    const footerCssVars = buildCssVars({
      '--se-dialog-footer-bg': colors?.footerBackground,
      '--se-dialog-footer-border': colors?.footerBorder,
    });

    return (
      <BottomSheet
        open={isOpen}
        title={title}
        closeAriaLabel={closeAriaLabel}
        onClose={onClose}
      >
        {children}
        {/* Pinned under the scrolling content, so a long upload list keeps its actions in reach. */}
        <div
          className={mergeClasses(
            'sticky bottom-0 flex gap-3 border-t p-4',
            styles.footer,
          )}
          style={footerCssVars}
        >
          <PrimaryButton
            className="flex-1"
            label={confirmLabel}
            iconBefore={confirmIcon}
            disabled={isConfirmDisabled}
            onClick={onConfirm}
          />
          <NeutralButton
            className="flex-1"
            label={cancelLabel}
            onClick={onCancel}
          />
        </div>
      </BottomSheet>
    );
  }

  return (
    <Popup
      open={isOpen}
      header={title}
      size={PopupSize.Sm}
      closeAriaLabel={closeAriaLabel}
      onClose={onClose}
      mainButtons={[
        {
          label: cancelLabel,
          variant: ButtonVariant.Primary,
          appearance: ButtonAppearance.Ghost,
          onClick: onCancel,
        },
        {
          label: confirmLabel,
          variant: ButtonVariant.Primary,
          iconBefore: confirmIcon,
          onClick: onConfirm,
          disabled: isConfirmDisabled,
        },
      ]}
    >
      {children}
    </Popup>
  );
};
