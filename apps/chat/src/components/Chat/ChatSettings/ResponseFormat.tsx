import { FC, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { DisableOverlay } from '@/src/components/Common/DisableOverlay';

import { ConversationResponseFormat } from '@epam/ai-dial-shared';
import {
  DialRadioGroup,
  RadioButtonWithContent,
  RadioGroupOrientation,
} from '@epam/ai-dial-ui-kit';

const radioButtons: RadioButtonWithContent[] = [
  {
    id: ConversationResponseFormat.Markdown,
    name: translate(ChatI18nKeys.Markdown, { ns: Translation.Chat }),
  },
  {
    id: ConversationResponseFormat.PlainText,
    name: translate(ChatI18nKeys.PlainText, { ns: Translation.Chat }),
  },
];

interface ResponseFormatProps {
  value: ConversationResponseFormat;
  onChange: (value: ConversationResponseFormat) => void;
  disabled?: boolean;
}

export const ResponseFormat: FC<ResponseFormatProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const handleChange = useCallback(
    (id: string) => {
      onChange(id as ConversationResponseFormat);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col" data-qa="response-format-container">
      <label className="mb-4 text-left">{t(ChatI18nKeys.ResponseFormat)}</label>
      {disabled && <DisableOverlay />}

      <DialRadioGroup
        elementId="response-format-toggler"
        radioButtons={radioButtons}
        activeRadioButton={value}
        orientation={RadioGroupOrientation.Column}
        onChange={handleChange}
      />
    </div>
  );
};
