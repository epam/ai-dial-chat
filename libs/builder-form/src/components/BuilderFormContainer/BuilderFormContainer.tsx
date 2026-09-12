import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import type { BuilderFormContainerProps } from '../../models/builder-form-container-props';
import { BuilderFormActions } from '../BuilderFormActions/BuilderFormActions';
import { BuilderFormBody } from '../BuilderFormBody/BuilderFormBody';
import { BuilderFormHeader } from '../BuilderFormHeader/BuilderFormHeader';
import styles from './BuilderFormContainer.module.scss';

/** Full-height scrollable builder form page shell: a header above the form content and a mobile-only sticky action footer below it. */
export const BuilderFormContainer: FC<BuilderFormContainerProps> = ({
  labels,
  onBack,
  onCancel,
  onSubmit,
  isCancelDisabled = false,
  isSubmitDisabled = false,
  isSubmitting = false,
  left,
  children,
  metadata,
  styles: containerStyles,
}) => {
  const { colors, header, cssVars } = containerStyles ?? {};

  return (
    <div
      style={{
        ...buildCssVars({
          '--bfc-bg': colors?.background,
        }),
        ...cssVars,
      }}
      className={mergeClasses(
        'flex h-full w-full flex-col overflow-y-auto',
        styles.container,
      )}
    >
      <BuilderFormHeader
        labels={labels}
        onBack={onBack}
        onCancel={onCancel}
        onSubmit={onSubmit}
        isCancelDisabled={isCancelDisabled}
        isSubmitDisabled={isSubmitDisabled}
        isSubmitting={isSubmitting}
        styles={header}
      />
      <BuilderFormBody left={left} metadata={metadata}>
        {children}
      </BuilderFormBody>
      {/*
       * At mobile widths the action pair lives in this sticky footer pinned
       * over the scrolling form instead of the header — a thumb-reachable
       * position, with the two actions splitting the row equally. It renders
       * the same `BuilderFormActions` the header holds at the desktop
       * breakpoint: CSS cannot move one instance between the top of the page
       * and the bottom, so exactly one copy is visible (and tabbable) at any
       * width. Opaque background and the elevation shadow come from
       * `styles.footer`, so scrolled content never shows through it.
       */}
      <div
        className={mergeClasses(
          'sticky bottom-0 z-10 flex items-center gap-2 p-3 desktop:hidden',
          styles.footer,
        )}
      >
        <BuilderFormActions
          labels={labels}
          onCancel={onCancel}
          onSubmit={onSubmit}
          isCancelDisabled={isCancelDisabled}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
          buttonClassName="flex-1"
        />
      </div>
    </div>
  );
};
