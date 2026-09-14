import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { FC } from 'react';
import type { BuilderFormHeaderProps } from '../../models/builder-form-header-props';
import { BuilderFormActions } from '../BuilderFormActions/BuilderFormActions';
import styles from './BuilderFormHeader.module.scss';

/** Builder form page header: a back control, the form title, and the cancel/submit actions (desktop breakpoint only — mobile shows them in the container's sticky footer, and the row's divider above the row instead of below it). */
export const BuilderFormHeader: FC<BuilderFormHeaderProps> = ({
  labels,
  onBack,
  onCancel,
  onSubmit,
  isCancelDisabled = false,
  isSubmitDisabled = false,
  isSubmitting = false,
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
        /*
         * The divider flips sides per breakpoint: below the row at desktop
         * (a conventional header bar), and above it at mobile, where the
         * row reads as the first row of the form content sitting under the
         * app shell's floating header rather than as a page bar.
         */
        'flex h-16 items-center justify-between gap-6 border-t px-4 desktop:border-b desktop:border-t-0 desktop:px-8',
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
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          aria-label={labels.backButtonLabel}
          onClick={onBack}
        />
        <h1 className={mergeClasses('truncate', styles.title, fontClassName)}>
          {labels.title}
        </h1>
      </div>
      {/*
       * The action pair is hidden below the desktop breakpoint, where the
       * container's sticky footer renders its own copy — CSS cannot move a
       * single instance between the top of the page and the bottom, so
       * exactly one copy is visible (and tabbable) at any width.
       */}
      <div className="hidden items-center gap-2 desktop:flex">
        <BuilderFormActions
          labels={labels}
          onCancel={onCancel}
          onSubmit={onSubmit}
          isCancelDisabled={isCancelDisabled}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
        />
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {isSubmitting ? (labels.submittingLabel ?? 'Submitting') : ''}
      </span>
    </div>
  );
};
