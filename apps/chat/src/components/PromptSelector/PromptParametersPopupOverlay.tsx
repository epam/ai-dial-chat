import type { PromptParametersPopupLabels } from '@epam/ai-dial-prompts';
import { lazy, memo, Suspense, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  NavigationI18nKeys,
  PromptSelectorI18nKeys,
} from '../../constants/translation-keys';

const PromptParametersPopup = lazy(async () => {
  const module = await import('@epam/ai-dial-prompts');
  return { default: module.PromptParametersPopup };
});

interface Props {
  open: boolean;
  promptName: string;
  content: string;
  description?: string;
  parameters: string[];
  onBack?: () => void;
  onClose: () => void;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}

/** Wires app i18n labels into the lib's `PromptParametersPopup`. */
const PromptParametersPopupOverlay: FC<Props> = ({
  open,
  promptName,
  content,
  description,
  parameters,
  onBack,
  onClose,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const labels: PromptParametersPopupLabels = {
    title: t(PromptSelectorI18nKeys.ParametersTitle),
    closeLabel: t(ButtonsI18nKeys.Close),
    backLabel: t(NavigationI18nKeys.Back),
    parametersLabel: t(PromptSelectorI18nKeys.ParametersLabel),
    detailsLabel: t(PromptSelectorI18nKeys.DetailsLabel),
    enterValuePlaceholder: t(PromptSelectorI18nKeys.EnterValuePlaceholder),
    cancelLabel: t(ButtonsI18nKeys.Cancel),
    submitLabel: t(ButtonsI18nKeys.Confirm),
  };

  return (
    <Suspense fallback={null}>
      <PromptParametersPopup
        open={open}
        promptName={promptName}
        content={content}
        description={description}
        parameters={parameters}
        onBack={onBack}
        onClose={onClose}
        onCancel={onCancel}
        onSubmit={onSubmit}
        labels={labels}
      />
    </Suspense>
  );
};

export default memo(PromptParametersPopupOverlay);
