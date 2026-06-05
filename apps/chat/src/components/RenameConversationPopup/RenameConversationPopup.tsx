import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
  DialErrorText,
  DialInput,
  DialNeutralButton,
  DialPopup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionsI18nKeys,
  ConversationHistoryI18nKeys,
} from '../../constants/translation-keys.js';
import { getUtf8ByteLength } from '../../utils/string-utils.js';

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

  const trimmed = value.trim();
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
    <DialPopup
      open={isOpen}
      header={t(ConversationHistoryI18nKeys.RenameTitle)}
      size={PopupSize.Sm}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <DialNeutralButton
            label={t(ActionsI18nKeys.Cancel)}
            onClick={onCancel}
            disabled={isSaving}
          />
          <DialButton
            label={t(ActionsI18nKeys.Save)}
            appearance={ButtonAppearance.Solid}
            variant={ButtonVariant.Primary}
            onClick={handleSave}
            disabled={isSaveDisabled}
          />
        </div>
      }
    >
      <div className="px-6 py-2">
        <DialInput
          inputRef={inputRef}
          value={value}
          placeholder={t(ConversationHistoryI18nKeys.RenameInputPlaceholder)}
          error={
            isTooLong
              ? t(ConversationHistoryI18nKeys.RenameTitleTooLong)
              : undefined
          }
          onChange={(v) => setValue(v ?? '')}
          onKeyDown={handleKeyDown}
        />
        <DialErrorText text={error ?? undefined} />
      </div>
    </DialPopup>
  );
};

export default memo(RenameConversationPopup);
