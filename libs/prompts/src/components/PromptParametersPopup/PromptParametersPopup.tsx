import { AppIdentity, ContentTab, DeploymentSize } from '@epam/ai-dial-catalog';
import {
  CatalogEntityType,
  buildCssVars,
  buildPromptParamDefaults,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonVariant,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
  Popup,
  PopupSize,
  Tabs,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft } from '@tabler/icons-react';
import { useId, useState, type FC } from 'react';
import type { PromptParametersPopupProps } from '../../models/prompt-parameters-popup-props';
import { PromptParametersPopupTab } from '../../types/prompt-parameters-popup';
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

  const parametersKey = parameters
    .map(({ name, defaultValue }) => `${name}\u0000${defaultValue ?? ''}`)
    .join('\u0001');

  const [values, setValues] = useState<Record<string, string>>(() =>
    buildPromptParamDefaults(parameters),
  );
  const [seededKey, setSeededKey] = useState(parametersKey);
  const [activeTab, setActiveTab] = useState<PromptParametersPopupTab>(
    PromptParametersPopupTab.Parameters,
  );

  /*
   * Re-seed during render (React's "adjust state when a prop changes") when the
   * popup is handed a different set of parameters, so reopening a prompt offers
   * its defaults again rather than whatever was typed the previous time.
   */
  if (seededKey !== parametersKey) {
    setSeededKey(parametersKey);
    setValues(buildPromptParamDefaults(parameters));
    setActiveTab(PromptParametersPopupTab.Parameters);
  }

  const fieldIdPrefix = useId();
  const isMobile = useIsMobile();
  const isParametersVisible =
    !isMobile || activeTab === PromptParametersPopupTab.Parameters;
  const isDetailsVisible =
    !isMobile || activeTab === PromptParametersPopupTab.Details;

  const cssVars = buildCssVars({
    '--pp-card-bg': colors?.cardBackground,
    '--pp-card-border': colors?.cardBorder,
  });

  const isSubmitDisabled = parameters.some(({ name }) => !values[name]?.trim());

  const handleTabChange = (tabId: string) => {
    const tab = Object.values(PromptParametersPopupTab).find(
      (value) => value === tabId,
    );
    if (tab != null) setActiveTab(tab);
  };

  const handleSubmit = () => {
    if (isSubmitDisabled) return;
    onSubmit(values);
  };

  const header = (
    <div className="flex items-center gap-2">
      {onBack != null && (
        <GhostIconButton
          icon={
            <IconChevronLeft
              className="rtl:scale-x-[-1]"
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
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
      className={
        isMobile ? 'h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)]' : undefined
      }
      closeAriaLabel={closeLabel}
      onClose={onClose}
      mainButtons={[
        { label: cancelLabel, onClick: onCancel },
        {
          label: submitLabel,
          variant: ButtonVariant.Primary,
          disabled: isSubmitDisabled,
          onClick: handleSubmit,
        },
      ]}
    >
      <div className="flex flex-col gap-4 pt-2 pb-4">
        <div
          className={mergeClasses(
            'mx-6 flex h-[72px] items-center rounded-lg border px-3',
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

        {isMobile && (
          <Tabs
            ariaLabel={promptName}
            className="px-6"
            tabs={[
              {
                id: PromptParametersPopupTab.Parameters,
                label: parametersLabel,
              },
              { id: PromptParametersPopupTab.Details, label: detailsLabel },
            ]}
            activeTabId={activeTab}
            onTabChange={handleTabChange}
          />
        )}

        <div
          className={mergeClasses(
            'gap-4 px-6',
            isMobile ? 'flex flex-col' : 'grid grid-cols-2',
          )}
        >
          {isParametersVisible && (
            <div
              role={isMobile ? 'tabpanel' : undefined}
              aria-label={isMobile ? parametersLabel : undefined}
              className="flex flex-col gap-3"
            >
              {!isMobile && (
                <h2 className={mergeClasses(parametersLabelClassName, 'm-0')}>
                  {parametersLabel}
                </h2>
              )}
              {parameters.map(({ name }) => {
                const fieldId = `${fieldIdPrefix}-${name}`;
                return (
                  <Textarea
                    key={name}
                    id={fieldId}
                    aria-label={name}
                    value={values[name] ?? ''}
                    labelProps={{
                      htmlFor: fieldId,
                      label: name,
                      required: true,
                    }}
                    placeholder={enterValuePlaceholder}
                    onChange={(value) =>
                      setValues((prev) => ({ ...prev, [name]: value }))
                    }
                  />
                );
              })}
            </div>
          )}

          {isDetailsVisible && (
            <div
              role={isMobile ? 'tabpanel' : undefined}
              aria-label={isMobile ? detailsLabel : undefined}
              className="flex min-h-0 flex-col gap-3"
            >
              {!isMobile && (
                <h2 className={mergeClasses(detailsLabelClassName, 'm-0')}>
                  {detailsLabel}
                </h2>
              )}
              <ContentTab content={content} description={description} />
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
};
