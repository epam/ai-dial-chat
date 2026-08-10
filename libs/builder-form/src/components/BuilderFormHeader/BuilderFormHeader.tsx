import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostIconButton,
  NeutralButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { FC } from 'react';
import type { BuilderFormHeaderProps } from '../../models/builder-form-header-props';
import styles from './BuilderFormHeader.module.scss';

/** Builder form page header: a back control, the form title, and cancel/submit actions. */
export const BuilderFormHeader: FC<BuilderFormHeaderProps> = ({
  labels,
  onBack,
  onCancel,
  onSubmit,
  isCancelDisabled = false,
  isSubmitDisabled = false,
  styles: headerStyles,
}) => {
  const { colors, typography } = headerStyles ?? {};
  const fontClassName = typography?.fontClassName ?? 'dial-h1-text';
  const hasCustomFontClass = Boolean(typography?.fontClassName);
  const cssVars = buildCssVars({
    '--bfh-border': colors?.borderColor,
    '--bfh-font-family': hasCustomFontClass
      ? undefined
      : typography?.fontFamily,
  });

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-16 items-center justify-between gap-6 border-b px-8',
        styles.header,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GhostIconButton
          icon={
            <IconArrowLeft
              size={DIAL_ICON_SIZE.LG}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          }
          aria-label={labels.backButtonLabel}
          onClick={onBack}
        />
        <h1 className={mergeClasses('truncate', styles.title, fontClassName)}>
          {labels.title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <NeutralButton
          label={labels.cancelButtonLabel}
          onClick={onCancel}
          disabled={isCancelDisabled}
        />
        <PrimaryButton
          label={labels.submitButtonLabel}
          onClick={onSubmit}
          disabled={isSubmitDisabled}
        />
      </div>
    </div>
  );
};
