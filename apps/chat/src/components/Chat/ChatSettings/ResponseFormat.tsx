import { IconHelp } from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { FC, useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { DisableOverlay } from '@/src/components/Common/DisableOverlay';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { translateResponseFormatLabel } from './translateResponseFormatLabel';

import { ConversationResponseFormat } from '@epam/ai-dial-shared';
import {
  DialRadioGroup,
  RadioButtonWithContent,
  RadioGroupOrientation,
} from '@epam/ai-dial-ui-kit';

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
  const router = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const translateOption = useCallback(
    (key: string) => translateResponseFormatLabel(key, router.locale, t),
    [router.locale, t],
  );

  const radioButtons = useMemo<RadioButtonWithContent[]>(
    () => [
      {
        id: ConversationResponseFormat.Markdown,
        name: translateOption(ChatI18nKeys.Markdown),
      },
      {
        id: ConversationResponseFormat.PlainText,
        name: translateOption(ChatI18nKeys.PlainText),
      },
    ],
    [translateOption],
  );

  const handleChange = useCallback(
    (id: string) => {
      onChange(id as ConversationResponseFormat);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col" data-qa="response-format-container">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-start">{t(ChatI18nKeys.ResponseFormat)}</label>
        <Tooltip
          triggerClassName="text-secondary"
          tooltip={t(ChatI18nKeys.AppliesToNewAndExistingMessages)}
        >
          <IconHelp size={18} />
        </Tooltip>
      </div>
      {disabled && <DisableOverlay />}

      <DialRadioGroup
        elementId="response-format-toggler"
        radioButtons={radioButtons}
        activeRadioButton={value}
        orientation={RadioGroupOrientation.Column}
        onChange={handleChange}
        radioClassName="!mr-0 shrink-0 !me-3"
      />
    </div>
  );
};
