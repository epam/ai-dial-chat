import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import type { BuilderFormContainerProps } from '../../models/builder-form-container-props';
import { BuilderFormBody } from '../BuilderFormBody/BuilderFormBody';
import { BuilderFormHeader } from '../BuilderFormHeader/BuilderFormHeader';
import styles from './BuilderFormContainer.module.scss';

/** Full-height scrollable builder form page shell with a header above the form content. */
export const BuilderFormContainer: FC<BuilderFormContainerProps> = ({
  labels,
  onBack,
  onCancel,
  onSubmit,
  isCancelDisabled = false,
  isSubmitDisabled = false,
  left,
  children,
  metadata,
  styles: containerStyles,
}) => {
  const { colors, header, cssVars } = containerStyles ?? {};

  return (
    <div
      style={{
        ...buildCssVars({ '--bfc-bg': colors?.background }),
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
        styles={header}
      />
      <BuilderFormBody left={left} metadata={metadata}>
        {children}
      </BuilderFormBody>
    </div>
  );
};
