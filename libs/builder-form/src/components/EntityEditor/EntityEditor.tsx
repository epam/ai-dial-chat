import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { NeutralButton, PrimaryButton } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { BUILDER_FORM_CLASS } from '../../constants/public-class-names';
import type { EntityEditorProps } from '../../models/entity-editor-props';
import { EditorLayout } from '../EditorLayout/EditorLayout';
import { EditorSection } from '../EditorSection/EditorSection';

const SECTION_CLASS_NAME = 'border-0 p-4 desktop:p-6';
const ALERT_CLASS_NAME = 'px-4 pt-4 desktop:px-6 desktop:pt-6';

/** Standard entity editor: header with Cancel and a primary action, a Metadata column and a Setup column. */
const EntityEditorComponent: FC<EntityEditorProps> = ({
  title,
  onBack,
  onCancel,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  isSubmitDisabled = false,
  extraActions,
  hideStandardActions = false,
  metadata,
  metadataFooter,
  setup,
  setupTitle,
  alert,
  metadataSectionClassName,
  setupSectionClassName,
  labels,
  styles,
  dir,
}) => {
  const alertRegion =
    alert != null ? (
      <div role="alert" className={ALERT_CLASS_NAME}>
        {alert}
      </div>
    ) : null;
  const hasSetup = setup != null;

  return (
    <EditorLayout
      title={title}
      onBack={onBack}
      backAriaLabel={labels?.backAriaLabel ?? 'Back'}
      isSaving={isSubmitting}
      labels={{ savingStatusLabel: labels?.savingStatusLabel ?? 'Saving' }}
      styles={styles?.layout}
      dir={dir}
      actions={
        <>
          {extraActions}
          {!hideStandardActions && (
            <>
              <NeutralButton
                label={labels?.cancelLabel ?? 'Cancel'}
                disabled={isSubmitting}
                onClick={onCancel}
              />
              <PrimaryButton
                label={submitLabel}
                disabled={isSubmitting || isSubmitDisabled}
                onClick={onSubmit}
              />
            </>
          )}
        </>
      }
      leftContent={
        <>
          {!hasSetup && alertRegion}
          <EditorSection
            title={labels?.metadataTitle ?? 'Metadata'}
            styles={styles?.section}
            className={mergeClasses(
              SECTION_CLASS_NAME,
              metadataSectionClassName,
              BUILDER_FORM_CLASS.metadataSection,
            )}
          >
            {metadata}
          </EditorSection>
          {metadataFooter}
        </>
      }
      rightContent={
        hasSetup ? (
          <>
            {alertRegion}
            <EditorSection
              title={setupTitle ?? labels?.setupTitle ?? 'Setup'}
              styles={styles?.section}
              className={mergeClasses(
                SECTION_CLASS_NAME,
                setupSectionClassName,
                BUILDER_FORM_CLASS.setupSection,
              )}
            >
              {setup}
            </EditorSection>
          </>
        ) : undefined
      }
    />
  );
};

/** Standard entity editor: header with Cancel and a primary action, a Metadata column and a Setup column. */
export const EntityEditor = memo(EntityEditorComponent);
