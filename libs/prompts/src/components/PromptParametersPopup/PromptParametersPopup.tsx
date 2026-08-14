import { AppIdentity, ContentTab, DeploymentSize } from '@epam/ai-dial-catalog';
import {
  CatalogEntityType,
  buildCssVars,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  GhostIconButton,
  NeutralButton,
  Popup,
  PopupSize,
  PrimaryButton,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft } from '@tabler/icons-react';
import { useId, useMemo, useState, type FC } from 'react';
import type { PromptParametersPopupProps } from '../../models/prompt-parameters-popup-props';
import styles from './PromptParametersPopup.module.scss';

/**
 * Popup that collects a value for every `{{param}}` token found in a prompt
 * before it is inserted into the chat composer, showing the full prompt body
 * read-only alongside the parameter fields.
 */
export const PromptParametersPopup: FC<PromptParametersPopupProps> = ({
  open,
  promptName,
  content,
  description,
  parameters,
  onBack,
  onClose,
  onSubmit,
  onCancel,
  labels = {},
  colors,
  titleClassName = 'dial-h2-text',
  parametersLabelClassName = 'dial-h2-text',
  detailsLabelClassName = 'dial-h2-text',
}) => {
  const {
    title = 'Prompt parameters',
    closeLabel = 'Close',
    backLabel = 'Back',
    parametersLabel = 'Parameters',
    detailsLabel = 'Details',
    enterValuePlaceholder = 'Enter value',
    cancelLabel = 'Cancel',
    submitLabel = 'Confirm',
  } = labels;

  const [values, setValues] = useState<Record<string, string>>({});
  const fieldIdPrefix = useId();

  const cssVars = buildCssVars({
    '--pp-card-bg': colors?.cardBackground,
    '--pp-card-border': colors?.cardBorder,
  });

  const isSubmitDisabled = useMemo(
    () => parameters.some((name) => !values[name]?.trim()),
    [parameters, values],
  );

  const handleSubmit = () => {
    if (isSubmitDisabled) return;
    onSubmit(values);
  };

  const header = (
    <div className="flex items-center gap-2">
      {onBack != null && (
        <GhostIconButton
          icon={<IconChevronLeft className="rtl:scale-x-[-1]" aria-hidden />}
          aria-label={backLabel}
          onClick={onBack}
        />
      )}
      <span className={titleClassName}>{title}</span>
    </div>
  );

  return (
    <Popup
      open={open}
      header={header}
      ariaLabel={title}
      size={PopupSize.Lg}
      closeAriaLabel={closeLabel}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <NeutralButton label={cancelLabel} onClick={onCancel} />
          <PrimaryButton
            label={submitLabel}
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 pb-4 pt-2">
        <div
          className={mergeClasses(
            'flex h-[72px] w-full items-center rounded-lg border px-3',
            styles.card,
          )}
          style={cssVars}
        >
          <AppIdentity
            type={CatalogEntityType.Prompt}
            name={promptName}
            size={DeploymentSize.LG}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <h2 className={mergeClasses(parametersLabelClassName, 'm-0')}>
              {parametersLabel}
            </h2>
            {parameters.map((name) => {
              const fieldId = `${fieldIdPrefix}-${name}`;
              return (
                <Textarea
                  key={name}
                  id={fieldId}
                  aria-label={name}
                  value={values[name] ?? ''}
                  labelProps={{ htmlFor: fieldId, label: name, required: true }}
                  placeholder={enterValuePlaceholder}
                  onChange={(value) =>
                    setValues((prev) => ({ ...prev, [name]: value }))
                  }
                />
              );
            })}
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <h2 className={mergeClasses(detailsLabelClassName, 'm-0')}>
              {detailsLabel}
            </h2>
            <ContentTab content={content} description={description} />
          </div>
        </div>
      </div>
    </Popup>
  );
};
