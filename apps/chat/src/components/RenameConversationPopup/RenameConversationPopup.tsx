import { DialFormPopup, DialInput, PopupSize } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import {
  getUtf8ByteLength,
  sanitizeConversationName,
  stripTrailingDots,
} from '../../utils/string-utils';

interface Props {
  isOpen: boolean;
  currentTitle: string;
  isSaving: boolean;
  error: string | null;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
}

const RenameConversationPopup: FC<Props> = ({
  isOpen,
  currentTitle,
  isSaving,
  error,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(currentTitle);
      // Defer focus so the popup has time to mount and become visible
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, currentTitle]);

  const trimmed = stripTrailingDots(value.trim());
  const isTooLong = getUtf8ByteLength(trimmed) > 255;
  const isSaveDisabled =
    isSaving || trimmed === '' || trimmed === currentTitle.trim() || isTooLong;

  const handleSave = useCallback(() => {
    if (!isSaveDisabled) onSave(trimmed);
  }, [isSaveDisabled, onSave, trimmed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSave();
    },
    [handleSave],
  );

  return (
    <DialFormPopup
      open={isOpen}
      header={t(ConversationPanelI18nKeys.RenameTitle)}
      size={PopupSize.Sm}
      onClose={onCancel}
      onCancel={onCancel}
      onSubmit={handleSave}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      submitLabel={t(ButtonsI18nKeys.Save)}
      isLoading={isSaving}
      disableSubmitButton={isSaveDisabled}
    >
      <div className="px-6 py-2">
        <DialInput
          inputRef={inputRef}
          value={value}
          placeholder={t(ConversationPanelI18nKeys.RenameInputPlaceholder)}
          error={
            isTooLong
              ? t(ConversationPanelI18nKeys.RenameTitleTooLong)
              : (error ?? undefined)
          }
          onChange={(v) => setValue(sanitizeConversationName(v ?? ''))}
          onKeyDown={handleKeyDown}
        />
      </div>
    </DialFormPopup>
  );
};

export default memo(RenameConversationPopup);
